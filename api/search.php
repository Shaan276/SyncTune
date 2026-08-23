<?php
// SyncTune Music Search API
// URL pattern: GET /backend/api/search.php?q=QUERY

require_once 'config.php';
require_once 'db.php';

// Verify Auth Token
$user = getAuthUser();
if (!$user) {
    sendError('Access denied. Authentication required.', 401);
}

$query = isset($_GET['q']) ? trim($_GET['q']) : '';
if (empty($query)) {
    sendResponse(['songs' => []]);
}

$db = DB::connect();

// Make cURL request helper
// Cache directory and TTL constants
if (!defined('CACHE_DIR')) {
    define('CACHE_DIR', __DIR__ . '/../cache/search');
}
if (!defined('CACHE_TTL')) {
    define('CACHE_TTL', 3600); // 1 hour
}

function makeCurlRequest($url) {
    return makeHttpRequest($url);
}

// Clean up artist/channel name
function cleanArtistName($name) {
    // Remove "- Topic" suffix (YouTube auto-generated channels)
    if (substr($name, -8) === " - Topic") {
        $name = substr($name, 0, -8);
    }
    // Remove "VEVO" suffix (case-insensitive)
    if (strlen($name) > 4 && strcasecmp(substr($name, -4), "VEVO") === 0) {
        $name = substr($name, 0, -4);
    }
    // Trim whitespace
    return trim($name);
}

// Check if artist matches search query robustly
function matchesArtist($artist, $query) {
    $cleanArtist = preg_replace('/[^a-z0-9]/', '', strtolower($artist));
    $cleanQuery = preg_replace('/[^a-z0-9]/', '', strtolower($query));
    if (empty($cleanQuery)) return false;
    if (strpos($cleanArtist, $cleanQuery) !== false || strpos($cleanQuery, $cleanArtist) !== false) {
        return true;
    }
    $words = array_filter(explode(' ', strtolower($query)), function($w) { return strlen($w) > 2; });
    if (!empty($words)) {
        foreach ($words as $word) {
            $cleanWord = preg_replace('/[^a-z0-9]/', '', $word);
            if (!empty($cleanWord) && strpos($cleanArtist, $cleanWord) !== false) {
                return true;
            }
        }
    }
    return false;
}

// Global Song Filtering Rules
function filterSearchSongs($songs, $type = 'music') {
    $filtered = [];
    $seenIds = [];
    $excludeKeywords = [
        'mix', 'mashup', 'compilation', 'nonstop', 'non-stop', 'full album',
        '1 hour', '10 hours', 'dj mix', 'lofi hip hop', 'medley', 'juke box',
        'jukebox', 'mega mix', 'megamix', 'lo-fi', 'non stop', 'full ep',
        'full-album', 'synthwave mix', 'sleep music', 'study music', '10hour', '1hour'
    ];

    foreach ($songs as $song) {
        if (empty($song['id'])) continue;
        if (in_array($song['id'], $seenIds)) continue;

        $duration = $song['duration'];
        $titleLower = strtolower($song['title']);
        $artistLower = strtolower($song['artist']);

        // Duration limits
        if ($type === 'music') {
            // Music: 60s to 10m (600s)
            if ($duration < 60 || $duration > 600) continue;
            
            // Keyword filter for music category (no mixes/mashups/albums)
            $isCompilation = false;
            foreach ($excludeKeywords as $keyword) {
                if (strpos($titleLower, $keyword) !== false || strpos($artistLower, $keyword) !== false) {
                    $isCompilation = true;
                    break;
                }
            }
            if ($isCompilation) continue;
        } else {
            // Artist / Mixups: no upper duration limit, just minimum 60 seconds
            if ($duration < 60) continue;
        }

        $seenIds[] = $song['id'];
        $filtered[] = $song;
    }

    return $filtered;
}

// ISO 8601 duration parser (e.g. PT4M12S -> 252)
function parseISODuration($ISO8601) {
    try {
        $interval = new DateInterval($ISO8601);
        return ($interval->d * 86400) + ($interval->h * 3600) + ($interval->i * 60) + $interval->s;
    } catch (Exception $e) {
        return 240;
    }
}

