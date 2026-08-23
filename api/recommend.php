<?php

// SyncTune Music Recommendation API

// URL pattern: GET /backend/api/recommend.php?videoId=VIDEO_ID



require_once 'config.php';

require_once 'db.php';



// Verify Auth Token

$user = getAuthUser();

if (!$user) {

    sendError('Access denied. Authentication required.', 401);

}



$videoId    = isset($_GET['videoId']) ? trim($_GET['videoId']) : '';

$titleParam  = isset($_GET['title'])  ? trim($_GET['title'])   : '';

$artistParam = isset($_GET['artist']) ? trim($_GET['artist'])  : '';

$roomCode    = isset($_GET['roomCode']) ? strtoupper(trim($_GET['roomCode'])) : '';

$db = DB::connect();



if (!empty($roomCode) && !empty($videoId)) {

    try {

        $stmt = $db->prepare("SELECT recommended_json FROM room_recommendations WHERE room_code = ? AND video_id = ? ORDER BY created_at DESC LIMIT 1");

        $stmt->execute([$roomCode, $videoId]);

        $cached = $stmt->fetch();

        if ($cached) {

            $songs = json_decode($cached['recommended_json'], true);

            if (is_array($songs)) {

                sendResponse(['songs' => $songs]);

            }

        }

    } catch (Exception $e) {}

}



// Make cURL request helper

function makeCurlRequest($url) {

    return makeHttpRequest($url);

}



// Clean up artist/channel name

function cleanArtistName($name) {

    if (substr($name, -8) === " - Topic") {

        $name = substr($name, 0, -8);

    }

    if (strlen($name) > 4 && strcasecmp(substr($name, -4), "VEVO") === 0) {

        $name = substr($name, 0, -4);

    }

    return trim($name);

}



// Global Song Filtering Rules

function matchesArtist($artist1, $artist2) {
    $a1 = strtolower(trim($artist1));
    $a2 = strtolower(trim($artist2));
    if (empty($a1) || empty($a2)) return false;
    
    // Clean topic/VEVO suffixes first if any
    $a1 = str_replace(" - topic", "", $a1);
    $a2 = str_replace(" - topic", "", $a2);
    $a1 = str_replace("vevo", "", $a1);
    $a2 = str_replace("vevo", "", $a2);
    $a1 = trim($a1);
    $a2 = trim($a2);
    
    if (empty($a1) || empty($a2)) return false;
    return (strpos($a1, $a2) !== false || strpos($a2, $a1) !== false);
}

// Global Song Filtering Rules
function filterSongs($songs, $currentVideoId = '', $ignoreDurationLimit = false) {
    $filtered = [];
    $excludeKeywords = [
        'mix', 'mashup', 'compilation', 'nonstop', 'non-stop', 'full album',
        '1 hour', '10 hours', 'dj mix', 'lofi hip hop', 'medley', 'juke box',
        'jukebox', 'mega mix', 'megamix', 'lo-fi', 'non stop', 'full ep',
        'full-album', 'synthwave mix', 'sleep music', 'study music', '10hour', '1hour'
    ];
    $seenIds = [$currentVideoId];

    foreach ($songs as $song) {
        if (empty($song['id'])) continue;
        if (in_array($song['id'], $seenIds)) continue;
        
        $maxDur = $ignoreDurationLimit ? 86400 : 600;
        if ($song['duration'] < 60 || $song['duration'] > $maxDur) continue;

        $titleLower  = strtolower($song['title']);
        $artistLower = strtolower($song['artist']);
        
        if (!$ignoreDurationLimit) {
            $bad = false;
            foreach ($excludeKeywords as $kw) {
                if (strpos($titleLower, $kw) !== false || strpos($artistLower, $kw) !== false) {
                    $bad = true; break;
                }
            }
            if ($bad) continue;
        }

        $seenIds[] = $song['id'];
        $filtered[] = $song;
    }
    return $filtered;
}



// ISO 8601 duration parser

function parseISODuration($ISO8601) {

    try {

        $interval = new DateInterval($ISO8601);

        return ($interval->h * 3600) + ($interval->i * 60) + $interval->s;

    } catch (Exception $e) {

        return 240;

    }

}



// Fetch Related Videos from YouTube Music InnerTube API

