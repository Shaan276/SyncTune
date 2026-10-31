import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

if (!global._synctune_search_cache) {
  global._synctune_search_cache = new Map();
}
const searchCache = global._synctune_search_cache;

function cleanArtistName(name) {
  if (!name) return 'YouTube Artist';
  if (name.endsWith(' - Topic')) return name.slice(0, -8);
  if (name.endsWith('VEVO')) return name.slice(0, -4);
  return name.trim();
}

// Blocklist of non-music keywords to ensure educational/tutorial/vlog/tech channels are filtered out
const NON_MUSIC_INDICATORS = [
  'tutorial', 'lecture', 'course', 'class', 'exam', 'gate', 'coding', 'programming',
  'unboxing', 'review', 'podcast', 'episode', 'walkthrough', 'gameplay', 'news', 'interview',
  'learning', 'study', 'maths', 'science', 'computer science', 'crash course', 'education',
  'how to', 'syllabus', 'preparation', 'solved', 'question paper', 'chapter'
];

function isLikelyNonMusic(title = '', artist = '') {
  const combined = `${title} ${artist}`.toLowerCase();
  return NON_MUSIC_INDICATORS.some(keyword => combined.includes(keyword));
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get('q') || '').trim();
  const category = (searchParams.get('type') || 'music').toLowerCase();

  if (!query) {
    return NextResponse.json({ songs: [], total: 0 });
  }

  // Filter non-music queries
  if (isLikelyNonMusic(query, '')) {
    return NextResponse.json({ songs: [], total: 0 });
  }

  const cacheKey = `${category}_${query.toLowerCase()}`;
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < 30 * 60 * 1000) {
    return NextResponse.json(cached.data);
  }

  try {
    let searchQuery = query;
    let maxDurationSeconds = 600; // Default max 10 minutes

    if (category === 'mix' || category === 'mixups') {
      searchQuery = `${query} mashup mix nonstop remix`;
      maxDurationSeconds = Infinity;
    } else if (category === 'artist') {
      searchQuery = `${query} songs official audio`;
      maxDurationSeconds = 600;
    } else if (category === 'bhajan' || category === 'satsang') {
      searchQuery = `${query} bhajan satsang devotional`;
      maxDurationSeconds = 1200;
    } else {
      searchQuery = `${query} song official audio`;
      maxDurationSeconds = 600;
    }

    const targetUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(searchQuery)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4500);

    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (response.ok) {
      const html = await response.text();
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

            const title = video.title?.runs?.[0]?.text || '';
            let artist = video.ownerText?.runs?.[0]?.text || '';
            artist = cleanArtistName(artist);

            // Filter out non-music / educational content
            if (isLikelyNonMusic(title, artist)) {
              continue;
            }

            const durationText = video.lengthText?.simpleText || '3:30';
            const parts = durationText.split(':').map(Number);
            let duration = 210;
            if (parts.length === 2) duration = parts[0] * 60 + parts[1];
            else if (parts.length === 3) duration = parts[0] * 3600 + parts[1] * 60 + parts[2];

            // Strict duration check (unless mixups)
            if (duration > maxDurationSeconds) {
              continue;
            }

            const thumbnail = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;

            seen.add(videoId);
            songs.push({
              id: videoId,
              title: title || 'Music Track',
              artist: artist || 'Official Artist',
              duration,
              thumbnail
            });

            if (songs.length >= 15) break;
          }
        }

        const payload = { songs, total: songs.length };
        searchCache.set(cacheKey, { data: payload, timestamp: Date.now() });
        return NextResponse.json(payload);
      }
    }
  } catch (err) {
    console.error("Search API error:", err);
  }

  return NextResponse.json({ songs: [], total: 0 });
}