// Fetch search results using Official YouTube Data API v3
// Strategy: run TWO queries — one for "ARTIST official audio" and one for
// the raw query — then merge so both artist and song name searches work.
function fetchFromYouTubeAPI($query, $maxResults = 20, $type = 'music') {
    // Simple file‑based cache to reduce YouTube API quota usage
    $cacheKey = md5($query . '_' . $type);
    $cacheFile = CACHE_DIR . '/' . $cacheKey . '.json';
    // Ensure cache directory exists
    if (!is_dir(CACHE_DIR)) {
        @mkdir(CACHE_DIR, 0755, true);
    }
    if (is_file($cacheFile) && (time() - filemtime($cacheFile) < CACHE_TTL)) {
        $cached = json_decode(file_get_contents($cacheFile), true);
        if (is_array($cached)) {
            return $cached; // Return cached result set
        }
    }

    if (!defined('YOUTUBE_API_KEY') || empty(YOUTUBE_API_KEY)) {
        return null;
    }

    $songs = [];
    $ids = [];
    $snippets = [];

    // Multi‑query strategy: covers both "Song Title" and "Artist Name" searches
    if ($type === 'artist') {
        $queries = [
            $query . ' songs',
            $query,
            $query . ' official audio'
        ];
    } elseif ($type === 'mixups') {
        $queries = [
            $query . ' mashup',
            $query . ' mix',
            $query . ' megamix'
        ];
    } else {
        $queries = [
            $query,
            $query . ' official audio',
            $query . ' songs',
            $query . ' best songs playlist',
        ];
    }

    foreach ($queries as $q) {
        $url = "https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=" . $maxResults
            . "&q=" . urlencode($q)
            . "&type=video&key=" . YOUTUBE_API_KEY;
        $jsonStr = makeCurlRequest($url);
        if (!$jsonStr) continue;
        $data = json_decode($jsonStr, true);
        if (!isset($data['items'])) continue;
        foreach ($data['items'] as $item) {
            $videoId = $item['id']['videoId'] ?? '';
            if ($videoId && !in_array($videoId, $ids)) {
                $ids[] = $videoId;
                $snippets[$videoId] = $item['snippet'];
            }
        }
    }

    if (empty($ids)) return [];

    // Fetch video durations in one batch
    $idsStr = implode(',', array_slice($ids, 0, 50));
    $durationsUrl = "https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=" . $idsStr . "&key=" . YOUTUBE_API_KEY;
    $durationsJsonStr = makeCurlRequest($durationsUrl);
    if (!$durationsJsonStr) return [];
    $durationsData = json_decode($durationsJsonStr, true);
    if (!isset($durationsData['items'])) return [];
    $durations = [];
    foreach ($durationsData['items'] as $item) {
        $id = $item['id'];
        $isoDuration = $item['contentDetails']['duration'] ?? '';
        $durations[$id] = parseISODuration($isoDuration);
    }

    foreach ($ids as $videoId) {
        if (!isset($snippets[$videoId])) continue;
        $snippet = $snippets[$videoId];
        $title = html_entity_decode($snippet['title'] ?? 'Unknown Title', ENT_QUOTES, 'UTF-8');
        $artist = html_entity_decode(cleanArtistName($snippet['channelTitle'] ?? 'Unknown Artist'), ENT_QUOTES, 'UTF-8');
        $thumbnail = $snippet['thumbnails']['high']['url'] ??
            ($snippet['thumbnails']['medium']['url'] ?? ($snippet['thumbnails']['default']['url'] ?? ''));
        $duration = $durations[$videoId] ?? 240;
        $songs[] = [
            'id'        => $videoId,
            'title'     => $title,
            'artist'    => $artist,
            'duration'  => $duration,
            'thumbnail' => $thumbnail
        ];
    }

    $filtered = filterSearchSongs($songs, $type);
    // Store result in cache for future identical queries
    @file_put_contents($cacheFile, json_encode($filtered));
    return $filtered;
}