function getRelatedVideos($videoId) {

    $url     = "https://music.youtube.com/youtubei/v1/next";

    $payload = [

        "context"    => ["client" => ["clientName" => "WEB_REMIX", "clientVersion" => "1.20230620.01.00"]],

        "videoId"    => $videoId,

        "playlistId" => "RDAMVM" . $videoId

    ];



    $response = null;

    if (function_exists('curl_init')) {

        $ch = curl_init($url);

        curl_setopt_array($ch, [

            CURLOPT_RETURNTRANSFER => true,

            CURLOPT_POST           => true,

            CURLOPT_POSTFIELDS     => json_encode($payload),

            CURLOPT_HTTPHEADER     => ['Content-Type: application/json', 'User-Agent: Mozilla/5.0'],

            CURLOPT_SSL_VERIFYPEER => false,

            CURLOPT_SSL_VERIFYHOST => false,

            CURLOPT_TIMEOUT        => 8,

        ]);

        $response = curl_exec($ch);

        curl_close($ch);

    } else {

        $ctx = stream_context_create([

            'http' => ['method' => 'POST', 'header' => "Content-Type: application/json\r\nUser-Agent: Mozilla/5.0\r\n",

                       'content' => json_encode($payload), 'timeout' => 8],

            'ssl'  => ['verify_peer' => false, 'verify_peer_name' => false]

        ]);

        $response = @file_get_contents($url, false, $ctx);

    }



    $results = [];

    if ($response) {

        $json = json_decode($response, true);

        if ($json) {

            try {

                $contents = $json['contents']['singleColumnMusicWatchNextResultsRenderer']

                    ['tabbedRenderer']['watchNextTabbedResultsRenderer']

                    ['tabs'][0]['tabRenderer']['content']

                    ['musicQueueRenderer']['content']

                    ['playlistPanelRenderer']['contents'] ?? [];



                foreach ($contents as $item) {

                    if (!isset($item['playlistPanelVideoRenderer'])) continue;

                    $v = $item['playlistPanelVideoRenderer'];

                    $vid = $v['videoId'] ?? '';

                    if (empty($vid)) continue;



                    $title  = $v['title']['runs'][0]['text'] ?? '';

                    $artist = '';

                    if (isset($v['longBylineText']['runs'][0]['text'])) {

                        $artist = $v['longBylineText']['runs'][0]['text'];

                    } elseif (isset($v['shortBylineText']['runs'][0]['text'])) {

                        $artist = $v['shortBylineText']['runs'][0]['text'];

                    }



                    $durText  = $v['lengthText']['runs'][0]['text'] ?? ($v['lengthText']['simpleText'] ?? '0:00');

                    $durParts = explode(':', $durText);

                    $dur = 0;

                    if (count($durParts) === 2) $dur = intval($durParts[0]) * 60 + intval($durParts[1]);

                    elseif (count($durParts) === 3) $dur = intval($durParts[0]) * 3600 + intval($durParts[1]) * 60 + intval($durParts[2]);



                    $thumb = '';

                    if (isset($v['thumbnail']['thumbnails'])) {

                        $thumbs = $v['thumbnail']['thumbnails'];

                        $thumb  = $thumbs[count($thumbs) - 1]['url'] ?? $thumbs[0]['url'] ?? '';

                    }



                    $results[] = ['id' => $vid, 'title' => $title, 'artist' => cleanArtistName($artist), 'duration' => $dur, 'thumbnail' => $thumb];

                }

            } catch (Exception $e) {}

        }

    }



    $filtered = filterSongs($results, $videoId);

    if (count($filtered) >= 5) return array_slice($filtered, 0, 15);



    // Fallback: YouTube watch page sidebar

    $html = makeCurlRequest("https://www.youtube.com/watch?v=" . urlencode($videoId));

    if ($html) {

        $extra = [];

        if (preg_match('/ytInitialData\s*=\s*({.+?});/s', $html, $m)) {

            $json = json_decode($m[1], true);

            if ($json) {

                try {

                    $sidebar = $json['contents']['twoColumnWatchNextResults']['secondaryResults']['secondaryResults']['results'] ?? [];

                    foreach ($sidebar as $item) {

                        if (!isset($item['compactVideoRenderer'])) continue;

                        $v   = $item['compactVideoRenderer'];

                        $vid = $v['videoId'] ?? '';

                        if (empty($vid)) continue;



                        $title  = $v['title']['simpleText'] ?? ($v['title']['runs'][0]['text'] ?? '');

                        $artist = cleanArtistName($v['shortBylineText']['runs'][0]['text'] ?? '');

                        $durTxt = $v['lengthText']['simpleText'] ?? '0:00';

                        $durP   = explode(':', $durTxt);

                        $dur    = count($durP) === 2 ? intval($durP[0]) * 60 + intval($durP[1]) : 0;

                        $thumb  = $v['thumbnail']['thumbnails'][0]['url'] ?? '';

                        $extra[] = ['id' => $vid, 'title' => $title, 'artist' => $artist, 'duration' => $dur, 'thumbnail' => $thumb];

                    }

                } catch (Exception $e) {}

            }

        }

        $filtered = array_merge($filtered, filterSongs($extra, $videoId));

    }



    return array_slice(array_unique($filtered, SORT_REGULAR), 0, 15);

}



