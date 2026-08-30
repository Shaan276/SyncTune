const http = require('http');
const fs = require('fs');
const path = require('path');
const https = require('https');

const PORT = process.env.PORT || 9998;

// In-Memory Data Stores for Native Node Server Mode
const memoryStore = {
  users: [
    { id: 1, username: 'Piyush', email: 'piyushpilkhwal74@gmail.com', role: 'admin', current_status: 'active', todayMB: 4.2, monthMB: 128.5 },
    { id: 2, username: 'Aarav', email: 'aarav@gmail.com', role: 'user', current_status: 'listening', todayMB: 12.8, monthMB: 340.0 },
    { id: 3, username: 'Ananya', email: 'ananya@gmail.com', role: 'user', current_status: 'active', todayMB: 1.5, monthMB: 45.2 },
  ],
  rooms: {
    'BEAT1': { code: 'BEAT1', host_name: 'Piyush', host_id: 1, member_count: 5, song_title: 'One Love', song_artist: 'Shubh', is_playing: 1, current_time: 0 },
    'CHILL': { code: 'CHILL', host_name: 'Alex', host_id: 2, member_count: 3, song_title: 'Softly', song_artist: 'Karan Aujla', is_playing: 1, current_time: 0 }
  },
  playlists: [
    { id: 1, name: 'Liked Songs', count: 1, songs: [{ id: "hT_nvWreIhg", title: "One Love", artist: "Shubh", duration: 160, thumbnail: "https://img.youtube.com/vi/hT_nvWreIhg/mqdefault.jpg" }] },
    { id: 2, name: 'Late Night Chill', count: 0, songs: [] }
  ],
  broadcasts: []
};