// Scrape YouTube Music Search results as fallback
function searchYouTube($query, $type = 'music') {
    // 1. Official YouTube API (most reliable)
    $apiSongs = fetchFromYouTubeAPI($query, 20, $type);
    if ($apiSongs !== null && count($apiSongs) > 0) {
        return $apiSongs;
    }

    $results = [];

    // 2. YouTube Music InnerTube API (fast, structured)
    $ytMusicUrl = 'https://music.youtube.com/search?q=' . urlencode($query);
    $html = makeCurlRequest($ytMusicUrl);

    if ($html !== FALSE && preg_match('/ytInitialData\s*=\s*({.+?});/s', $html, $matches)) {
        $json = json_decode($matches[1], true);
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
                    if (isset($item['musicResponsiveListItemRenderer'])) {
                        $video = $item['musicResponsiveListItemRenderer'];
                        $vId = $video['playlistItemData']['videoId']
                            ?? ($video['overlay']['musicItemThumbnailOverlayRenderer']['content']['musicPlayButtonRenderer']['playNavigationEndpoint']['watchEndpoint']['videoId'] ?? '');
                        if (empty($vId)) continue;

                        $title = $video['flexColumns'][0]['musicResponsiveListItemFlexColumnRenderer']['text']['runs'][0]['text'] ?? '';
                        $artist = $video['flexColumns'][1]['musicResponsiveListItemFlexColumnRenderer']['text']['runs'][0]['text'] ?? '';

                        $duration = 240;
                        if (isset($video['flexColumns'][1]['musicResponsiveListItemFlexColumnRenderer']['text']['runs'])) {
                            $runs = $video['flexColumns'][1]['musicResponsiveListItemFlexColumnRenderer']['text']['runs'];
                            $lastRun = end($runs);
                            $durationText = trim($lastRun['text'] ?? '');
                            if (strpos($durationText, ':') !== false) {
                                $parts = explode(':', $durationText);
                                if (count($parts) === 2) {
                                    $duration = intval($parts[0]) * 60 + intval($parts[1]);
                                }
                            }
                        }

                        $thumbnail = $video['thumbnail']['musicThumbnailRenderer']['thumbnail']['thumbnails'][0]['url'] ?? '';
                        $results[] = [
                            'id' => $vId, 'title' => $title,
                            'artist' => cleanArtistName($artist),
                            'duration' => $duration, 'thumbnail' => $thumbnail
                        ];
                    }
                }
            } catch (Exception $e) {}
        }
    }

    if (count($results) >= 5) {
        return filterSearchSongs($results, $type);
    }

    // 3. Standard YouTube search page scrape
    $searchQuery = ($type === 'mixups') ? $query . ' mashup mix' : (($type === 'artist') ? $query . ' songs' : $query . ' official audio');
    $ytUrl = 'https://www.youtube.com/results?search_query=' . urlencode($searchQuery);
    $html = makeCurlRequest($ytUrl);
    $scrapeResults = [];

    if ($html !== FALSE && preg_match('/ytInitialData\s*=\s*({.+?});/s', $html, $matches)) {
        $json = json_decode($matches[1], true);
        if ($json) {
            try {
                $contents = $json['contents']['twoColumnSearchResultsRenderer']['primaryContents']['sectionListRenderer']['contents'] ?? [];
                $items = [];
                foreach ($contents as $section) {
                    if (isset($section['itemSectionRenderer']['contents'])) {
                        $items = array_merge($items, $section['itemSectionRenderer']['contents']);
                    }
                }
                foreach ($items as $item) {
                    if (isset($item['videoRenderer'])) {
                        $video = $item['videoRenderer'];
                        $videoId = $video['videoId'] ?? '';
                        if (empty($videoId)) continue;

                        $title = $video['title']['runs'][0]['text'] ?? '';
                        $artist = cleanArtistName($video['ownerText']['runs'][0]['text'] ?? '');

                        $durationText = $video['lengthText']['simpleText'] ?? '0:00';
                        $durationParts = explode(':', $durationText);
                        $duration = 0;
                        if (count($durationParts) === 2) {
                            $duration = intval($durationParts[0]) * 60 + intval($durationParts[1]);
                        } elseif (count($durationParts) === 3) {
                            $duration = intval($durationParts[0]) * 3600 + intval($durationParts[1]) * 60 + intval($durationParts[2]);
                        }

                        $thumbnail = '';
                        if (isset($video['thumbnail']['thumbnails'])) {
                            $thumbs = $video['thumbnail']['thumbnails'];
                            $thumbnail = $thumbs[count($thumbs) - 1]['url'] ?? $thumbs[0]['url'] ?? '';
                        }

                        $scrapeResults[] = [
                            'id' => $videoId, 'title' => $title,
                            'artist' => $artist, 'duration' => $duration, 'thumbnail' => $thumbnail
                        ];
                    }
                }
            } catch (Exception $e) {}
        }
    }

    return filterSearchSongs(array_merge($results, $scrapeResults), $type);
}

