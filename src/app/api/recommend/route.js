import { NextResponse } from 'next/server';
import CryptoJS from 'crypto-js';

export const dynamic = 'force-dynamic';

if (!global._synctune_recommend_cache) {
  global._synctune_recommend_cache = new Map();
}
const recommendCache = global._synctune_recommend_cache;

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

function cleanHtml(str) {
  if (!str) return '';
  return str
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

async function searchSaavn(query) {
  try {
    const url = `https://www.jiosaavn.com/api.php?__call=search.getResults&q=${encodeURIComponent(query)}&_format=json&_marker=0&ctx=web6dot0&api_version=4`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json'
      },
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!res.ok) return [];
    const data = await res.json();
    const results = data.results || [];
    const songs = [];

    for (const item of results) {
      if (item.type !== 'song' && item.type) continue;
      const encryptedUrl = item.more_info?.encrypted_media_url;
      const audioUrl = decryptSaavnUrl(encryptedUrl);
      if (!audioUrl) continue;

      const title = cleanHtml(item.title);
      let artist = cleanHtml(
        item.more_info?.artistMap?.primary_artists?.[0]?.name ||
        item.more_info?.music ||
        item.subtitle ||
        'Artist'
      );
      if (artist.includes('-')) artist = artist.split('-')[0].trim();

      const duration = parseInt(item.more_info?.duration || '210', 10);
      let thumbnail = item.image || '';
      if (thumbnail.includes('150x150')) {
        thumbnail = thumbnail.replace('150x150', '500x500');
      }

      songs.push({
        id: item.id || `saavn_${Math.random().toString(36).substring(7)}`,
        title: title || 'Music Track',
        artist: artist || 'Artist',
        duration: isNaN(duration) ? 210 : duration,
        thumbnail,
        audioUrl
      });

      if (songs.length >= 10) break;
    }

    return songs;
  } catch (e) {
    return [];
  }
}

const RECORD_LABELS = [
  't-series', 'tseries', 'zee music', 'sony music', 'speed records', 'yrf', 'tips official',
  'tips music', 'saregama', 'eros now', 'white hill', 'geet mp3', 'desi music factory',
  'aditya music', 'lahari music', 'think music', 'svf', 'times music', 'venus', 'vevo'
];

function isRecordLabel(name = '') {
  const lower = name.toLowerCase().trim();
  return RECORD_LABELS.some((label) => lower.includes(label)) ||
    lower.endsWith(' music') || lower.endsWith(' records') || lower.endsWith(' official');
}

function extractArtists(title = '', rawArtist = '') {
  let foundArtists = [];
  if (rawArtist && !isRecordLabel(rawArtist)) {
    const split = rawArtist.split(/[,&/]|(?:feat\.?|ft\.?)\s+/i).map(s => s.trim()).filter(Boolean);
    foundArtists.push(...split);
  }

  if (title) {
    const singerMatch = title.match(/(?:singers?|sung by|by|feat\.?|ft\.?)\s*[:\-]?\s*([^|()[\]]+)/i);
    if (singerMatch && singerMatch[1]) {
      const singers = singerMatch[1].split(/[,&/]/).map(s => s.trim()).filter(s => s.length > 2 && s.length < 35);
      foundArtists.push(...singers);
    }
    const segments = title.split(/[|\-–—]/).map(s => s.trim()).filter(Boolean);
    for (let i = segments.length - 1; i >= 1; i--) {
      const seg = segments[i];
      if (/video|audio|lyrics|full song|teaser|trailer|song/i.test(seg) && !seg.includes(',')) continue;
      const potential = seg.split(/[,&]/).map(s => s.replace(/\([^)]*\)/g, '').replace(/\[[^\]]*\]/g, '').trim()).filter(s => s.length > 2 && s.length < 35);
      if (potential.length > 0) {
        foundArtists.push(...potential);
        break;
      }
    }
  }

  const cleanList = [];
  const seen = new Set();
  const banWords = ['official', 'video', 'song', 'audio', 'lyrics', 'full', 'remix', 'music', 'records', 'movie', 'film'];

  for (const a of foundArtists) {
    const clean = a.trim();
    const lower = clean.toLowerCase();
    if (clean.length < 2 || seen.has(lower)) continue;
    if (banWords.some(w => lower === w || isRecordLabel(lower))) continue;
    seen.add(lower);
    cleanList.push(clean);
  }

  if (cleanList.length === 0 && rawArtist) {
    cleanList.push(rawArtist);
  }

  return cleanList;
}

