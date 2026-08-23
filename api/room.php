<?php



// SyncTune Group Room Synchronization API



// URL patterns:



// POST: /backend/api/room.php?action=create



// POST: /backend/api/room.php?action=join



// POST: /backend/api/room.php?action=leave



// POST: /backend/api/room.php?action=sync



// POST: /backend/api/room.php?action=chat



// GET:  /backend/api/room.php?action=poll&code=ROOM_CODE







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







// Generate a random 6-character room code



function generateRoomCode() {



    $chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';



    $code = '';



    for ($i = 0; $i < 6; $i++) {



        $code .= $chars[rand(0, strlen($chars) - 1)];



    }



    return $code;



}







if ($_SERVER['REQUEST_METHOD'] === 'POST') {



    $input = json_decode(file_get_contents('php://input'), true);







    if ($action === 'create') {



        // Create new room



        $code = generateRoomCode();



        



        // Ensure code is unique



        $check = $db->prepare("SELECT code FROM rooms WHERE code = ?");



        while (true) {



            $check->execute([$code]);



            if (!$check->fetch()) {



                break;



            }



            $code = generateRoomCode();



        }







        // Retrieve custom room settings from the input body



        $anyoneCanPlay = isset($input['anyoneCanPlay']) ? (int)$input['anyoneCanPlay'] : 1;



        $stealthMode = isset($input['stealthMode']) ? (int)$input['stealthMode'] : (($user['role'] === 'admin') ? 1 : 0);







        // Insert room (using PHP time to prevent database clock drift)



        try {



            $stmt = $db->prepare("INSERT INTO rooms (code, host_id, last_updated_by, last_updated_at, anyone_can_play) VALUES (?, ?, ?, FROM_UNIXTIME(?), ?)");



            $stmt->execute([$code, $userId, $userId, time(), $anyoneCanPlay]);



        } catch (PDOException $e) {



            // Fallback for older schema if column is missing



            $stmt = $db->prepare("INSERT INTO rooms (code, host_id, last_updated_by, last_updated_at) VALUES (?, ?, ?, FROM_UNIXTIME(?))");



            $stmt->execute([$code, $userId, $userId, time()]);



        }







        // Auto-join member with custom stealth mode



        $join = $db->prepare("INSERT INTO room_members (room_code, user_id, is_hidden) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE last_seen_at = CURRENT_TIMESTAMP(), is_hidden = ?");



        $join->execute([$code, $userId, $stealthMode, $stealthMode]);







        sendResponse([



            'message' => 'Room created successfully',



            'room' => [



                'code' => $code,



                'hostId' => $userId,



                'hostName' => $user['username'],



                'isStealth' => $stealthMode



            ]



        ], 201);







    } elseif ($action === 'join') {



        $code = isset($input['code']) ? strtoupper(trim($input['code'])) : '';



        if (empty($code)) {



            sendError('Room code is required.');



        }







        // Check if room exists



        $stmt = $db->prepare("



            SELECT r.*, u.username as host_name 



            FROM rooms r 



            JOIN users u ON r.host_id = u.id 



            WHERE r.code = ?



        ");



        $stmt->execute([$code]);



        $room = $stmt->fetch();







        if (!$room) {



            sendError('Room not found or has been closed.');



        }







        // Join the room member



        $isHidden = ($user['role'] === 'admin') ? 1 : 0;



        $join = $db->prepare("INSERT INTO room_members (room_code, user_id, is_hidden) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE last_seen_at = CURRENT_TIMESTAMP(), is_hidden = ?");



        $join->execute([$code, $userId, $isHidden, $isHidden]);







        // Delete pending invitation for this user to this room



        $delInvite = $db->prepare("DELETE FROM room_invitations WHERE room_code = ? AND invitee_id = ?");



        $delInvite->execute([$code, $userId]);







        sendResponse([



            'message' => 'Joined room successfully',



            'room' => [



                'code' => $room['code'],



                'hostId' => $room['host_id'],



                'hostName' => $room['host_name'],



                'isStealth' => $isHidden



            ]



        ]);







    } elseif ($action === 'leave') {



        $code = isset($input['code']) ? strtoupper(trim($input['code'])) : '';



        if (empty($code)) {



            sendError('Room code is required.');



        }







        // Remove user from room members



        $leave = $db->prepare("DELETE FROM room_members WHERE room_code = ? AND user_id = ?");



        $leave->execute([$code, $userId]);







        // If the user was the host, close the room



        $stmt = $db->prepare("SELECT host_id FROM rooms WHERE code = ?");



        $stmt->execute([$code]);



        $room = $stmt->fetch();







        // Check if room is now empty (no remaining members)



        $stmtCount = $db->prepare("SELECT COUNT(*) as cnt FROM room_members WHERE room_code = ?");



        $stmtCount->execute([$code]);



        $countResult = $stmtCount->fetch();



        $memberCount = $countResult ? (int)$countResult['cnt'] : 0;







        if ($room && (int)$room['host_id'] === $userId) {



            // Host left: delete room regardless of remaining members (cascade will handle members)



            $delete = $db->prepare("DELETE FROM rooms WHERE code = ?");



            $delete->execute([$code]);



            sendResponse(['message' => 'Host left. Room closed successfully.']);



        } elseif ($memberCount === 0) {



            // No members left: delete the room (host may have already left or was another user)



            $delete = $db->prepare("DELETE FROM rooms WHERE code = ?");



            $delete->execute([$code]);



            sendResponse(['message' => 'Last participant left. Room closed successfully.']);



        } else {



            // Regular leave



            sendResponse(['message' => 'Left room successfully.']);



        }







    } elseif ($action === 'sync') {



        $code = isset($input['code']) ? strtoupper(trim($input['code'])) : '';



        if (empty($code)) {



            sendError('Room code is required.');



        }







        // Verify host and room settings safely (without crashing if column doesn't exist yet)



        $room = null;



        try {



            $stmt = $db->prepare("SELECT host_id, anyone_can_play, allow_listener_control FROM rooms WHERE code = ?");



            $stmt->execute([$code]);



            $room = $stmt->fetch();



        } catch (PDOException $e) {



            // Fallback for older schema without allow_listener_control



            $stmt = $db->prepare("SELECT host_id, anyone_can_play FROM rooms WHERE code = ?");



            $stmt->execute([$code]);



            $room = $stmt->fetch();



        }



        if (!$room) {



            sendError('Room not found.', 404);



        }



        // Determine if listener control is enforced



        $allowListenerControl = isset($room['allow_listener_control']) ? (int)$room['allow_listener_control'] : 1;



        if ((int)$room['host_id'] !== $userId) {



            // If not host, check if anyone can play is enabled



            $anyoneCanPlay = isset($room['anyone_can_play']) ? (int)$room['anyone_can_play'] : 1;



            if ($anyoneCanPlay !== 1) {



                sendError('Unauthorized. Only the room host can synchronize playback.', 403);



            }



            // If listener control disabled, block non-host playback changes



            if ($allowListenerControl !== 1) {



                sendError('Playback control is restricted to the host.', 403);



            }



            // Verify member membership



            $stmtMember = $db->prepare("SELECT id FROM room_members WHERE room_code = ? AND user_id = ?");



            $stmtMember->execute([$code, $userId]);



            if (!$stmtMember->fetch()) {



                sendError('Access denied. You must be in the room to play songs.', 403);



            }



        }







        // Parse incoming state



        $songId        = isset($input['songId'])        ? trim($input['songId'])        : null;



        $songTitle     = isset($input['songTitle'])     ? trim($input['songTitle'])     : null;



        $songArtist    = isset($input['songArtist'])    ? trim($input['songArtist'])    : null;



        $songThumbnail = isset($input['songThumbnail']) ? trim($input['songThumbnail']) : null;



        $songDuration  = isset($input['songDuration'])  ? (int)$input['songDuration']   : null;



        $isPlaying     = isset($input['isPlaying'])     ? (int)$input['isPlaying']      : 0;



        $currentTime   = isset($input['currentTime'])   ? (float)$input['currentTime']  : 0.0;
        $isCinema      = isset($input['isCinema'])      ? (int)$input['isCinema']       : 0;







        // Fetch current room state to compare



        $stmtCurrent = $db->prepare("



            SELECT song_id, is_playing, `current_time`, UNIX_TIMESTAMP(last_updated_at) as last_updated_epoch, action_id



            FROM rooms



            WHERE code = ?



        ");



        $stmtCurrent->execute([$code]);



        $currentRoomState = $stmtCurrent->fetch();







        $actionId = 0;



        if ($currentRoomState) {



            $actionId = isset($currentRoomState['action_id']) ? (int)$currentRoomState['action_id'] : 0;



            



            // Check if this is an explicit action:



            // 1. Song changed



            $songChanged = ($songId !== $currentRoomState['song_id']);



            



            // 2. Play/Pause state changed



            $playPauseChanged = ($isPlaying !== (int)$currentRoomState['is_playing']);



            



            // 3. Manual seek (time changed by more than 3.0s from expected tick)



            $seekChanged = false;



            if (!$songChanged && !$playPauseChanged && (int)$currentRoomState['is_playing'] === 1) {



                $lastUpdatedEpoch = (int)$currentRoomState['last_updated_epoch'];



                $expectedCurrentTime = (float)$currentRoomState['current_time'] + (time() - $lastUpdatedEpoch);



                if (abs($currentTime - $expectedCurrentTime) > 3.0) {



                    $seekChanged = true;



                }



            }



            



            if ($songChanged || $playPauseChanged || $seekChanged) {



                $actionId++;



            }



        }







        // Reliable full-state update - updates action_id only on explicit action, sets last_updated_by.



        $update = $db->prepare("



            UPDATE rooms
            SET song_id = ?, song_title = ?, song_artist = ?, song_thumbnail = ?,
                song_duration = ?, is_playing = ?, `current_time` = ?,
                last_updated_at = FROM_UNIXTIME(?), action_id = ?, last_updated_by = ?,
                is_cinema = ?
            WHERE code = ?



        ");



        $update->execute([
            $songId, $songTitle, $songArtist, $songThumbnail,
            $songDuration, $isPlaying, $currentTime, time(), $actionId, $userId, $isCinema, $code
        ]);







        sendResponse(['message' => 'Room synchronized successfully']);







    } elseif ($action === 'chat') {



        $code = isset($input['code']) ? strtoupper(trim($input['code'])) : '';



        $message = isset($input['message']) ? trim($input['message']) : '';







        if (empty($code) || empty($message)) {



            sendError('Room code and message content are required.');



        }







        // Check if user is a member of this room



        $stmt = $db->prepare("SELECT id FROM room_members WHERE room_code = ? AND user_id = ?");



        $stmt->execute([$code, $userId]);



        if (!$stmt->fetch()) {



            sendError('Access denied. You must be in the room to chat.', 403);



        }







        // Insert chat



        $chat = $db->prepare("INSERT INTO room_chats (room_code, user_id, message) VALUES (?, ?, ?)");



        $chat->execute([$code, $userId, $message]);







        sendResponse(['message' => 'Message sent successfully']);



        



    } elseif ($action === 'stealth_toggle') {



        $code = isset($input['code']) ? strtoupper(trim($input['code'])) : '';



        $reveal = isset($input['reveal']) ? (int)$input['reveal'] : 0; // 1 means visible (is_hidden = 0), 0 means stealth (is_hidden = 1)



        



        if (empty($code)) {



            sendError('Room code is required.');



        }



        



        $isHidden = $reveal ? 0 : 1;



        



        $update = $db->prepare("UPDATE room_members SET is_hidden = ? WHERE room_code = ? AND user_id = ?");



        $update->execute([$isHidden, $code, $userId]);



        



    } elseif ($action === 'settings_toggle') {



        $code = isset($input['code']) ? strtoupper(trim($input['code'])) : '';



        $anyoneCanPlay = isset($input['anyoneCanPlay']) ? (int)$input['anyoneCanPlay'] : 1;



        



        if (empty($code)) {



            sendError('Room code is required.');



        }



        



        // Verify host status



        $stmt = $db->prepare("SELECT host_id FROM rooms WHERE code = ?");



        $stmt->execute([$code]);



        $room = $stmt->fetch();



        



        if (!$room) {



            sendError('Room not found.', 404);



        }



        



        if ((int)$room['host_id'] !== $userId) {



            sendError('Unauthorized. Only the room host can change settings.', 403);



        }



        



        try {



            $update = $db->prepare("UPDATE rooms SET anyone_can_play = ? WHERE code = ?");



            $update->execute([$anyoneCanPlay, $code]);



        } catch (PDOException $e) {



            // Self-repair column schema if missing



            try {



                $db->exec("ALTER TABLE rooms ADD COLUMN anyone_can_play TINYINT DEFAULT 1");



                $update = $db->prepare("UPDATE rooms SET anyone_can_play = ? WHERE code = ?");



                $update->execute([$anyoneCanPlay, $code]);



            } catch (PDOException $e2) {



                // Ignore and proceed



            }



        }



        



        sendResponse([



            'message' => 'Room settings updated successfully',



            'anyoneCanPlay' => $anyoneCanPlay



        ]);



        



    } elseif ($action === 'invite') {



        $code = isset($input['code']) ? strtoupper(trim($input['code'])) : '';



        $friendId = isset($input['friendId']) ? (int)$input['friendId'] : 0;



        



        if (empty($code) || $friendId <= 0) {



            sendError('Room code and friend user ID are required.');



        }



        



        // Check if room exists



        $stmt = $db->prepare("SELECT code FROM rooms WHERE code = ?");



        $stmt->execute([$code]);



        if (!$stmt->fetch()) {



            sendError('Room not found.');



        }



        



        // Ensure they are friends



        $stmtFriend = $db->prepare("



            SELECT id FROM friends 



            WHERE ((user_id = ? AND friend_user_id = ?) OR (user_id = ? AND friend_user_id = ?)) 



              AND status = 'accepted'



        ");



        $stmtFriend->execute([$userId, $friendId, $friendId, $userId]);



        if (!$stmtFriend->fetch()) {



            sendError('You can only invite accepted friends.');



        }



        



        // Insert invitation



        $stmtInvite = $db->prepare("



            INSERT INTO room_invitations (room_code, inviter_id, invitee_id) 



            VALUES (?, ?, ?) 



            ON DUPLICATE KEY UPDATE status = 'pending', created_at = CURRENT_TIMESTAMP()



        ");



        $stmtInvite->execute([$code, $userId, $friendId]);



        



        sendResponse(['message' => 'Invitation sent successfully']);



        



    } elseif ($action === 'reject_invite') {



        $inviteId = isset($input['inviteId']) ? (int)$input['inviteId'] : 0;



        if ($inviteId <= 0) {



            sendError('Invalid invite ID.');



        }



        $stmt = $db->prepare("DELETE FROM room_invitations WHERE id = ? AND invitee_id = ?");



        $stmt->execute([$inviteId, $userId]);



        sendResponse(['message' => 'Invitation declined successfully.']);



        



    } else {



        sendError('Invalid action.', 404);



    }



} elseif ($_SERVER['REQUEST_METHOD'] === 'GET') {



    if ($action === 'poll') {



        $code = isset($_GET['code']) ? strtoupper(trim($_GET['code'])) : '';



        if (empty($code)) {



            sendError('Room code is required.');



        }







        // 1. Update member heartbeat (only insert if not exists, or update if last_seen_at is older than 20 seconds)
        $check = $db->prepare("SELECT last_seen_at FROM room_members WHERE room_code = ? AND user_id = ?");
        $check->execute([$code, $userId]);
        $row = $check->fetch();
        if (!$row) {
            $db->prepare("INSERT INTO room_members (room_code, user_id) VALUES (?, ?)")->execute([$code, $userId]);
        } else {
            $lastSeen = strtotime($row['last_seen_at']);
            if (time() - $lastSeen > 20) {
                $db->prepare("UPDATE room_members SET last_seen_at = CURRENT_TIMESTAMP() WHERE room_code = ? AND user_id = ?")->execute([$code, $userId]);
            }
        }







        // 2. Fetch Room Details



        $room = null;



        try {



            $stmtRoom = $db->prepare("



                SELECT r.*, UNIX_TIMESTAMP(r.last_updated_at) as last_updated_epoch,



                       u.username as host_name,



                       COALESCE(r.action_id, 0) as action_id



                FROM rooms r



                JOIN users u ON r.host_id = u.id



                WHERE r.code = ?



            ");



            $stmtRoom->execute([$code]);



            $room = $stmtRoom->fetch();



        } catch (PDOException $e) {



            $stmtRoom = $db->prepare("



                SELECT r.*, UNIX_TIMESTAMP(r.last_updated_at) as last_updated_epoch,



                       u.username as host_name



                FROM rooms r



                JOIN users u ON r.host_id = u.id



                WHERE r.code = ?



            ");



            $stmtRoom->execute([$code]);



            $room = $stmtRoom->fetch();



        }







        if (!$room) {



            sendError('Room closed or not found.', 404);



        }







        // 3. Clean up stale members (timeout = 25s to match 7s poll interval + buffer)



        $cleanup = $db->prepare("



            DELETE FROM room_members



            WHERE room_code = ?



            AND last_seen_at < DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 25 SECOND)



        ");



        $cleanup->execute([$code]);







        // 3b. Auto-destroy room if no members remain (everyone disconnected without leaving)



        $countStmt = $db->prepare("SELECT COUNT(*) as cnt FROM room_members WHERE room_code = ?");



        $countStmt->execute([$code]);



        $memberCount = (int)$countStmt->fetch()['cnt'];



        if ($memberCount === 0) {



            $db->prepare("DELETE FROM rooms WHERE code = ?")->execute([$code]);



            sendError('Room closed — all members disconnected.', 404);



        }







        // 4. Fetch Active Members in room



        $stmtMembers = $db->prepare("



            SELECT u.id, u.username, rm.is_hidden, (u.id = r.host_id) as is_host



            FROM room_members rm 



            JOIN users u ON rm.user_id = u.id 



            JOIN rooms r ON rm.room_code = r.code



            WHERE rm.room_code = ?



            ORDER BY is_host DESC, u.username ASC



        ");



        $stmtMembers->execute([$code]);



        $membersList = $stmtMembers->fetchAll();



        



        $members = [];



        $requesterIsAdmin = ($user['role'] === 'admin');



        foreach ($membersList as $m) {



            if ((int)$m['is_hidden'] === 1) {



                // Only show hidden admin to admins or to themselves



                if ($requesterIsAdmin || $userId == $m['id']) {



                    $members[] = $m;



                }



            } else {



                $members[] = $m;



            }



        }







        // 5. Fetch Chat Messages (latest 30 messages in room)



        $stmtChats = $db->prepare("



            SELECT rc.id, rc.message, rc.sent_at, u.username, u.role, (u.id = ?) as is_me



            FROM room_chats rc 



            JOIN users u ON rc.user_id = u.id 



            WHERE rc.room_code = ? 



            ORDER BY rc.sent_at ASC 



            LIMIT 40



        ");



        $stmtChats->execute([$userId, $code]);



        $chats = $stmtChats->fetchAll();







        // 6. Calculate synchronized seek time for member



        // If playing: seekTime = current_time + (now - last_updated_at)



        $seekTime = (float)$room['current_time'];



        if ((int)$room['is_playing'] === 1) {



            $lastUpdated = isset($room['last_updated_epoch']) ? (int)$room['last_updated_epoch'] : strtotime($room['last_updated_at']);



            $now = time();



            $timeDifference = max(0, $now - $lastUpdated);



            $seekTime += $timeDifference;



            



            // Cap at song duration



            if ($room['song_duration'] !== null && $seekTime > (int)$room['song_duration']) {



                $seekTime = (int)$room['song_duration'];



            }



        }







        sendResponse([



            'room' => [



                'code'         => $room['code'],



                'hostId'       => (int)$room['host_id'],



                'hostName'     => $room['host_name'],



                'songId'       => $room['song_id'],



                'songTitle'    => $room['song_title'],



                'songArtist'   => $room['song_artist'],



                'songThumbnail'=> $room['song_thumbnail'],



                'songDuration' => $room['song_duration'] ? (int)$room['song_duration'] : null,



                'isPlaying'    => (int)$room['is_playing'],



                'currentTime'  => (float)$room['current_time'],



                'syncTime'     => $seekTime,



                'actionId'     => isset($room['action_id']) ? (int)$room['action_id'] : 0,



                'lastUpdatedBy'=> isset($room['last_updated_by']) ? (int)$room['last_updated_by'] : (int)$room['host_id'],



                'anyoneCanPlay'=> isset($room['anyone_can_play']) ? ((int)$room['anyone_can_play'] === 1) : true,
                'isCinema'     => isset($room['is_cinema']) ? (int)$room['is_cinema'] : 0



            ],



            'members' => $members,



            'chats'   => $chats



        ]);



    } elseif ($action === 'list_invites') {



        // Fetch all pending invites for this user



        $stmt = $db->prepare("



            SELECT ri.id as invite_id, ri.room_code, u.username as inviter_name, r.song_title, r.song_artist



            FROM room_invitations ri



            JOIN users u ON ri.inviter_id = u.id



            JOIN rooms r ON ri.room_code = r.code



            WHERE ri.invitee_id = ? AND ri.status = 'pending'



            ORDER BY ri.created_at DESC



        ");



        $stmt->execute([$userId]);



        $invites = $stmt->fetchAll(PDO::FETCH_ASSOC);



        sendResponse(['invites' => $invites]);

    } elseif ($action === 'reject_invite') {
        $code = isset($input['code']) ? strtoupper(trim($input['code'])) : '';
        if (empty($code)) {
            sendError('Room code is required.');
        }
        $stmt = $db->prepare("DELETE FROM room_invitations WHERE room_code = ? AND invitee_id = ?");
        $stmt->execute([$code, $userId]);
        sendResponse(['message' => 'Invitation rejected successfully.']);

    } else {



        sendError('Invalid action.', 404);



    }



} else {



    sendError('Request method not supported.', 405);



}



?>



