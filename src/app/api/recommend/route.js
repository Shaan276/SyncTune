import { NextResponse } from 'next/server';
import { Ytdl } from '@distube/ytdl-core';

export const dynamic = 'force-dynamic';

if (!global._synctune_recommend_cache) {
  global._synctune_recommend_cache = new Map();
}
const recommendCache = global._synctune_recommend_cache;

if (!global._synctune_ytdl_recommend_instance) {
  global._synctune_ytdl_recommend_instance = new Ytdl();
}
const yt = global._synctune_ytdl_recommend_instance;

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

            // 1. REJECT LIVE STREAMS & 24/7 BROADCASTS
            // Regular YouTube videos ALWAYS have lengthText with simpleText. Live streams DO NOT.
            if (!video.lengthText || !video.lengthText.simpleText) {
              continue;
            }

            // Check badges for live / premiere
            const isLiveBadge = video.badges?.some(b => {
              const label = (b.metadataBadgeRenderer?.label || '').toLowerCase();
              const style = (b.metadataBadgeRenderer?.style || '').toLowerCase();
              return label.includes('live') || style.includes('live') || label.includes('premiere') || style.includes('premiere');
            });
            if (isLiveBadge) continue;

            // Check thumbnail overlays for LIVE style
            const isLiveOverlay = video.thumbnailOverlays?.some(o => {
              const style = (o.thumbnailOverlayTimeStatusRenderer?.style || '').toLowerCase();
              const text = (o.thumbnailOverlayTimeStatusRenderer?.text?.runs?.[0]?.text || '').toLowerCase();
              return style.includes('live') || text.includes('live');
            });
            if (isLiveOverlay) continue;

            const title = video.title?.runs?.[0]?.text || 'YouTube Song';
            let artist = video.ownerText?.runs?.[0]?.text || 'YouTube Artist';
            artist = cleanArtistName(artist);

            const titleLower = title.toLowerCase();
            const artistLower = artist.toLowerCase();

            // Check for 24/7, live radio, and continuous stream indicators
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

            const durationText = video.lengthText.simpleText;
            const parts = durationText.split(':').map(Number);
            let duration = 210;
            if (parts.length === 2) duration = parts[0] * 60 + parts[1];
            else if (parts.length === 3) duration = parts[0] * 3600 + parts[1] * 60 + parts[2];

            // Strict limit: Songs under 10 minutes and at least 30 seconds
            if (duration > 600 || duration < 30) continue;

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
  const forceRefresh = searchParams.get('refresh') === 'true' || searchParams.get('t');

  if (!rawArtist && !title && !videoId) {
    return NextResponse.json({ artistTracks: [], genreTracks: [] });
  }

  const cacheKey = `${videoId}_${rawArtist}_${title}`;
  if (!forceRefresh) {
    const cached = recommendCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 15 * 60 * 1000) {
      return NextResponse.json(cached.data);
    }
  }

  // 1. Extract real artists
  const artists = extractArtists(title, rawArtist);
  const primaryArtist = artists[0] || rawArtist || '';
  const normPrimary = primaryArtist.toLowerCase().replace(/\s+/g, '');

  // 2. Fetch True YouTube Related Tracks via Innertube API
  let relatedTracks = [];
  if (videoId) {
    try {
      const rawRelated = await yt.getRelated(videoId);
      relatedTracks = (rawRelated || [])
        .filter(v => !v.isLive && !v.isUpcoming && (v.lengthSeconds || 210) > 30 && (v.lengthSeconds || 210) <= 600)
        .map(v => ({
          id: v.id,
          title: v.title || 'YouTube Song',
          artist: cleanArtistName(v.author?.name || 'Artist'),
          duration: v.lengthSeconds || 210,
          thumbnail: `https://img.youtube.com/vi/${v.id}/mqdefault.jpg`
        }));
    } catch (e) {}
  }

  // 3. Fetch Strictly Same Artist Tracks
  let artistTracks = [];
  const artistSeen = new Set();
  if (videoId) artistSeen.add(videoId);

  // Check relatedTracks for songs by the same artist
  for (const song of relatedTracks) {
    const checkStr = `${song.title} ${song.artist}`.toLowerCase().replace(/\s+/g, '');
    if (normPrimary && checkStr.includes(normPrimary)) {
      if (!artistSeen.has(song.id)) {
        artistSeen.add(song.id);
        artistTracks.push(song);
      }
    }
  }

  // Search for official artist tracks
  if (artistTracks.length < 10 && primaryArtist) {
    const artSongs = await fetchFromYouTube(`${primaryArtist} songs official audio`, videoId);
    for (const song of artSongs) {
      if (!artistSeen.has(song.id)) {
        const checkStr = `${song.title} ${song.artist}`.toLowerCase().replace(/\s+/g, '');
        if (checkStr.includes(normPrimary) || !normPrimary) {
          artistSeen.add(song.id);
          artistTracks.push(song);
        }
      }
    }
  }

  // If still need more, search top tracks
  if (artistTracks.length < 10 && primaryArtist) {
    const topHits = await fetchFromYouTube(`${primaryArtist} top hits songs`, videoId);
    for (const song of topHits) {
      if (!artistSeen.has(song.id)) {
        artistSeen.add(song.id);
        artistTracks.push(song);
      }
    }
  }

  // 4. Fetch Same Taste & Genre Tracks (Vibe match)
  const cleanTitle = title.split(/[|\-–—]/)[0]?.replace(/\([^)]*\)/g, '').trim() || title;
  let genreTracks = [];
  const genreSeen = new Set();
  if (videoId) genreSeen.add(videoId);

  // First, add all relatedTracks that are NOT the primary artist (true same vibe / genre!)
  for (const song of relatedTracks) {
    const checkStr = `${song.title} ${song.artist}`.toLowerCase().replace(/\s+/g, '');
    const isSameArtist = normPrimary && checkStr.includes(normPrimary);
    if (!isSameArtist && !genreSeen.has(song.id)) {
      genreSeen.add(song.id);
      genreTracks.push(song);
    }
  }

  // If we need more genre tracks, search for similar songs
  if (genreTracks.length < 10) {
    const vibeQuery = primaryArtist
      ? `${cleanTitle} ${primaryArtist} similar vibe songs audio`
      : `${cleanTitle} similar songs audio`;

    const vibeSongs = await fetchFromYouTube(vibeQuery, videoId);
    for (const song of vibeSongs) {
      if (!genreSeen.has(song.id) && !artistSeen.has(song.id)) {
        genreSeen.add(song.id);
        genreTracks.push(song);
      }
    }
  }

  // Fallback: If genreTracks has remaining relatedTracks, include them
  for (const song of relatedTracks) {
    if (!genreSeen.has(song.id)) {
      genreSeen.add(song.id);
      genreTracks.push(song);
    }
  }

  // Safeguard: Ensure neither pool is empty
  if (genreTracks.length === 0 && artistTracks.length > 0) {
    genreTracks = [...artistTracks];
  }
  if (artistTracks.length === 0 && genreTracks.length > 0) {
    artistTracks = [...genreTracks];
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