// Helper: Extract YouTube ID from URL
function getYoutubeIdFromUrl($url) {
    $pattern = '/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/ ]{11})/i';
    if (preg_match($pattern, $url, $match)) {
        return $match[1];
    }
    return null;
}

// Helper: Fetch details for a single YouTube video
function fetchSingleVideoFromYouTube($videoId) {
    if (defined('YOUTUBE_API_KEY') && !empty(YOUTUBE_API_KEY)) {
        $url = "https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=" . urlencode($videoId) . "&key=" . YOUTUBE_API_KEY;
        $jsonStr = makeHttpRequest($url);
        if ($jsonStr) {
            $data = json_decode($jsonStr, true);
            if (isset($data['items'][0])) {
                $item = $data['items'][0];
                $title = html_entity_decode($item['snippet']['title'] ?? 'YouTube Video', ENT_QUOTES, 'UTF-8');
                $artist = html_entity_decode(cleanArtistName($item['snippet']['channelTitle'] ?? 'YouTube'), ENT_QUOTES, 'UTF-8');
                $isoDuration = $item['contentDetails']['duration'] ?? '';
                $duration = parseISODuration($isoDuration);
                $thumbnail = $item['snippet']['thumbnails']['high']['url'] ?? 
                             ($item['snippet']['thumbnails']['medium']['url'] ?? "https://img.youtube.com/vi/{$videoId}/mqdefault.jpg");
                return [
                    'id' => $videoId,
                    'title' => $title,
                    'artist' => $artist,
                    'duration' => $duration,
                    'thumbnail' => $thumbnail
                ];
            }
        }
    }
    
    // Fallback: Default details if API is not configured or fails
    return [
        'id' => $videoId,
        'title' => 'YouTube Video (' . $videoId . ')',
        'artist' => 'YouTube Link',
        'duration' => 240, // default placeholder
        'thumbnail' => "https://img.youtube.com/vi/{$videoId}/mqdefault.jpg"
    ];
}

// Check if query is a direct YouTube URL or 11-char ID
$youtubeId = getYoutubeIdFromUrl($query);
if (!$youtubeId && preg_match('/^[a-zA-Z0-9_-]{11}$/', $query)) {
    $youtubeId = $query;
}

if ($youtubeId) {
    $singleVideo = fetchSingleVideoFromYouTube($youtubeId);
    if ($singleVideo) {
        // Cache discovered song in DB
        $insertStmt = $db->prepare("INSERT INTO songs (id, title, artist, duration, thumbnail) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE title=VALUES(title), artist=VALUES(artist), duration=VALUES(duration), thumbnail=VALUES(thumbnail)");
        try {
            $insertStmt->execute([
                $singleVideo['id'], $singleVideo['title'], $singleVideo['artist'],
                $singleVideo['duration'], $singleVideo['thumbnail']
            ]);
        } catch (Exception $e) {}
        
        sendResponse(['songs' => [$singleVideo]]);
    }
}

