<?php
// SyncTune Admin Dashboard API
// URL pattern: GET /backend/api/admin.php

require_once 'config.php';
require_once 'db.php';

// 1. Verify Authentication
$user = getAuthUser();
if (!$user) {
    sendError('Access denied. Authentication required.', 401);
}

// 2. Enforce Admin Role Check
if ($user['role'] !== 'admin') {
    sendError('Access denied. Administrator privileges required.', 403);
}

$db = DB::connect();

try {
    $action = isset($_GET['action']) ? $_GET['action'] : '';
    $input = json_decode(file_get_contents('php://input'), true);
 
    if ($action === 'toggle_maintenance') {
        $enabled = isset($input['enabled']) ? (bool)$input['enabled'] : false;
        file_put_contents('maintenance.json', json_encode(['maintenance' => $enabled]));
        sendResponse(['success' => true, 'maintenance' => $enabled]);
    } elseif ($action === 'add_user') {
        $email = isset($input['email']) ? trim($input['email']) : '';
        $password = isset($input['password']) ? trim($input['password']) : '';
        $username = isset($input['username']) ? trim($input['username']) : '';
        $role = isset($input['role']) ? trim($input['role']) : 'user';

        if (empty($email) || empty($password) || empty($username)) {
            sendError('All fields are required.');
        }
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            sendError('Please enter a valid email address.');
        }
        if ($role !== 'user' && $role !== 'admin') {
            sendError('Invalid role.');
        }

        // Check if user already exists
        $stmt = $db->prepare("SELECT id FROM users WHERE email = ?");
        $stmt->execute([$email]);
        if ($stmt->fetch()) {
            sendError('Email address is already registered.');
        }

        $hashedPassword = password_hash($password, PASSWORD_BCRYPT);
        $insert = $db->prepare("INSERT INTO users (email, password, username, role) VALUES (?, ?, ?, ?)");
        $insert->execute([$email, $hashedPassword, $username, $role]);
        sendResponse(['success' => true, 'message' => 'User added successfully.']);

    } elseif ($action === 'delete_user') {
        $targetId = isset($input['id']) ? (int)$input['id'] : 0;

        if ($targetId <= 0) {
            sendError('Invalid user ID.');
        }
        if ($targetId === (int)$user['id']) {
            sendError('You cannot delete your own admin account!');
        }

        $delete = $db->prepare("DELETE FROM users WHERE id = ?");
        $delete->execute([$targetId]);
        sendResponse(['success' => true, 'message' => 'User removed successfully.']);

    } elseif ($action === 'toggle_user_role') {
        $targetId = isset($input['id']) ? (int)$input['id'] : 0;
        $newRole = isset($input['role']) ? trim($input['role']) : 'user';

        if ($targetId <= 0 || ($newRole !== 'user' && $newRole !== 'admin')) {
            sendError('Invalid parameters.');
        }
        if ($targetId === (int)$user['id']) {
            sendError('You cannot demote your own admin account!');
        }

        $update = $db->prepare("UPDATE users SET role = ? WHERE id = ?");
        $update->execute([$newRole, $targetId]);
        sendResponse(['success' => true, 'message' => 'User role updated successfully.']);

    } elseif ($action === 'destroy_room') {
        $roomCode = isset($input['code']) ? strtoupper(trim($input['code'])) : '';

        if (empty($roomCode)) {
            sendError('Room code is required.');
        }

        // Delete room members and the room itself
        $db->prepare("DELETE FROM room_members WHERE room_code = ?")->execute([$roomCode]);
        $db->prepare("DELETE FROM rooms WHERE code = ?")->execute([$roomCode]);
        sendResponse(['success' => true, 'message' => 'Room destroyed successfully.']);

    } elseif ($action === 'send_broadcast') {
        $message = isset($input['message']) ? trim($input['message']) : '';

        if (empty($message)) {
            sendError('Broadcast message cannot be empty.');
        }

        file_put_contents('broadcast.json', json_encode([
            'message' => $message,
            'timestamp' => time()
        ]));
        sendResponse(['success' => true, 'message' => 'Broadcast message sent.']);
    }

    // 0. Global cleanup of stale members and empty rooms
    $db->exec("DELETE FROM room_members WHERE last_seen_at < DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 25 SECOND)");
    $db->exec("DELETE FROM rooms WHERE code NOT IN (SELECT DISTINCT room_code FROM room_members)");

    // 3. Compile System-Wide Statistics
    // A. Total Users
    $stmtUsers = $db->query("SELECT COUNT(*) as total FROM users");
    $totalUsers = (int)$stmtUsers->fetch()['total'];

    // B. Total Active Rooms
    $stmtRooms = $db->query("SELECT COUNT(*) as total FROM rooms");
    $activeRooms = (int)$stmtRooms->fetch()['total'];

    // C. Total Data Used Today (System-wide)
    $stmtToday = $db->query("SELECT SUM(bytes) as total FROM data_usage WHERE recorded_date = CURRENT_DATE()");
    $rowToday = $stmtToday->fetch();
    $systemBytesToday = ($rowToday && $rowToday['total']) ? (int)$rowToday['total'] : 0;

    // D. Total Data Used This Month (System-wide)
    $stmtMonth = $db->query("
        SELECT SUM(bytes) as total 
        FROM data_usage 
        WHERE recorded_date >= DATE_SUB(CURRENT_DATE(), INTERVAL DAYOFMONTH(CURRENT_DATE())-1 DAY)
    ");
    $rowMonth = $stmtMonth->fetch();
    $systemBytesMonth = ($rowMonth && $rowMonth['total']) ? (int)$rowMonth['total'] : 0;

    // E. Total Data Saved (System-wide estimation vs normal streaming quality)
    // Estimation: Normal high quality YouTube streaming is ~4.8MB/song (128kbps).
    // Our Low data mode is ~1.8MB/song (50-64kbps).
    // Average saving: 3.0MB per song listened!
    $stmtListens = $db->query("SELECT COUNT(*) as total FROM listens");
    $totalListensCount = (int)$stmtListens->fetch()['total'];
    $dataSavedMB = $totalListensCount * 3.0; // 3.0 MB saved per song

    // 4. Retrieve User Details Table (with aggregated usage details and timezone-immune online status)
    $stmtUserList = $db->query("
        SELECT u.id, u.email, u.username, u.role, u.status, u.last_seen_at, u.created_at,
               (u.last_seen_at >= DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 20 SECOND)) as is_online,
               COALESCE(ut.today_bytes, 0) as today_bytes,
               COALESCE(um.month_bytes, 0) as month_bytes
        FROM users u
        LEFT JOIN (
            SELECT user_id, bytes as today_bytes 
            FROM data_usage 
            WHERE recorded_date = CURRENT_DATE()
        ) ut ON u.id = ut.user_id
        LEFT JOIN (
            SELECT user_id, SUM(bytes) as month_bytes 
            FROM data_usage 
            WHERE recorded_date >= DATE_SUB(CURRENT_DATE(), INTERVAL DAYOFMONTH(CURRENT_DATE())-1 DAY)
            GROUP BY user_id
        ) um ON u.id = um.user_id
        ORDER BY u.role DESC, u.created_at DESC
    ");
    $usersList = $stmtUserList->fetchAll();

    // Map byte totals to MB for display and compute status
    foreach ($usersList as &$u) {
        $u['todayMB'] = round((int)$u['today_bytes'] / 1024 / 1024, 2);
        $u['monthMB'] = round((int)$u['month_bytes'] / 1024 / 1024, 2);
        
        $isOnline = (bool)$u['is_online'];
        if ($isOnline) {
            $u['current_status'] = $u['status'] ?: 'active';
        } else {
            $u['current_status'] = 'offline';
        }
        
        if ($u['last_seen_at']) {
            $u['last_seen_at'] = date('c', strtotime($u['last_seen_at']));
        }
        if ($u['created_at']) {
            $u['created_at'] = date('c', strtotime($u['created_at']));
        }
        
        unset($u['is_online']);
        unset($u['today_bytes']);
        unset($u['month_bytes']);
    }

    // 5. Retrieve Active Room Details Table
    $stmtActiveRoomsList = $db->query("
        SELECT r.code, r.song_title, r.song_artist, r.is_playing, u.username as host_name,
               (SELECT COUNT(*) FROM room_members rm WHERE rm.room_code = r.code) as member_count
        FROM rooms r
        JOIN users u ON r.host_id = u.id
        ORDER BY member_count DESC
    ");
    $roomsList = $stmtActiveRoomsList->fetchAll();

    $maintenance = false;
    if (file_exists('maintenance.json')) {
        $data = json_decode(file_get_contents('maintenance.json'), true);
        $maintenance = isset($data['maintenance']) ? (bool)$data['maintenance'] : false;
    }

    sendResponse([
        'stats' => [
            'totalUsers' => $totalUsers,
            'activeRooms' => $activeRooms,
            'todayMB' => round($systemBytesToday / 1024 / 1024, 2),
            'monthMB' => round($systemBytesMonth / 1024 / 1024, 2),
            'dataSavedMB' => round($dataSavedMB, 2),
            'totalListens' => $totalListensCount,
            'maintenance' => $maintenance
        ],
        'users' => $usersList,
        'rooms' => $roomsList
    ]);

} catch (Exception $e) {
    sendError("Admin dashboard error: " . $e->getMessage(), 500);
}
?>
