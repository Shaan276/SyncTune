import { NextResponse } from 'next/server';
import CryptoJS from 'crypto-js';

export const dynamic = 'force-dynamic';

if (!global._synctune_search_cache) {
  global._synctune_search_cache = new Map();
}
const searchCache = global._synctune_search_cache;

const DES_KEY = CryptoJS.enc.Utf8.parse('38346591');

function decryptSaavnUrl(encryptedUrl) {
  if (!encryptedUrl) return null;
  try {
    const decrypted = CryptoJS.DES.decrypt(
      { ciphertext: CryptoJS.enc.Base64.parse(encryptedUrl) },
      DES_KEY,
      { mode: CryptoJS.mode.ECB, padding: CryptoJS.pad.Pkcs7 }
    );
    const url = decrypted.toString(CryptoJS.enc.Utf8);
    if (!url || !url.startsWith('http')) return null;
    return url.replace('_96.mp4', '_320.mp4').replace('_160.mp4', '_320.mp4');
  } catch (e) {
    return null;
  }
}

function cleanArtistName(name) {
  if (!name) return 'YouTube Artist';
  if (name.endsWith(' - Topic')) return name.slice(0, -8);
  if (name.endsWith('VEVO')) return name.slice(0, -4);
  return name.trim();
}

// Blocklist of non-music keywords
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

// Ultra-fast (<300ms) high-fidelity search via JioSaavn
async function searchSaavnFast(query, maxDurationSeconds = 600) {
  try {
    const targetUrl = `https://www.jiosaavn.com/api.php?__call=search.getResults&q=${encodeURIComponent(query)}&_format=json&_marker=0&ctx=web6dot0&api_version=4`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);

    const res = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!res.ok) return [];
    const data = await res.json();
    const results = data.results || [];
    const songs = [];

    for (const item of results) {
      if (!item || !item.title) continue;
      const duration = parseInt(item.more_info?.duration, 10) || 210;
      if (duration > maxDurationSeconds || duration < 30) continue;

      let title = (item.title || '')
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&#039;/g, "'")
        .trim();

      let artist = (item.subtitle || '')
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&#039;/g, "'")
        .trim();

      if (artist.includes(' - ')) {
        artist = artist.split(' - ')[0].trim();
      }

      // Filter out karaoke, instrumental, tribute, and cover tracks unless explicitly searched
      const combinedLower = `${title} ${artist}`.toLowerCase();
      const isKaraokeOrInst = ['karaoke', 'instrumental', 'tribute', 'backing track', 'lofi', 'slowed', 'reverb', 'ringtone'].some(b => combinedLower.includes(b));
      if (isKaraokeOrInst && !query.toLowerCase().includes('karaoke') && !query.toLowerCase().includes('instrumental')) {
        continue;
      }

      const enc = item.more_info?.encrypted_media_url;
      const directAudioUrl = enc ? decryptSaavnUrl(enc) : null;
      const rawImg = item.image || '';
      const thumbnail = rawImg ? rawImg.replace('150x150', '500x500') : `https://img.youtube.com/vi/${item.id}/mqdefault.jpg`;

      songs.push({
        id: item.id || `saavn_${Date.now()}_${Math.random()}`,
        title,
        artist: artist || 'Official Artist',
        duration,
        thumbnail,
        audioUrl: directAudioUrl || undefined
      });

      if (songs.length >= 10) break;
    }

    return songs;
  } catch (e) {
    return [];
  }
}

// YouTube scrape search with 2500ms timeout
async function searchYouTubeFast(searchQuery, maxDurationSeconds = 600) {
  try {
    const targetUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(searchQuery)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);

    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!response.ok) return [];
    const html = await response.text();
    const match = html.match(/ytInitialData\s*=\s*({.+?});/s);
    if (!match || !match[1]) return [];

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

        // Reject live broadcasts
        if (!video.lengthText || !video.lengthText.simpleText) continue;

        const isLiveBadge = video.badges?.some(b => {
          const label = (b.metadataBadgeRenderer?.label || '').toLowerCase();
          const style = (b.metadataBadgeRenderer?.style || '').toLowerCase();
          return label.includes('live') || style.includes('live') || label.includes('premiere') || style.includes('premiere');
        });
        if (isLiveBadge) continue;

        const isLiveOverlay = video.thumbnailOverlays?.some(o => {
          const style = (o.thumbnailOverlayTimeStatusRenderer?.style || '').toLowerCase();
          const text = (o.thumbnailOverlayTimeStatusRenderer?.text?.runs?.[0]?.text || '').toLowerCase();
          return style.includes('live') || text.includes('live');
        });
        if (isLiveOverlay) continue;

        const title = video.title?.runs?.[0]?.text || '';
        let artist = video.ownerText?.runs?.[0]?.text || '';
        artist = cleanArtistName(artist);

        const titleLower = title.toLowerCase();
        const artistLower = artist.toLowerCase();

        if (
          titleLower.includes('24/7') ||
          titleLower.includes('live stream') ||
          titleLower.includes('live radio') ||
          titleLower.includes('livestream') ||
          titleLower.includes('live 24/7') ||
          titleLower.includes('🔴') ||
          titleLower.includes('live now') ||
          titleLower.includes('radio live') ||
          artistLower.includes('24/7') ||
          artistLower.includes('radio 24/7')
        ) {
          continue;
        }

        if (isLikelyNonMusic(title, artist)) continue;

        const durationText = video.lengthText.simpleText;
        const parts = durationText.split(':').map(Number);
        let duration = 210;
        if (parts.length === 2) duration = parts[0] * 60 + parts[1];
        else if (parts.length === 3) duration = parts[0] * 3600 + parts[1] * 60 + parts[2];

        if (duration > maxDurationSeconds || duration < 30) continue;

        const thumbnail = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
        seen.add(videoId);
        songs.push({
          id: videoId,
          title: title || 'Music Track',
          artist: artist || 'Official Artist',
          duration,
          thumbnail
        });

        if (songs.length >= 10) break;
      }
    }

    return songs;
  } catch (err) {
    return [];
  }
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
    let maxDurationSeconds = 600;
    let ytSearchQuery = `${query} song official audio`;

    if (category === 'mix' || category === 'mixups') {
      ytSearchQuery = `${query} mashup mix nonstop remix`;
      maxDurationSeconds = Infinity;
    } else if (category === 'artist') {
      ytSearchQuery = `${query} songs official audio`;
      maxDurationSeconds = 600;
    } else if (category === 'bhajan' || category === 'satsang') {
      ytSearchQuery = `${query} bhajan satsang devotional`;
      maxDurationSeconds = 1200;
    }

    // Run Saavn fast search and YouTube search in parallel
    const [saavnResults, ytResults] = await Promise.all([
      searchSaavnFast(query, maxDurationSeconds),
      searchYouTubeFast(ytSearchQuery, maxDurationSeconds)
    ]);

    // Merge results with Saavn high-quality audio prioritized and YouTube adding extra tracks
    const combined = [];
    const seenTitles = new Set();

    for (const song of [...saavnResults, ...ytResults]) {
      const norm = (song.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      if (norm && !seenTitles.has(norm)) {
        seenTitles.add(norm);
        combined.push(song);
      }
      if (combined.length >= 15) break;
    }

    const payload = { songs: combined, total: combined.length };
    if (combined.length > 0) {
      searchCache.set(cacheKey, { data: payload, timestamp: Date.now() });
    }
    return NextResponse.json(payload);
  } catch (err) {
    console.error("Search API error:", err);
  }

  return NextResponse.json({ songs: [], total: 0 });
}