// Search YouTube for recommendations by artist/query

function searchForRecs($query, $currentVideoId = '', $ignoreDurationLimit = false) {

    if (!defined('YOUTUBE_API_KEY') || empty(YOUTUBE_API_KEY)) {

        // InnerTube scrape fallback

        $url  = 'https://music.youtube.com/search?q=' . urlencode($query);

        $html = makeCurlRequest($url);

        $results = [];

        if ($html && preg_match('/ytInitialData\s*=\s*({.+?});/s', $html, $m)) {

            $json = json_decode($m[1], true);

            if ($json) {

                try {

                    $contents = $json['contents']['tabbedRenderer']['browseTabRenderer']['content']['sectionListRenderer']['contents'] ?? [];

                    $items = [];

                    foreach ($contents as $section) {

                        if (isset($section['musicShelfRenderer']['contents'])) {

                            $items = array_merge($items, $section['musicShelfRenderer']['contents']);

                        }

                    }

                    foreach ($items as $item) {

                        if (!isset($item['musicResponsiveListItemRenderer'])) continue;

                        $v   = $item['musicResponsiveListItemRenderer'];

                        $vid = $v['playlistItemData']['videoId']

                            ?? ($v['overlay']['musicItemThumbnailOverlayRenderer']['content']['musicPlayButtonRenderer']['playNavigationEndpoint']['watchEndpoint']['videoId'] ?? '');

                        if (empty($vid)) continue;

                        $title  = $v['flexColumns'][0]['musicResponsiveListItemFlexColumnRenderer']['text']['runs'][0]['text'] ?? '';

                        $artist = cleanArtistName($v['flexColumns'][1]['musicResponsiveListItemFlexColumnRenderer']['text']['runs'][0]['text'] ?? '');

                        $runs   = $v['flexColumns'][1]['musicResponsiveListItemFlexColumnRenderer']['text']['runs'] ?? [];

                        $durTxt = trim(end($runs)['text'] ?? '');

                        $dur    = 240;

                        if (strpos($durTxt, ':') !== false) {

                            $p = explode(':', $durTxt);

                            if (count($p) === 2) $dur = intval($p[0]) * 60 + intval($p[1]);

                        }

                        $thumb = $v['thumbnail']['musicThumbnailRenderer']['thumbnail']['thumbnails'][0]['url'] ?? '';

                        $results[] = ['id' => $vid, 'title' => $title, 'artist' => $artist, 'duration' => $dur, 'thumbnail' => $thumb];

                    }

                } catch (Exception $e) {}

            }

        }

        return filterSongs($results, $currentVideoId, $ignoreDurationLimit);

    }



    // Use YouTube Data API v3 (fast, reliable)

    $songs = [];

    $ids = [];

    $snippets = [];



    foreach ([$query, $query . ' songs', $query . ' official audio'] as $q) {

        $url = "https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=15&q="

            . urlencode($q) . "&type=video&key=" . YOUTUBE_API_KEY;

        $data = json_decode(makeCurlRequest($url), true);

        if (!isset($data['items'])) continue;

        foreach ($data['items'] as $item) {

            $vid = $item['id']['videoId'] ?? '';

            if ($vid && !in_array($vid, $ids)) {

                $ids[] = $vid;

                $snippets[$vid] = $item['snippet'];

            }

        }

    }



    if (empty($ids)) return [];



    $durData = json_decode(makeCurlRequest(

        "https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id="

        . implode(',', array_slice($ids, 0, 50)) . "&key=" . YOUTUBE_API_KEY

    ), true);



    $durations = [];

    if (isset($durData['items'])) {

        foreach ($durData['items'] as $item) {

            $durations[$item['id']] = parseISODuration($item['contentDetails']['duration'] ?? '');

        }

    }



    foreach ($ids as $vid) {

        if (!isset($snippets[$vid])) continue;

        $sn = $snippets[$vid];

        $songs[] = [

            'id'        => $vid,

            'title'     => html_entity_decode($sn['title'] ?? '', ENT_QUOTES, 'UTF-8'),

            'artist'    => html_entity_decode(cleanArtistName($sn['channelTitle'] ?? ''), ENT_QUOTES, 'UTF-8'),

            'duration'  => $durations[$vid] ?? 240,

            'thumbnail' => $sn['thumbnails']['high']['url'] ?? ($sn['thumbnails']['default']['url'] ?? ''),

        ];

    }

    return filterSongs($songs, $currentVideoId, $ignoreDurationLimit);

}



