<?php
// SyncTune Current App Version and Feature Notes API
require_once 'config.php';

$maintenance = false;
if (file_exists('maintenance.json')) {
    $data = json_decode(file_get_contents('maintenance.json'), true);
    $maintenance = isset($data['maintenance']) ? (bool)$data['maintenance'] : false;
}

$response = [
    'version' => '2.9.14',
    'maintenance' => $maintenance,
    'features' => [
        '2.5.0' => [
            'Enhanced playback synchronization across multiple mobile and desktop devices',
            'Optimized data buffering to eliminate periodic 5-second playback pauses'
        ],
        '2.6.0' => [
            'Invisible host "Stealth Mode" (admins can toggle to join and monitor rooms silently)',
            'Beautiful layout optimizations for mobile and responsive screens'
        ],
        '2.7.0' => [
            '🎉 Real-time Friends list and activity monitoring tab!',
            '⚡ Live server-side auto-update notifications and version verification',
            '🔒 Aggressive cache control optimization to prevent outdated assets loading'
        ],
        '2.9.5' => [
            '🎨 Brand new Premium Glass-Neumorphic Layout design redesign',
            '🌓 Dynamic Dark / Light theme toggle support across the application',
            '⚡ Fully optimized high-fidelity YouTube search card grid lists'
        ],
        '2.9.6' => [
            '📱 Fixed mobile player visibility and layout rendering issues'
        ],
        '2.9.7' => [
            '⚡ Fixed room playback syncing issues (play/pause/seek, delays, and background tab polling)',
            '🔄 Prevented client ending race conditions (song rollbacks)'
        ],
        '2.9.8' => [
            '🔍 Added search category filters (Music under 10m, Artist playlists/mixes, and Mashup Mixups)',
            '🎨 Fixed light-mode input box border and background styling distortion issues'
        ],
        '2.9.9' => [
            '🔒 Mandatory YouTube account connection',
            '🔘 Styled category selector buttons side-by-side',
            '✨ Artist-restricted queue and recommendations fallback'
        ],
        '2.9.12' => [
            'Removed mandatory private YouTube connection requirement',
            'Fixed admin directory user offline status timezone mismatches',
            'Added auto-join and auto-navigation behavior for room invitations'
        ],
        '2.9.14' => [
            '⚡ Resolved dashboard ReferenceError and updated cache-busting version'
        ]
    ]
];

sendResponse($response);
?>
