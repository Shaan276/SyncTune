<?php
// SyncTune Room Recommendation API
// Endpoint: /api/room_recommend.php
// Expects POST with JSON: { "code": "ROOMCODE", "videoId": "optional_current_video_id" }
// Returns JSON with recommendations for the given room.

require_once 'config.php';
require_once 'db.php';
require_once 'auth.php'; // assumes getAuthUser() available

$user = getAuthUser();
if (!$user) {
    sendError('Access denied. Authentication required.', 401);
}

$input = json_decode(file_get_contents('php://input'), true);
$code = isset($input['code']) ? strtoupper(trim($input['code'])) : '';
if (empty($code)) {
    sendError('Room code is required.');
}

$db = DB::connect();

// Verify user is member of room (or host) to fetch recommendations
$stmt = $db->prepare("SELECT r.id FROM rooms r JOIN room_members rm ON r.code = rm.room_code WHERE r.code = ? AND rm.user_id = ?");
$stmt->execute([$code, $user['id']]);
if (!$stmt->fetch()) {
    sendError('Access denied. Not a member of this room.', 403);
}

$videoId = isset($input['videoId']) ? trim($input['videoId']) : null;

// Check for cached recommendation
$cacheStmt = $db->prepare("SELECT recommended_json, created_at FROM room_recommendations WHERE room_code = ? AND video_id = ? ORDER BY created_at DESC LIMIT 1");
$cacheStmt->execute([$code, $videoId ?? '']);
$cached = $cacheStmt->fetch();
if ($cached) {
    $age = time() - strtotime($cached['created_at']);
    if ($age < 600) { // 10 minutes cache
        sendResponse(['cached' => true, 'recommendations' => json_decode($cached['recommended_json'], true)], 200);
    }
}

// If no cache or stale, generate fresh recommendations using existing logic from recommend.php
require_once 'recommend.php'; // assume it defines getRecommendations($videoId)
$recommendations = getRecommendations($videoId);

// Store in cache table
$insert = $db->prepare("INSERT INTO room_recommendations (room_code, video_id, recommended_json) VALUES (?, ?, ?)");
$insert->execute([$code, $videoId ?? '', json_encode($recommendations)]);

sendResponse(['cached' => false, 'recommendations' => $recommendations]);
?>