// Deduplicate a songs array, excluding a given videoId

function dedupe($songs, $excludeId = '') {

    $seen = $excludeId ? [$excludeId] : [];

    $out  = [];

    foreach ($songs as $s) {

        if (empty($s['id']) || in_array($s['id'], $seen)) continue;

        $seen[] = $s['id'];

        $out[]  = $s;

    }

    return $out;

}



// ============================================================

// MAIN LOGIC

// ============================================================

$recommended = [];



$restrictArtist = (isset($_GET['restrictArtist']) && $_GET['restrictArtist'] == 1 && !empty($artistParam));

if ($restrictArtist) {
    // Strictly fetch only this artist's songs!
    // 1. Try to search for artist's popular/top tracks (with ignoreDurationLimit = true)
    $recommended = searchForRecs($artistParam . ' popular songs', $videoId, true);
    // 2. Also try top songs
    $extra = searchForRecs($artistParam . ' top songs', $videoId, true);
    $recommended = dedupe(array_merge($recommended, $extra), $videoId);
    
    // 3. Fallback to DB songs by this artist
    if (count($recommended) < 15) {
        try {
            $stmt = $db->prepare("SELECT * FROM songs WHERE artist LIKE ? AND id != ? ORDER BY RAND() LIMIT 20");
            $stmt->execute(['%' . $artistParam . '%', $videoId]);
            foreach ($stmt->fetchAll() as $row) {
                $recommended[] = [
                    'id' => $row['id'],
                    'title' => $row['title'],
                    'artist' => $row['artist'],
                    'duration' => (int)$row['duration'],
                    'thumbnail' => $row['thumbnail']
                ];
            }
            $recommended = dedupe($recommended, $videoId);
        } catch (Exception $e) {}
    }
    
    // 4. Force filter everything in $recommended to strictly match matchesArtist
    $filteredRecs = [];
    foreach ($recommended as $s) {
        if (matchesArtist($s['artist'], $artistParam)) {
            $filteredRecs[] = $s;
        }
    }
    $recommended = $filteredRecs;
} else {
    // --- A. If we have a videoId, get related tracks ---
    if (!empty($videoId)) {
        $recommended = getRelatedVideos($videoId);

        // If still thin, search by artist name
        if (count($recommended) < 5) {
            $artist = $artistParam;
            if (empty($artist)) {
                $row = $db->prepare("SELECT artist FROM songs WHERE id = ?");
                $row->execute([$videoId]);
                $r = $row->fetch();
                if ($r) $artist = $r['artist'];
            }
            if (!empty($artist)) {
                $extra = searchForRecs($artist . ' popular songs', $videoId);
                $recommended = dedupe(array_merge($recommended, $extra), $videoId);
            }
        }
    }
}



// --- B. Personalized Explore (no song playing) ---