// 1. Run YouTube search with bypass flag
$type = isset($_GET['type']) ? strtolower(trim($_GET['type'])) : 'music';
$rawSongs = searchYouTube($query, $type);
$songs = $rawSongs; // already filtered inside searchYouTube

// 2. Smart Database Fallback — split query into words for multi-field matching
if (empty($songs)) {
    $words = array_filter(array_map('trim', explode(' ', $query)));
    if (!empty($words)) {
        $conditions = [];
        $params = [];
        foreach ($words as $word) {
            if (strlen($word) < 2) continue; // skip single-char words
            $conditions[] = "(title LIKE ? OR artist LIKE ?)";
            $pattern = '%' . $word . '%';
            $params[] = $pattern;
            $params[] = $pattern;
        }
        if (!empty($conditions)) {
            $sql = "SELECT * FROM songs WHERE " . implode(" AND ", $conditions) . ($type === 'music' ? " AND duration >= 60 AND duration <= 600" : " AND duration >= 60") . " LIMIT 20";
            $dbQuery = $db->prepare($sql);
            $dbQuery->execute($params);
            $dbSongs = $dbQuery->fetchAll();

            foreach ($dbSongs as $dbSong) {
                $songs[] = [
                    'id'        => $dbSong['id'],
                    'title'     => $dbSong['title'],
                    'artist'    => $dbSong['artist'],
                    'duration'  => (int)$dbSong['duration'],
                    'thumbnail' => $dbSong['thumbnail']
                ];
            }
        }
    }
}

// 3. Wider DB fallback — OR query (any word match) if still empty
if (empty($songs)) {
    $words = array_filter(array_map('trim', explode(' ', $query)));
    if (!empty($words)) {
        $conditions = [];
        $params = [];
        foreach ($words as $word) {
            if (strlen($word) < 2) continue;
            $conditions[] = "title LIKE ?";
            $conditions[] = "artist LIKE ?";
            $pattern = '%' . $word . '%';
            $params[] = $pattern;
            $params[] = $pattern;
        }
        if (!empty($conditions)) {
            $sql = "SELECT * FROM songs WHERE (" . implode(" OR ", $conditions) . ") " . ($type === 'music' ? "AND duration >= 60 AND duration <= 600" : "AND duration >= 60") . " LIMIT 20";
            $dbQuery = $db->prepare($sql);
            $dbQuery->execute($params);
            $dbSongs = $dbQuery->fetchAll();

            foreach ($dbSongs as $dbSong) {
                $songs[] = [
                    'id'        => $dbSong['id'],
                    'title'     => $dbSong['title'],
                    'artist'    => $dbSong['artist'],
                    'duration'  => (int)$dbSong['duration'],
                    'thumbnail' => $dbSong['thumbnail']
                ];
            }
        }
    }
}

// 4. Cache discovered songs in database
if (!empty($songs)) {
    $checkStmt  = $db->prepare("SELECT id FROM songs WHERE id = ?");
    $insertStmt = $db->prepare("INSERT INTO songs (id, title, artist, duration, thumbnail) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE title=VALUES(title), artist=VALUES(artist), duration=VALUES(duration), thumbnail=VALUES(thumbnail)");

    foreach (array_slice($songs, 0, 30) as $song) {
        if (empty($song['id'])) continue;
        $checkStmt->execute([$song['id']]);
        if (!$checkStmt->fetch()) {
            try {
                $insertStmt->execute([
                    $song['id'], $song['title'], $song['artist'],
                    $song['duration'], $song['thumbnail']
                ]);
            } catch (Exception $e) {}
        }
    }
}

// Filter to only match artist if type is artist
if ($type === 'artist') {
    $filteredSongs = [];
    foreach ($songs as $song) {
        if (matchesArtist($song['artist'], $query) || strpos(strtolower($song['title']), strtolower($query)) !== false) {
            $filteredSongs[] = $song;
        }
    }
    $songs = $filteredSongs;
}

sendResponse(['songs' => array_values($songs)]);
?>
