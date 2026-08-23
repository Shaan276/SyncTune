<?php
/**
 * SyncTune - InfinityFree Cache-Bypass Entry Point v2.9.5
 *
 * InfinityFree's Varnish CDN aggressively caches .html files for hours.
 * PHP files are NEVER cached by Varnish.
 *
 * This file serves the full SyncTune app with:
 *   1. Aggressive no-cache headers (bypasses Varnish + browser cache)
 *   2. Dynamic version injection (no stale version strings from cache)
 *   3. Direct HTML output (does NOT depend on index.html being fresh)
 */

// ── Send no-cache headers immediately ──
header('Cache-Control: no-cache, no-store, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: Thu, 01 Jan 1970 00:00:00 GMT');
header('Vary: *');
header('Content-Type: text/html; charset=UTF-8');
header('X-SyncTune-Version: 2.9.14');

$APP_VERSION = '2.9.14';
$ASSET_VERSION = '2.9.14';
?>
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="./favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>SyncTune - Listen Together</title>
    <!-- Global Anti-bot / Cookie Challenge Fetch Interceptor -->
    <script>
      (function() {
        const originalFetch = window.fetch;
        window.fetch = async function(...args) {
          try {
            const response = await originalFetch(...args);
            const clone = response.clone();
            const text = await clone.text();
            if (text && (text.includes("slowAES") || text.includes("__test") || text.includes("toNumbers") || text.includes("SlowAES"))) {
              console.warn("Anti-bot cookie challenge detected! Reloading page to authorize...");
              window.location.reload();
              return new Promise(() => {});
            }
            return response;
          } catch (err) {
            return originalFetch(...args);
          }
        };
      })();
    </script>
    <script>
      // Version injected dynamically by PHP - bypasses Varnish cache
      window.SYNC_TUNE_VERSION = "<?php echo $APP_VERSION; ?>";
      window.SYNC_TUNE_FEATURES = {
        "2.5.0": [
          "Enhanced synchronization across devices",
          "Optimized data buffering to eliminate periodic 5-second playback pauses"
        ],
        "2.6.0": [
          "Admin Stealth Mode (invisible joins for monitor & admin duties)",
          "Beautiful layout optimizations for mobile and responsive screens"
        ],
        "2.7.0": [
          "🎉 Real-time Friends list and activity monitoring tab!",
          "⚡ Live server-side auto-update notifications and version verification",
          "🔒 Aggressive cache control optimization to prevent outdated assets loading"
        ],
        "2.9.5": [
          "🎨 Brand new Premium Glass-Neumorphic Layout design redesign",
          "🌓 Dynamic Dark / Light theme toggle support across the application",
          "⚡ Fully optimized high-fidelity YouTube search card grid lists"
        ],
        "2.9.6": [
          "📱 Fixed mobile player visibility and layout rendering issues"
        ],
        "2.9.7": [
          "⚡ Fixed room playback syncing issues (play/pause/seek, delays, and background tab polling)",
          "🔄 Prevented client ending race conditions (song rollbacks)"
        ]
      };
    </script>
    <script type="module" crossorigin src="./assets/index-ZIdIQXhF-v5.js?v=<?php echo $ASSET_VERSION; ?>"></script>
    <script src="./assets/room_player.js?v=<?php echo $ASSET_VERSION; ?>"></script>
    <link rel="stylesheet" crossorigin href="./assets/index-oOMFrILX-v4.css?v=<?php echo $ASSET_VERSION; ?>" />
    <!-- Premium stylesheet -->
    <link rel="stylesheet" href="./assets/styles.css?v=<?php echo $ASSET_VERSION; ?>" />
    <script>
      (function() {
        const theme = localStorage.getItem('theme') || 'dark';
        if (theme === 'light') {
          document.documentElement.classList.add('light-mode');
        }
      })();
    </script>
  </head>
  <body>
    <?php
    // Read the rest of the body from index.html (from <body> onwards)
    // This way only the <head> is hardcoded here; body stays in index.html
    $html = file_get_contents(__DIR__ . '/index.html');
    if ($html !== false) {
        // Extract everything from <body> to end
        $bodyStart = stripos($html, '<body');
        $headEnd = stripos($html, '</head>');
        if ($bodyStart !== false) {
            // Output from <body> tag onwards but skip the opening body tag itself
            // since we already printed <body> above
            $bodyContent = substr($html, $bodyStart);
            // Remove the outer <body> and </html> wrappers since we provide them
            $bodyContent = preg_replace('/<body[^>]*>/', '', $bodyContent, 1);
            $bodyContent = preg_replace('/<\/html>\s*$/', '', $bodyContent);
            echo $bodyContent;
        }
    } else {
        // Absolute fallback if index.html can't be read
        echo '<div id="root"></div>';
        echo '<script>console.error("SyncTune: index.html could not be read by index.php");</script>';
    }
    ?>
  </body>
</html>
