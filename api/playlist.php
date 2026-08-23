<?php
// SyncTune Playlist Management API
// URL patterns:
// GET:  /backend/api/playlist.php?action=list
// POST: /backend/api/playlist.php?action=create     (payload: {name})
// POST: /backend/api/playlist.php?action=delete     (payload: {playlistId})
// GET:  /backend/api/playlist.php?action=getTracks  (query: ?playlistId=X)
// POST: /backend/api/playlist.php?action=addTrack    (payload: {playlistId, videoId, title, artist, thumbnail, duration})
// POST: /backend/api/playlist.php?action=removeTrack (payload: {playlistId, trackId})

require_once 'config.php';
require_once 'db.php';

// Verify Auth Token
$user = getAuthUser();
if (!$user) {
    sendError('Access denied. Authentication required.', 401);
}

$db = DB::connect();
$userId = $user['id'];
$action = isset($_GET['action']) ? $_GET['action'] : '';

// Safe Auto-Migration without foreign keys for 100% portability across MySQL engines
try {
    $db->exec("CREATE TABLE IF NOT EXISTS playlists (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        name VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) DEFAULT CHARSET=utf8mb4;");

    $db->exec("CREATE TABLE IF NOT EXISTS playlist_tracks (
        id INT AUTO_INCREMENT PRIMARY KEY,
        playlist_id INT NOT NULL,
        video_id VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        artist VARCHAR(100) NOT NULL,
        thumbnail VARCHAR(255) NOT NULL,
        duration INT DEFAULT 0,
        added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) DEFAULT CHARSET=utf8mb4;");
} catch (PDOException $e) {
    // Fail silently in background
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    
    if ($action === 'create') {
        $name = isset($input['name']) ? trim($input['name']) : '';
        if (empty($name)) {
            sendError('Playlist name is required.');
        }
        $stmt = $db->prepare("INSERT INTO playlists (user_id, name) VALUES (?, ?)");
        $stmt->execute([$userId, $name]);
        sendResponse(['message' => 'Playlist created successfully.', 'playlistId' => $db->lastInsertId()]);
        
    } elseif ($action === 'delete') {
        $playlistId = isset($input['playlistId']) ? (int)$input['playlistId'] : 0;
        if ($playlistId <= 0) {
            sendError('Invalid playlist ID.');
        }
        // Verify ownership
        $stmt = $db->prepare("SELECT id FROM playlists WHERE id = ? AND user_id = ?");
        $stmt->execute([$playlistId, $userId]);
        if (!$stmt->fetch()) {
            sendError('Playlist not found or access denied.', 403);
        }
        // Delete playlist
        $stmt = $db->prepare("DELETE FROM playlists WHERE id = ?");
        $stmt->execute([$playlistId]);
        // Delete tracks programmatically to preserve MyISAM engine portability
        $stmt = $db->prepare("DELETE FROM playlist_tracks WHERE playlist_id = ?");
        $stmt->execute([$playlistId]);
        sendResponse(['message' => 'Playlist deleted successfully.']);
        
    } elseif ($action === 'addTrack') {
        $playlistId = isset($input['playlistId']) ? (int)$input['playlistId'] : 0;
        $videoId = isset($input['videoId']) ? trim($input['videoId']) : '';
        $title = isset($input['title']) ? trim($input['title']) : '';
        $artist = isset($input['artist']) ? trim($input['artist']) : '';
        $thumbnail = isset($input['thumbnail']) ? trim($input['thumbnail']) : '';
        $duration = isset($input['duration']) ? (int)$input['duration'] : 0;

        if ($playlistId <= 0 || empty($videoId) || empty($title)) {
            sendError('Invalid track or playlist data.');
        }
        // Verify ownership of the playlist
        $stmt = $db->prepare("SELECT id FROM playlists WHERE id = ? AND user_id = ?");
        $stmt->execute([$playlistId, $userId]);
        if (!$stmt->fetch()) {
            sendError('Playlist not found or access denied.', 403);
        }
        // Avoid duplicate tracks inside the same playlist
        $stmt = $db->prepare("SELECT id FROM playlist_tracks WHERE playlist_id = ? AND video_id = ?");
        $stmt->execute([$playlistId, $videoId]);
        if ($stmt->fetch()) {
            sendError('Track already exists in this playlist.');
        }
        // Add track
        $stmt = $db->prepare("INSERT INTO playlist_tracks (playlist_id, video_id, title, artist, thumbnail, duration) VALUES (?, ?, ?, ?, ?, ?)");
        $stmt->execute([$playlistId, $videoId, $title, $artist, $thumbnail, $duration]);
        sendResponse(['message' => 'Track added to playlist successfully.']);
        
    } elseif ($action === 'removeTrack') {
        $playlistId = isset($input['playlistId']) ? (int)$input['playlistId'] : 0;
        $trackId = isset($input['trackId']) ? (int)$input['trackId'] : 0;

        if ($playlistId <= 0 || $trackId <= 0) {
            sendError('Invalid request parameters.');
        }
        // Verify ownership of the playlist
        $stmt = $db->prepare("SELECT id FROM playlists WHERE id = ? AND user_id = ?");
        $stmt->execute([$playlistId, $userId]);
        if (!$stmt->fetch()) {
            sendError('Playlist not found or access denied.', 403);
        }
        // Remove track
        $stmt = $db->prepare("DELETE FROM playlist_tracks WHERE id = ? AND playlist_id = ?");
        $stmt->execute([$trackId, $playlistId]);
        sendResponse(['message' => 'Track removed from playlist successfully.']);
        
    } else {
        sendError('Invalid action for POST.');
    }
} elseif ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if ($action === 'list') {
        $stmt = $db->prepare("SELECT * FROM playlists WHERE user_id = ? ORDER BY created_at DESC");
        $stmt->execute([$userId]);
        $playlists = $stmt->fetchAll(PDO::FETCH_ASSOC);
        sendResponse(['playlists' => $playlists]);
        
    } elseif ($action === 'getTracks') {
        $playlistId = isset($_GET['playlistId']) ? (int)$_GET['playlistId'] : 0;
        if ($playlistId <= 0) {
            sendError('Invalid playlist ID.');
        }
        // Verify ownership of the playlist
        $stmt = $db->prepare("SELECT id FROM playlists WHERE id = ? AND user_id = ?");
        $stmt->execute([$playlistId, $userId]);
        if (!$stmt->fetch()) {
            sendError('Playlist not found or access denied.', 403);
        }
        $stmt = $db->prepare("SELECT * FROM playlist_tracks WHERE playlist_id = ? ORDER BY added_at ASC");
        $stmt->execute([$playlistId]);
        $tracks = $stmt->fetchAll(PDO::FETCH_ASSOC);
        sendResponse(['tracks' => $tracks]);
        
    } else {
        sendError('Invalid action for GET.');
    }
} else {
    sendError('Invalid request method.', 405);
}
?>