function cleanArtistName(name) {
  if (!name) return 'Artist';
  if (name.endsWith(' - Topic')) return name.slice(0, -8);
  if (name.endsWith('VEVO')) return name.slice(0, -4);
  return name.trim();
}

async function fetchFromYouTube(searchQuery, excludeId = '') {
  try {
    const targetUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(searchQuery)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

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
        if (excludeId) seen.add(excludeId);

        for (const item of items) {
          if (item?.videoRenderer) {
            const video = item.videoRenderer;
            const videoId = video.videoId;
            if (!videoId || seen.has(videoId)) continue;

            const durationText = video.lengthText?.simpleText || '3:30';
            const parts = durationText.split(':').map(Number);
            let duration = 210;
            if (parts.length === 2) duration = parts[0] * 60 + parts[1];
            else if (parts.length === 3) duration = parts[0] * 3600 + parts[1] * 60 + parts[2];

            // Strict limit: Songs under 10 minutes
            if (duration > 600) continue;

            const title = video.title?.runs?.[0]?.text || 'YouTube Song';
            let artist = video.ownerText?.runs?.[0]?.text || 'YouTube Artist';
            artist = cleanArtistName(artist);

            seen.add(videoId);
            songs.push({
              id: videoId,
              title,
              artist,
              duration,
              thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
            });

            if (songs.length >= 10) break;
          }
        }
        return songs;
      }
    }
  } catch (e) {}
  return [];
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const rawArtist = searchParams.get('artist') || '';
  const title = searchParams.get('title') || '';
  const videoId = searchParams.get('videoId') || '';

  if (!rawArtist && !title) {
    return NextResponse.json({ artistTracks: [], genreTracks: [] });
  }

  const cacheKey = `${videoId}_${rawArtist}_${title}`;
  const cached = recommendCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < 15 * 60 * 1000) {
    return NextResponse.json(cached.data);
  }

  // 1. Extract real artists
  const artists = extractArtists(title, rawArtist);

  // 2. Fetch Strictly Same Artist Tracks (Prioritizing direct 320kbps CDN tracks)
  let artistTracks = [];
  const artistSeen = new Set();
  if (videoId) artistSeen.add(videoId);

  for (const art of artists.slice(0, 3)) {
    const cdnSongs = await searchSaavn(art);
    for (const song of cdnSongs) {
      if (!artistSeen.has(song.id)) {
        artistSeen.add(song.id);
        artistTracks.push(song);
      }
    }
  }

  if (artistTracks.length < 5) {
    for (const art of artists.slice(0, 3)) {
      const artSongs = await fetchFromYouTube(`${art} songs official audio`, videoId);
      for (const song of artSongs) {
        if (!artistSeen.has(song.id)) {
          const checkStr = `${song.title} ${song.artist}`.toLowerCase();
          if (checkStr.includes(art.toLowerCase())) {
            artistSeen.add(song.id);
            artistTracks.push(song);
          }
        }
      }
    }
  }

  if (artistTracks.length < 5 && artists.length > 0) {
    const primaryArtist = artists[0];
    const moreSongs = await fetchFromYouTube(`${primaryArtist} top hits songs`, videoId);
    for (const song of moreSongs) {
      if (!artistSeen.has(song.id)) {
        artistSeen.add(song.id);
        artistTracks.push(song);
      }
    }
  }

  // 3. Fetch Same Taste & Genre Tracks (Vibe match, direct CDN priority)
  const cleanTitle = title.split(/[|\-–—]/)[0]?.replace(/\([^)]*\)/g, '').trim() || title;
  const genreTracks = [];
  const genreSeen = new Set();
  if (videoId) genreSeen.add(videoId);

  const cdnGenre = await searchSaavn(cleanTitle);
  for (const song of cdnGenre) {
    if (!genreSeen.has(song.id) && !artistSeen.has(song.id)) {
      genreSeen.add(song.id);
      genreTracks.push(song);
    }
  }

  if (genreTracks.length < 5) {
    const genreQuery = artists.length > 0
      ? `${artists[0]} radio mix similar songs`
      : `${cleanTitle} similar vibe songs`;

    const genreRaw = await fetchFromYouTube(genreQuery, videoId);
    for (const song of genreRaw) {
      if (!genreSeen.has(song.id)) {
        genreSeen.add(song.id);
        genreTracks.push(song);
      }
    }
  }

  const payload = {
    success: true,
    artists,
    artistTracks: artistTracks.slice(0, 10),
    genreTracks: genreTracks.slice(0, 10)
  };

  recommendCache.set(cacheKey, { data: payload, timestamp: Date.now() });

  return NextResponse.json(payload);
}