// Real Live YouTube Web Scraper (Extracts real videoId, title, artist, duration, thumbnail)
function fetchYouTubeSearch(query, category = 'music') {
  return new Promise((resolve) => {
    if (!query || !query.trim()) {
      return resolve(getCuratedFallbackSongs(''));
    }

    let searchQuery = query;
    if (category === 'mix') searchQuery += ' mashup mix';
    else if (category === 'artist') searchQuery += ' songs';
    else searchQuery += ' official audio';

    const targetUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(searchQuery)}`;
    
    const req = https.get(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      timeout: 8000
    }, (res) => {
      let html = '';
      res.on('data', chunk => html += chunk);
      res.on('end', () => {
        try {
          const match = html.match(/ytInitialData\s*=\s*({.+?});/s);
          if (match && match[1]) {
            const data = JSON.parse(match[1]);
            const contents = data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents || [];
            let items = [];
            for (const section of contents) {
              if (section?.itemSectionRenderer?.contents) {
                items = items.concat(section.itemSectionRenderer.contents);
              }
            }

            const songs = [];
            const seen = new Set();

            for (const item of items) {
              if (item?.videoRenderer) {
                const video = item.videoRenderer;
                const videoId = video.videoId;
                if (!videoId || seen.has(videoId)) continue;

                const title = video.title?.runs?.[0]?.text || 'YouTube Music';
                let artist = video.ownerText?.runs?.[0]?.text || 'YouTube Artist';
                if (artist.endsWith(' - Topic')) artist = artist.slice(0, -8);
                if (artist.endsWith('VEVO')) artist = artist.slice(0, -4);

                const durationText = video.lengthText?.simpleText || '3:30';
                const parts = durationText.split(':').map(Number);
                let duration = 210;
                if (parts.length === 2) duration = parts[0] * 60 + parts[1];
                else if (parts.length === 3) duration = parts[0] * 3600 + parts[1] * 60 + parts[2];

                // Enforce max 10-minute duration limit
                if (duration > 600) continue;

                const thumbnail = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;

                seen.add(videoId);
                songs.push({
                  id: videoId,
                  title,
                  artist: artist.trim(),
                  duration,
                  thumbnail
                });

                if (songs.length >= 15) break;
              }
            }

            if (songs.length > 0) {
              return resolve(songs);
            }
          }
        } catch (e) {
          console.error("YouTube Parse Error:", e.message);
        }

        resolve(getCuratedFallbackSongs(query));
      });
    });

    req.on('error', (err) => {
      console.error("YouTube Request Error:", err.message);
      resolve(getCuratedFallbackSongs(query));
    });

    req.on('timeout', () => {
      req.destroy();
      resolve(getCuratedFallbackSongs(query));
    });
  });
}

function getCuratedFallbackSongs(query) {
  const curated = [
    { id: "hT_nvWreIhg", title: "One Love - Official Music Video", artist: "Shubh", duration: 160, thumbnail: "https://img.youtube.com/vi/hT_nvWreIhg/mqdefault.jpg" },
    { id: "vJQMv7A_N30", title: "Cheques - Official Music Video", artist: "Shubh", duration: 184, thumbnail: "https://img.youtube.com/vi/vJQMv7A_N30/mqdefault.jpg" },
    { id: "cl0a3iBN78U", title: "Elevated - Official Music Video", artist: "Shubh", duration: 202, thumbnail: "https://img.youtube.com/vi/cl0a3iBN78U/mqdefault.jpg" },
    { id: "A66TYFbgYAM", title: "Softly - Official Music Video", artist: "Karan Aujla, Ikky", duration: 154, thumbnail: "https://img.youtube.com/vi/A66TYFbgYAM/mqdefault.jpg" },
    { id: "3gFcCXxjy4U", title: "Tauba Tauba - Bad Newz", artist: "Karan Aujla", duration: 208, thumbnail: "https://img.youtube.com/vi/3gFcCXxjy4U/mqdefault.jpg" },
    { id: "k4g4X32dJ8Q", title: "Winning Speech - Official Music Video", artist: "Karan Aujla", duration: 215, thumbnail: "https://img.youtube.com/vi/k4g4X32dJ8Q/mqdefault.jpg" }
  ];

  if (!query) return curated;
  const filtered = curated.filter(s => 
    s.title.toLowerCase().includes(query.toLowerCase()) || 
    s.artist.toLowerCase().includes(query.toLowerCase())
  );
  return filtered.length > 0 ? filtered : curated;
}

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.js': 'text/javascript',
  '.jsx': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon'
};

const server = http.createServer(async (req, res) => {
  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = urlObj.pathname;
  const searchParams = urlObj.searchParams;

  // JSON Response Helper
  const sendJSON = (data, statusCode = 200) => {
    res.writeHead(statusCode, {
      'Content-Type': 'application/json; charset=UTF-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    res.end(JSON.stringify(data));
  };

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    return res.end();
  }

  // Handle Native JavaScript API Routes (Bypasses PHP errors)
  if (pathname.includes('/api/')) {
    let body = {};
    if (req.method === 'POST') {
      try {
        const buffers = [];
        for await (const chunk of req) buffers.push(chunk);
        const raw = Buffer.concat(buffers).toString();
        if (raw) body = JSON.parse(raw);
      } catch (e) {}
    }

    // 1. Version API
    if (pathname.includes('version')) {
      return sendJSON({
        version: '2.9.14',
        maintenance: false,
        features: { '2.9.14': ['Native JavaScript API Routes', 'Live YouTube Web Search Scraper'] }
      });
    }

    // 2. Auth API
    if (pathname.includes('auth')) {
      const email = (body.email || '').trim().toLowerCase();
      const rawUsername = (body.username || '').trim();
      const username = rawUsername || (email ? email.split('@')[0] : 'Listener');
      const isAdmin = email === 'piyushpilkhwal74@gmail.com' || username.toLowerCase() === 'piyush';
      const role = isAdmin ? 'admin' : 'user';

      const userObj = {
        id: Date.now(),
        username,
        email: email || 'listener@synctune.app',
        role,
        status: 'active'
      };

      if (!memoryStore.users.some(u => u.email === userObj.email)) {
        memoryStore.users.push({ ...userObj, todayMB: 0, monthMB: 0 });
      }

      return sendJSON({
        token: `synctune-jwt-${Date.now()}`,
        user: userObj,
        status: 'active'
      });
    }

    // 3. Search API
    if (pathname.includes('search')) {
      const q = searchParams.get('q') || body.q || '';
      const type = searchParams.get('type') || body.type || 'music';
      const songs = await fetchYouTubeSearch(q, type);
      return sendJSON({ songs, total: songs.length });
    }

    // 4. Room API
    if (pathname.includes('room')) {
      const action = searchParams.get('action') || body.action || 'list';
      const code = (searchParams.get('code') || body.code || 'BEAT1').toUpperCase();

      if (action === 'create' || action === 'join') {
        if (!memoryStore.rooms[code]) {
          memoryStore.rooms[code] = {
            code,
            host_name: body.username || 'Piyush',
            host_id: 1,
            member_count: 1,
            song_title: 'One Love',
            song_artist: 'Shubh',
            is_playing: 1,
            current_time: 0
          };
        }
        return sendJSON({ success: true, code, room: memoryStore.rooms[code] });
      }

      if (action === 'poll' || action === 'status') {
        const room = memoryStore.rooms[code] || { code, member_count: 1, is_playing: 1, current_time: 0 };
        return sendJSON({ success: true, room, members: [{ id: 1, username: 'Piyush', is_online: true }] });
      }

      return sendJSON({ success: true, rooms: Object.values(memoryStore.rooms) });
    }

    // 5. Admin API
    if (pathname.includes('admin')) {
      const action = searchParams.get('action') || body.action || 'stats';

      if (action === 'add_user') {
        const newUser = { id: Date.now(), username: body.username, email: body.email, role: body.role || 'user', current_status: 'active', todayMB: 0, monthMB: 0 };
        memoryStore.users.unshift(newUser);
        return sendJSON({ success: true, user: newUser });
      }

      if (action === 'delete_user') {
        memoryStore.users = memoryStore.users.filter(u => u.id !== body.id);
        return sendJSON({ success: true });
      }

      if (action === 'destroy_room') {
        delete memoryStore.rooms[body.code];
        return sendJSON({ success: true });
      }

      return sendJSON({
        success: true,
        stats: { totalUsers: memoryStore.users.length, activeRooms: Object.keys(memoryStore.rooms).length, todayMB: 18.5, monthMB: 514.2, dataSavedMB: 482.0, totalListens: 1240, maintenance: false },
        users: memoryStore.users,
        rooms: Object.values(memoryStore.rooms)
      });
    }

    // 7. Recommend API (Live YouTube Music Artist & Genre Taste Recommendation)
    if (pathname.includes('recommend')) {
      const artist = searchParams.get('artist') || body.artist || '';
      const title = searchParams.get('title') || body.title || '';
      const videoId = searchParams.get('videoId') || body.videoId || '';

      const artistQuery = artist ? `${artist} songs official audio` : `${title} songs`;
      const genreQuery = artist ? `${artist} radio mix similar songs` : `${title} radio mix`;

      const [artistTracks, genreTracks] = await Promise.all([
        fetchYouTubeSearch(artistQuery, 'music'),
        fetchYouTubeSearch(genreQuery, 'music')
      ]);

      return sendJSON({
        success: true,
        artist,
        artistTracks: artistTracks.filter(s => s.id !== videoId).slice(0, 6),
        genreTracks: genreTracks.filter(s => s.id !== videoId).slice(0, 6)
      });
    }

    // 8. Usage API
    if (pathname.includes('usage')) {
      return sendJSON({
        success: true,
        todayMB: 4.2,
        monthMB: 128.5,
        dataSavedMB: 482.0,
        bytes: 4404019
      });
    }

        // 8. Recommend API
    if (pathname.includes('recommend')) {
      const videoId = searchParams.get('videoId') || 'hT_nvWreIhg';
      const title = searchParams.get('title') || 'One Love';
      const artist = searchParams.get('artist') || 'Shubh';
      const songs = getCuratedFallbackSongs(artist).filter(s => s.id !== videoId);
      return sendJSON({ success: true, recommendations: songs, songs });
    }

    // Default API Fallback
    return sendJSON({ success: true });
  }

  // Static File Server Logic
  let filePath = req.url === '/' ? './index.html' : '.' + pathname;
  let extname = path.extname(filePath);
  let contentType = MIME_TYPES[extname] || 'text/html';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        fs.readFile('./index.html', (error, indexContent) => {
          if (error) {
            res.writeHead(500);
            res.end('Server Error');
          } else {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=UTF-8' });
            res.end(indexContent, 'utf-8');
          }
        });
      } else {
        res.writeHead(500);
        res.end(`Server Error: ${err.code}`);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, () => {
  console.log(`\n🚀 SyncTune v3.0 Native JS Server running at http://localhost:${PORT}`);
});
