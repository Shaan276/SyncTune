<?php
// SyncTune User Authentication Routes
// URL patterns:
// POST: /backend/api/auth.php?action=register
// POST: /backend/api/auth.php?action=login
// GET:  /backend/api/auth.php?action=me

require_once 'config.php';
require_once 'db.php';

$action = isset($_GET['action']) ? $_GET['action'] : '';

// 1. Establish Database Connection
$db = DB::connect();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);

    if ($action === 'register') {
        $email = isset($input['email']) ? trim($input['email']) : '';
        $password = isset($input['password']) ? trim($input['password']) : '';
        $username = isset($input['username']) ? trim($input['username']) : '';

        if (empty($email) || empty($password) || empty($username)) {
            sendError('All fields are required.');
        }

        // Validate email
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            sendError('Please enter a valid email address.');
        }

        // Check if user already exists
        $stmt = $db->prepare("SELECT id FROM users WHERE email = ?");
        $stmt->execute([$email]);
        if ($stmt->fetch()) {
            sendError('Email address is already registered.');
        }

        // Hash password
        $hashedPassword = password_hash($password, PASSWORD_BCRYPT);

        // Insert new user
        $insert = $db->prepare("INSERT INTO users (email, password, username, role) VALUES (?, ?, ?, 'user')");
        $insert->execute([$email, $hashedPassword, $username]);
        $userId = $db->lastInsertId();

        // Create JWT Token
        $payload = [
            'id' => $userId,
            'email' => $email,
            'username' => $username,
            'role' => 'user'
        ];
        $token = encodeJWT($payload);

        sendResponse([
            'message' => 'Registration successful',
            'token' => $token,
            'user' => [
                'id' => $userId,
                'email' => $email,
                'username' => $username,
                'role' => 'user',
                'is_admin_eligible' => (strtolower($email) === 'piyushpilkhwal74@gmail.com')
            ]
        ], 201);

    } elseif ($action === 'login') {
        $email = isset($input['email']) ? trim($input['email']) : '';
        $password = isset($input['password']) ? trim($input['password']) : '';

        if (empty($email) || empty($password)) {
            sendError('Email and password are required.');
        }

        // Fetch user from DB
        $stmt = $db->prepare("SELECT * FROM users WHERE email = ?");
        $stmt->execute([$email]);
        $user = $stmt->fetch();

        if (!$user) {
            sendError('Invalid email or password.');
        }

        // Verify password
        if (!password_verify($password, $user['password'])) {
            sendError('Invalid email or password.');
        }

        // Create JWT Token
        $payload = [
            'id' => $user['id'],
            'email' => $user['email'],
            'username' => $user['username'],
            'role' => $user['role']
        ];
        $token = encodeJWT($payload);

        sendResponse([
            'message' => 'Login successful',
            'token' => $token,
            'user' => [
                'id' => $user['id'],
                'email' => $user['email'],
                'username' => $user['username'],
                'role' => $user['role'],
                'status' => $user['status'] ?? 'active',
                'status_override' => $user['status_override'] ?? null,
                'is_admin_eligible' => (strtolower($user['email']) === 'piyushpilkhwal74@gmail.com')
            ]
        ], 200);

    } elseif ($action === 'update_settings') {
        $user = getAuthUser();
        if (!$user) {
            sendError('Access denied. Authentication required.', 401);
        }

        $userId = $user['id'];
        $role = isset($input['role']) ? trim($input['role']) : '';
        $statusOverride = isset($input['status_override']) ? trim($input['status_override']) : null;
        $status = isset($input['status']) ? trim($input['status']) : '';

        // Validate role changes
        if (!empty($role) && !in_array($role, ['user', 'admin'])) {
            sendError('Invalid role.');
        }

        // Update database
        $fields = [];
        $params = [];
        if (!empty($role)) {
            if ($role === 'admin') {
                // Fetch email from database to strictly authorize
                $emailCheck = $db->prepare("SELECT email FROM users WHERE id = ?");
                $emailCheck->execute([$userId]);
                $dbUser = $emailCheck->fetch();
                $dbEmail = $dbUser ? strtolower(trim($dbUser['email'])) : '';
                if ($dbEmail !== 'piyushpilkhwal74@gmail.com') {
                    sendError('Only piyushpilkhwal74@gmail.com is authorized for Admin privilege.', 403);
                }
            }
            $fields[] = "role = ?";
            $params[] = $role;
        }
        if (isset($input['status_override'])) {
            $fields[] = "status_override = ?";
            $params[] = ($statusOverride === 'none' || $statusOverride === '') ? null : $statusOverride;
        }
        if (!empty($status)) {
            $fields[] = "status = ?";
            $params[] = $status;
        }

        if (empty($fields)) {
            sendError('No fields to update.');
        }

        $params[] = $userId;
        $sql = "UPDATE users SET " . implode(", ", $fields) . " WHERE id = ?";
        $stmt = $db->prepare($sql);
        $stmt->execute($params);

        // Fetch fresh user details
        $stmtFresh = $db->prepare("SELECT id, email, username, role, status, status_override FROM users WHERE id = ?");
        $stmtFresh->execute([$userId]);
        $freshUser = $stmtFresh->fetch();

        // Regenerate JWT token since role might have changed
        $payload = [
            'id' => $freshUser['id'],
            'email' => $freshUser['email'],
            'username' => $freshUser['username'],
            'role' => $freshUser['role']
        ];
        $token = encodeJWT($payload);

        sendResponse([
            'message' => 'Settings updated successfully',
            'token' => $token,
            'user' => array_merge($freshUser, [
                'is_admin_eligible' => (strtolower($freshUser['email']) === 'piyushpilkhwal74@gmail.com')
            ])
        ]);

    } elseif ($action === 'heartbeat') {
        $user = getAuthUser();
        if (!$user) {
            sendError('Access denied. Authentication required.', 401);
        }
        $userId = $user['id'];
        $isPlaying = isset($input['is_playing']) ? (bool)$input['is_playing'] : false;
        
        // Fetch status_override first
        $stmt = $db->prepare("SELECT status_override FROM users WHERE id = ?");
        $stmt->execute([$userId]);
        $dbUser = $stmt->fetch();
        
        $status = 'active';
        if ($dbUser && $dbUser['status_override']) {
            $status = $dbUser['status_override'];
        } else {
            $status = $isPlaying ? 'listening' : 'active';
        }
        
        // Update user status and last_seen_at
        $update = $db->prepare("UPDATE users SET status = ?, last_seen_at = CURRENT_TIMESTAMP() WHERE id = ?");
        $update->execute([$status, $userId]);
        
        // Fetch pending room invitations (do not auto-join)
        $stmtInvite = $db->prepare("
            SELECT ri.room_code, u.username as inviter_name 
            FROM room_invitations ri
            JOIN rooms r ON ri.room_code = r.code
            JOIN users u ON ri.inviter_id = u.id
            WHERE ri.invitee_id = ? AND ri.status = 'pending' 
            LIMIT 1
        ");
        $stmtInvite->execute([$userId]);
        $invite = $stmtInvite->fetch();
        
        $pendingInvite = null;
        if ($invite) {
            $pendingInvite = [
                'room_code' => $invite['room_code'],
                'inviter_name' => $invite['inviter_name']
            ];
        }

        // Read broadcast message
        $broadcastMessage = null;
        if (file_exists('broadcast.json')) {
            $bcData = json_decode(@file_get_contents('broadcast.json'), true);
            if ($bcData && isset($bcData['message']) && (time() - (int)$bcData['timestamp'] < 20)) {
                $broadcastMessage = $bcData['message'];
            }
        }
        
        sendResponse([
            'status' => $status,
            'pending_invite' => $pendingInvite,
            'broadcast' => $broadcastMessage
        ]);

    } else {
        sendError('Invalid POST action.', 404);
    }
} elseif ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if ($action === 'me') {
        $user = getAuthUser();
        if (!$user) {
            sendError('Access denied. Invalid or missing token.', 401);
        }

        // Fetch fresh details from database
        $stmt = $db->prepare("SELECT id, email, username, role, status, status_override, created_at FROM users WHERE id = ?");
        $stmt->execute([$user['id']]);
        $dbUser = $stmt->fetch();

        if (!$dbUser) {
            sendError('User not found.', 404);
        }

        sendResponse(['user' => array_merge($dbUser, [
            'is_admin_eligible' => (strtolower($dbUser['email']) === 'piyushpilkhwal74@gmail.com')
        ])]);
    } else {
        sendError('Invalid GET action.', 404);
    }
} else {
    sendError('Request method not supported.', 405);
}
?>
