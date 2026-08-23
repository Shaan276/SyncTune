<?php
// SyncTune Data Usage and History Logger
// URL patterns:
// GET:  /backend/api/usage.php
// POST: /backend/api/usage.php

require_once 'config.php';
require_once 'db.php';

// Verify Auth Token
$user = getAuthUser();
if (!$user) {
    sendError('Access denied. Authentication required.', 401);
}

$db = DB::connect();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    // 1. Fetch data usage details for user
    $userId = $user['id'];

    // Today's Usage
    $stmtToday = $db->prepare("SELECT bytes FROM data_usage WHERE user_id = ? AND recorded_date = CURRENT_DATE()");
    $stmtToday->execute([$userId]);
    $rowToday = $stmtToday->fetch();
    $bytesToday = $rowToday ? (int)$rowToday['bytes'] : 0;

    // This Month's Usage
    $stmtMonth = $db->prepare("
        SELECT SUM(bytes) as total_bytes 
        FROM data_usage 
        WHERE user_id = ? 
          AND recorded_date >= DATE_SUB(CURRENT_DATE(), INTERVAL DAYOFMONTH(CURRENT_DATE())-1 DAY)
    ");
    $stmtMonth->execute([$userId]);
    $rowMonth = $stmtMonth->fetch();
    $bytesMonth = $rowMonth['total_bytes'] ? (int)$rowMonth['total_bytes'] : 0;

    // Listen History grouped per song per day for dashboard history tray
    $stmtHistory = $db->prepare("
        SELECT 
            s.id, s.title, s.artist, s.duration, s.thumbnail,
            MAX(l.listened_at) as last_listened_at,
            COUNT(l.song_id) as play_count
        FROM listens l
        JOIN songs s ON l.song_id = s.id
        WHERE l.user_id = ?
        GROUP BY s.id, DATE(l.listened_at)
        ORDER BY last_listened_at DESC
        LIMIT 40
    ");
    $stmtHistory->execute([$userId]);
    $history = $stmtHistory->fetchAll(PDO::FETCH_ASSOC);

    $today = date('Y-m-d');
    $yesterday = date('Y-m-d', strtotime('-1 day'));

    foreach ($history as &$row) {
        $listenDate = date('Y-m-d', strtotime($row['last_listened_at']));
        if ($listenDate === $today) {
            $row['date_group'] = 'Today';
        } elseif ($listenDate === $yesterday) {
            $row['date_group'] = 'Yesterday';
        } else {
            $row['date_group'] = date('F j, Y', strtotime($row['last_listened_at']));
        }
        $row['play_count'] = (int)$row['play_count'];
    }
    unset($row);

    sendResponse([
        'usage' => [
            'todayBytes' => $bytesToday,
            'monthBytes' => $bytesMonth,
            'todayMB' => round($bytesToday / 1024 / 1024, 2),
            'monthMB' => round($bytesMonth / 1024 / 1024, 2)
        ],
        'history' => $history
    ]);

} elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // 2. Log data usage and/or a new play event
    $input = json_decode(file_get_contents('php://input'), true);
    $userId = $user['id'];
    
    $bytes = isset($input['bytes']) ? (int)$input['bytes'] : 0;
    $songId = isset($input['songId']) ? trim($input['songId']) : '';
    $newPlay = isset($input['newPlay']) ? (bool)$input['newPlay'] : false;

    // Start Transaction
    $db->beginTransaction();
    try {
        // A. Log/Aggregate Data Usage
        if ($bytes > 0) {
            $stmt = $db->prepare("
                INSERT INTO data_usage (user_id, bytes, recorded_date) 
                VALUES (?, ?, CURRENT_DATE()) 
                ON DUPLICATE KEY UPDATE bytes = bytes + ?
            ");
            $stmt->execute([$userId, $bytes, $bytes]);
        }

        // B. Log new playback event to listens history
        if ($newPlay && !empty($songId)) {
            // First check if the song exists in songs table (cached)
            $checkSong = $db->prepare("SELECT id FROM songs WHERE id = ?");
            $checkSong->execute([$songId]);
            if (!$checkSong->fetch()) {
                // If it doesn't exist, we can insert it if details are passed
                $title = isset($input['title']) ? trim($input['title']) : '';
                $artist = isset($input['artist']) ? trim($input['artist']) : '';
                $duration = isset($input['duration']) ? (int)$input['duration'] : 0;
                $thumbnail = isset($input['thumbnail']) ? trim($input['thumbnail']) : '';
                
                if (!empty($title)) {
                    $insertSong = $db->prepare("INSERT INTO songs (id, title, artist, duration, thumbnail) VALUES (?, ?, ?, ?, ?)");
                    $insertSong->execute([$songId, $title, $artist, $duration, $thumbnail]);
                }
            }
            
            // Recheck and insert listen record if song is in table
            $checkSong->execute([$songId]);
            if ($checkSong->fetch()) {
                $stmtListen = $db->prepare("INSERT INTO listens (user_id, song_id) VALUES (?, ?)");
                $stmtListen->execute([$userId, $songId]);
            }
        }

        $db->commit();
        sendResponse(['message' => 'Usage logged successfully']);

    } catch (Exception $e) {
        $db->rollBack();
        sendError('Failed to log usage: ' . $e->getMessage(), 500);
    }
} else {
    sendError('Request method not supported.', 405);
}
?>