if (empty($videoId)) {

    // Get user's top 5 most-played artists

    $stmt = $db->prepare("

        SELECT s.artist, COUNT(l.id) as cnt

        FROM listens l INNER JOIN songs s ON l.song_id = s.id

        WHERE l.user_id = ?

        GROUP BY s.artist ORDER BY cnt DESC LIMIT 5

    ");

    $stmt->execute([$user['id']]);

    $topArtists = $stmt->fetchAll(PDO::FETCH_COLUMN, 0);



    if (!empty($topArtists)) {

        // Pick a random top artist and fetch similar songs

        shuffle($topArtists);

        foreach (array_slice($topArtists, 0, 2) as $artist) {

            $extra = searchForRecs($artist . ' similar songs');

            $recommended = dedupe(array_merge($recommended, $extra));

            if (count($recommended) >= 10) break;

        }

    }



    // Trending fallback

    if (count($recommended) < 5) {

        $extra = searchForRecs('top hits popular songs 2024');

        $recommended = dedupe(array_merge($recommended, $extra));

    }

}



// --- C. Artist-based fallback if still thin ---

if (count($recommended) < 5 && !empty($artistParam)) {

    $extra = searchForRecs($artistParam . ' top songs', $videoId);

    $recommended = dedupe(array_merge($recommended, $extra), $videoId);

}



// --- D. Listen history fallback from own DB ---

if (count($recommended) < 10) {

    $need = 10 - count($recommended);

    $existingIds = array_column($recommended, 'id');

    if ($videoId) $existingIds[] = $videoId;

    if (empty($existingIds)) {

        $existingIds = [''];

    }



    $placeholders = implode(',', array_fill(0, max(1, count($existingIds)), '?'));

    $histStmt = $db->prepare("

        SELECT s.id, s.title, s.artist, s.duration, s.thumbnail

        FROM songs s

        INNER JOIN listens l ON s.id = l.song_id

        WHERE l.user_id = ? AND s.id NOT IN ($placeholders)

          AND s.duration >= 60 AND s.duration <= 600

        GROUP BY s.id ORDER BY COUNT(l.id) DESC

        LIMIT $need

    ");

    $histStmt->execute(array_merge([$user['id']], $existingIds));

    foreach ($histStmt->fetchAll() as $row) {

        $recommended[] = ['id' => $row['id'], 'title' => $row['title'],

                          'artist' => $row['artist'], 'duration' => (int)$row['duration'],

                          'thumbnail' => $row['thumbnail']];

    }

}



// --- E. Seeded songs random fallback ---

if (count($recommended) < 10) {

    $existingIds = array_column($recommended, 'id');

    if ($videoId) $existingIds[] = $videoId;

    if (empty($existingIds)) {

        $existingIds = [''];

    }

    $placeholders = implode(',', array_fill(0, max(1, count($existingIds)), '?'));

    $randStmt = $db->prepare("

        SELECT * FROM songs WHERE id NOT IN ($placeholders)

          AND duration >= 60 AND duration <= 600

        ORDER BY RAND() LIMIT 15

    ");

    $randStmt->execute($existingIds);

    foreach ($randStmt->fetchAll() as $row) {

        $recommended[] = ['id' => $row['id'], 'title' => $row['title'],

                          'artist' => $row['artist'], 'duration' => (int)$row['duration'],

                          'thumbnail' => $row['thumbnail']];

        if (count($recommended) >= 10) break;

    }

}



// Final dedupe & cap at 15

$recommended = array_slice(dedupe($recommended, $videoId), 0, 15);



// Cache songs in DB

if (!empty($recommended)) {

    $ins = $db->prepare("INSERT INTO songs (id, title, artist, duration, thumbnail) VALUES (?, ?, ?, ?, ?)

                         ON DUPLICATE KEY UPDATE title=VALUES(title), artist=VALUES(artist),

                         duration=VALUES(duration), thumbnail=VALUES(thumbnail)");

    foreach ($recommended as $song) {

        if (empty($song['id'])) continue;

        try { $ins->execute([$song['id'], $song['title'], $song['artist'], $song['duration'], $song['thumbnail']]); }

        catch (Exception $e) {}

    }

}



if (!empty($roomCode) && !empty($videoId) && !empty($recommended)) {

    try {

        $del = $db->prepare("DELETE FROM room_recommendations WHERE room_code = ?");

        $del->execute([$roomCode]);

        $insRoomRec = $db->prepare("INSERT INTO room_recommendations (room_code, video_id, recommended_json) VALUES (?, ?, ?)");

        $insRoomRec->execute([$roomCode, $videoId, json_encode(array_values($recommended))]);

    } catch (Exception $e) {}

}



sendResponse(['songs' => array_values($recommended)]);

?>

