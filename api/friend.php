<?php
// SyncTune Friend Management API
// URL patterns:
// POST: /backend/api/friend.php?action=request   (payload: {friendUserId})
// POST: /backend/api/friend.php?action=accept    (payload: {requestId})
// POST: /backend/api/friend.php?action=reject    (payload: {requestId})
// GET:  /backend/api/friend.php?action=list      (optional: ?status=pending|accepted)

require_once 'config.php';
require_once 'db.php';

// Verify Auth Token
$user = getAuthUser();
if (!$user) {
    sendError('Access denied. Authentication required.', 401);
}

$action = isset($_GET['action']) ? $_GET['action'] : '';
$db = DB::connect();
$userId = $user['id'];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    if ($action === 'request') {
        $friendId = isset($input['friendUserId']) ? (int)$input['friendUserId'] : 0;
        if ($friendId <= 0) {
            sendError('Invalid friend user ID.');
        }
        // Prevent duplicate requests or existing friendships
        $check = $db->prepare("SELECT id FROM friends WHERE (user_id = ? AND friend_user_id = ?) OR (user_id = ? AND friend_user_id = ?)");
        $check->execute([$userId, $friendId, $friendId, $userId]);
        if ($check->fetch()) {
            sendError('Friend request already exists or users are already friends.');
        }
        // Insert pending request (user as requester)
        $stmt = $db->prepare("INSERT INTO friends (user_id, friend_user_id, status) VALUES (?, ?, 'pending')");
        $stmt->execute([$userId, $friendId]);
        sendResponse(['message' => 'Friend request sent.']);
    } elseif ($action === 'accept') {
        $requestId = isset($input['requestId']) ? (int)$input['requestId'] : 0;
        if ($requestId <= 0) {
            sendError('Invalid request ID.');
        }
        // Verify ownership of request (must be the receiver)
        $stmt = $db->prepare("SELECT * FROM friends WHERE id = ? AND friend_user_id = ? AND status = 'pending'");
        $stmt->execute([$requestId, $userId]);
        $req = $stmt->fetch();
        if (!$req) {
            sendError('Friend request not found or not authorized.');
        }
        $update = $db->prepare("UPDATE friends SET status = 'accepted' WHERE id = ?");
        $update->execute([$requestId]);
        sendResponse(['message' => 'Friend request accepted.']);
    } elseif ($action === 'reject') {
        $requestId = isset($input['requestId']) ? (int)$input['requestId'] : 0;
        if ($requestId <= 0) {
            sendError('Invalid request ID.');
        }
        $stmt = $db->prepare("SELECT * FROM friends WHERE id = ? AND (friend_user_id = ? OR user_id = ?)");
        $stmt->execute([$requestId, $userId, $userId]);
        if (!$stmt->fetch()) {
            sendError('Friend request not found or not authorized.');
        }
        $del = $db->prepare("DELETE FROM friends WHERE id = ?");
        $del->execute([$requestId]);
        sendResponse(['message' => 'Friend request rejected or friend removed.']);
    } else {
        sendError('Invalid action for POST.');
    }
} elseif ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if ($action === 'list') {
        // Fetch all friends with status, last active, and room info
        $query = "
            SELECT f.id, f.user_id, f.friend_user_id, f.status,
                   CASE WHEN f.user_id = :uid THEN f.friend_user_id ELSE f.user_id END as friend_id,
                   u.username as friend_name,
                   u.email as friend_email,
                   u.status as friend_status,
                   u.last_seen_at,
                   (u.last_seen_at >= DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 25 SECOND)) as is_online,
                   rm.room_code as active_room
            FROM friends f
            JOIN users u ON u.id = CASE WHEN f.user_id = :uid THEN f.friend_user_id ELSE f.user_id END
            LEFT JOIN room_members rm ON rm.user_id = u.id AND rm.last_seen_at >= DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 25 SECOND)
            WHERE (f.user_id = :uid OR f.friend_user_id = :uid)
        ";
        $stmt = $db->prepare($query);
        $stmt->execute([':uid' => $userId]);
        $friends = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Populate user_name and friend_name for backward compatibility (e.g. pending requests)
        foreach ($friends as &$f) {
            $stmtUser = $db->prepare("SELECT username FROM users WHERE id = ?");
            $stmtUser->execute([$f['user_id']]);
            $r1 = $stmtUser->fetch();
            $f['user_name'] = $r1 ? $r1['username'] : '';

            $stmtFriend = $db->prepare("SELECT username FROM users WHERE id = ?");
            $stmtFriend->execute([$f['friend_user_id']]);
            $r2 = $stmtFriend->fetch();
            $f['friend_name'] = $r2 ? $r2['username'] : '';
            
            $f['is_online'] = (bool)$f['is_online'];
        }
        sendResponse(['friends' => $friends]);
    } elseif ($action === 'search_users') {
        $q = isset($_GET['q']) ? trim($_GET['q']) : '';
        if (empty($q)) {
            sendResponse(['users' => []]);
        }
        // Match email OR username (case-insensitive) up to 10 records
        $stmt = $db->prepare("SELECT id, username, email FROM users WHERE (email = ? OR username LIKE ?) AND id != ? LIMIT 10");
        $stmt->execute([$q, '%' . $q . '%', $userId]);
        $users = $stmt->fetchAll(PDO::FETCH_ASSOC);
        sendResponse(['users' => $users]);
    } else {
        sendError('Invalid action for GET.', 400);
    }
} else {
    sendError('Invalid request method or action.', 400);
}
?>
