<?php
// SyncTune Real-Time Server-Sent Events (SSE) Room Syncer
// URL: /backend/api/room_events.php?code=ROOM_CODE&token=TOKEN

// 1. Spoof HTTP_AUTHORIZATION from GET parameter so getAuthUser() works with EventSource
if (isset($_GET['token'])) {
    $_SERVER['HTTP_AUTHORIZATION'] = 'Bearer ' . $_GET['token'];
}

require_once 'config.php';
require_once 'db.php';

// 2. Disable PHP output buffering so bytes are flushed immediately
while (ob_get_level()) {
    ob_end_flush();
}
ob_implicit_flush(true);

// 3. Set SSE headers (overriding JSON headers from config.php)
header('Content-Type: text/event-stream');
header('Cache-Control: no-cache');
header('Connection: keep-alive');
header('X-Accel-Buffering: no');

$user = getAuthUser();
if (!$user) {
    echo "event: error\ndata: {\"error\": \"Access denied. Authentication required.\"}\n\n";
    exit();
}

$db = DB::connect();
$userId = $user['id'];
$code = isset($_GET['code']) ? strtoupper(trim($_GET['code'])) : '';

if (empty($code)) {
    echo "event: error\ndata: {\"error\": \"Room code is required.\"}\n\n";
    exit();
}

// Prepare SQL statements once outside the loop for high efficiency
$stmtRoom = $db->prepare("
    SELECT r.*, UNIX_TIMESTAMP(r.last_updated_at) as last_updated_epoch,
           u.username as host_name,
           COALESCE(r.action_id, 0) as action_id
    FROM rooms r
    JOIN users u ON r.host_id = u.id
    WHERE r.code = ?
");

$stmtMembers = $db->prepare("
    SELECT u.id, u.username, rm.is_hidden, (u.id = r.host_id) as is_host
    FROM room_members rm 
    JOIN users u ON rm.user_id = u.id 
    JOIN rooms r ON rm.room_code = r.code
    WHERE rm.room_code = ?
    ORDER BY is_host DESC, u.username ASC
");

$stmtChats = $db->prepare("
    SELECT rc.id, rc.message, rc.sent_at, u.username, u.role, (u.id = ?) as is_me
    FROM room_chats rc 
    JOIN users u ON rc.user_id = u.id 
    WHERE rc.room_code = ? 
    ORDER BY rc.sent_at ASC 
    LIMIT 40
");

$heartbeat = $db->prepare("
    INSERT INTO room_members (room_code, user_id)
    VALUES (?, ?)
    ON DUPLICATE KEY UPDATE last_seen_at = CURRENT_TIMESTAMP()
");

$cleanup = $db->prepare("
    DELETE FROM room_members
    WHERE room_code = ?
    AND last_seen_at < DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 25 SECOND)
");

$countStmt = $db->prepare("SELECT COUNT(*) as cnt FROM room_members WHERE room_code = ?");
$deleteStmt = $db->prepare("DELETE FROM rooms WHERE code = ?");

// Initialize state tracking variables
$lastRoomStateHash = '';
$lastMembersHash = '';
$lastChatsHash = '';
$lastHeartbeat = 0;
$lastKeepalive = time();

// Keepalive function
function sendKeepalive() {
    echo ": keepalive\n\n";
    ob_flush();
    flush();
}

// Initial update immediately on connect
$heartbeat->execute([$code, $userId]);
$lastHeartbeat = time();

while (connection_status() === 0 && !connection_aborted()) {
    // 1. Heartbeat to keep member alive (every 5 seconds)
    if (time() - $lastHeartbeat >= 5) {
        $heartbeat->execute([$code, $userId]);
        $cleanup->execute([$code]);
        $lastHeartbeat = time();
        
        // Auto-destroy room if no members remain
        $countStmt->execute([$code]);
        $memberCountRes = $countStmt->fetch();
        $memberCount = $memberCountRes ? (int)$memberCountRes['cnt'] : 0;
        if ($memberCount === 0) {
            $deleteStmt->execute([$code]);
            echo "event: close\ndata: {\"message\": \"Room closed\"}\n\n";
            ob_flush();
            flush();
            break;
        }
    }
    
    // 2. Fetch Room details
    $stmtRoom->execute([$code]);
    $room = $stmtRoom->fetch();
    
    if (!$room) {
        echo "event: close\ndata: {\"message\": \"Room closed\"}\n\n";
        ob_flush();
        flush();
        break;
    }
    
    // Calculate sync time
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
    
    // Build room payload to push (contains dynamic syncTime)
    $roomPayload = [
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
        'anyoneCanPlay'=> isset($room['anyone_can_play']) ? ((int)$room['anyone_can_play'] === 1) : true
    ];
    
    // Build comparison payload (EXCLUDES dynamic syncTime to prevent spamming updates every second)
    $roomComparePayload = [
        'code'         => $room['code'],
        'hostId'       => (int)$room['host_id'],
        'songId'       => $room['song_id'],
        'songTitle'    => $room['song_title'],
        'songArtist'   => $room['song_artist'],
        'songThumbnail'=> $room['song_thumbnail'],
        'songDuration' => $room['song_duration'] ? (int)$room['song_duration'] : null,
        'isPlaying'    => (int)$room['is_playing'],
        'currentTime'  => (float)$room['current_time'],
        'actionId'     => isset($room['action_id']) ? (int)$room['action_id'] : 0,
        'anyoneCanPlay'=> isset($room['anyone_can_play']) ? ((int)$room['anyone_can_play'] === 1) : true
    ];
    
    // Generate Room State Hash based on comparison payload
    $roomStateHash = md5(json_encode($roomComparePayload));
    
    // 3. Fetch Members
    $stmtMembers->execute([$code]);
    $membersList = $stmtMembers->fetchAll();
    
    $members = [];
    $requesterIsAdmin = ($user['role'] === 'admin');
    foreach ($membersList as $m) {
        if ((int)$m['is_hidden'] === 1) {
            if ($requesterIsAdmin || $userId == $m['id']) {
                $members[] = $m;
            }
        } else {
            $members[] = $m;
        }
    }
    $membersHash = md5(json_encode($members));
    
    // 4. Fetch Chats
    $stmtChats->execute([$userId, $code]);
    $chatsList = $stmtChats->fetchAll();
    $chatsHash = md5(json_encode($chatsList));
    
    // 5. Compare states
    if ($roomStateHash !== $lastRoomStateHash || $membersHash !== $lastMembersHash || $chatsHash !== $lastChatsHash) {
        // Prepare push payload
        $payload = [
            'room'    => $roomPayload,
            'members' => $members,
            'chats'   => $chatsList
        ];
        
        echo "data: " . json_encode($payload) . "\n\n";
        ob_flush();
        flush();
        
        $lastRoomStateHash = $roomStateHash;
        $lastMembersHash = $membersHash;
        $lastChatsHash = $chatsHash;
        $lastKeepalive = time();
    } else {
        // Send keepalive every 10 seconds of silence to keep connection open
        if (time() - $lastKeepalive >= 10) {
            sendKeepalive();
            $lastKeepalive = time();
        }
    }
    
    // Sleep for 500ms
    usleep(500000);
}
?>
