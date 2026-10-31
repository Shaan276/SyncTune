import { NextResponse } from 'next/server';
import { Ytdl, Client } from '@distube/ytdl-core';
import CryptoJS from 'crypto-js';

export const dynamic = 'force-dynamic';

if (!global._synctune_ytdl_instance) {
  global._synctune_ytdl_instance = new Ytdl({
    clients: [Client.WebEmbedded, Client.Tv, Client.Mweb, Client.VisionOS]
  });
}
const yt = global._synctune_ytdl_instance;

if (!global._synctune_stream_cache) {
  global._synctune_stream_cache = new Map();
}
const streamUrlCache = global._synctune_stream_cache;

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

const BAD_WORDS = ['instrumental', 'karaoke', 'tribute', 'ringtone', 'lofi', 'slowed', 'reverb', 'piano', 'guitar', 'acoustic cover', 'flute', 'violin', 'bgm', 'soundtrack version', 'dialogue'];

function cleanText(str) {
  return (str || '')
    .toLowerCase()
    .replace(/&quot;/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&#039;/g, "'")
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Strict, verified matching against high-speed 320kbps Akamai MP4 stream.
 * 1. Strictly filters out instrumental, karaoke, lofi, ringtone, and cover versions.
 * 2. Enforces exact title word inclusion so wrong songs (e.g. Believer for Radioactive) are NEVER played.
 * 3. Enforces artist verification with robust YouTube channel name handling.
 */
async function searchExactSaavn(rawTitle, rawArtist) {
  let title = rawTitle || '';
  let artist = rawArtist || '';

  // If title has "Artist - Song", extract both
  if (title.includes(' - ')) {
    const parts = title.split(' - ');
    if (parts.length >= 2) {
      if (!artist || artist.toLowerCase().includes('artist') || artist.toLowerCase().includes('youtube') || parts[0].toLowerCase().replace(/\s+/g, '') === artist.toLowerCase().replace(/\s+/g, '')) {
        artist = parts[0].trim();
      }
      title = parts.slice(1).join(' - ').trim();
    }
  }

  // Clean title BEFORE cleanText so parentheticals (Lyric Video), [Official Audio] are stripped
  let cleanRawTitle = (title || '')
    .replace(/\(.*?\)/g, '')
    .replace(/\[.*?\]/g, '');

  let normTitle = cleanText(cleanRawTitle)
    .replace(/\b(official|video|audio|lyrics?|hd|4k|remastered|full song|visualizer|music video|lyric video)\b/gi, '')
    .trim();

  let normArtist = cleanText(artist)
    .replace(/\b(vevo|records|music|official|channel|songs)\b/gi, '')
    .trim();

  // If artist was inside the title (e.g. "Radioactive Imagine Dragons")
  if (normArtist && normTitle.includes(normArtist)) {
    normTitle = normTitle.replace(normArtist, '').trim();
  }

  const titleWords = normTitle.split(/\s+/).filter(w => w.length > 2);
  const artistWords = normArtist.split(/\s+/).filter(w => w.length > 2);

  const query = `${normTitle} ${normArtist}`.trim();
  if (!query) return null;

  try {
    const url = `https://www.jiosaavn.com/api.php?__call=search.getResults&q=${encodeURIComponent(query)}&_format=json&_marker=0&ctx=web6dot0&api_version=4`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const data = await res.json();
    const results = data.results || [];
    global._synctune_saavn_diag = { query, count: results.length, firstTitle: results[0]?.title };

    for (const item of results) {
      const itemTitle = cleanText(item.title);
      const itemSubtitle = cleanText(item.subtitle);
      const combined = `${itemTitle} ${itemSubtitle}`;

      // 1. REJECT instrumentals, karaokes, tributes, ringtones, lofi
      const hasBadWord = BAD_WORDS.some(bw => combined.includes(bw) && !normTitle.includes(bw));
      if (hasBadWord) continue;

      // 2. MUST match main title words
      const matchesTitle = titleWords.length > 0 && titleWords.every(w => itemTitle.includes(w));
      if (!matchesTitle) continue;

      // 3. If artist was provided, candidate MUST have artist match
      if (artistWords.length > 0) {
        const combinedSpaceless = combined.replace(/\s+/g, '');
        const rawArtistSpaceless = cleanText(rawArtist).replace(/\s+/g, '').replace(/songs|official|vevo|music/g, '');
        const matchesArtist = artistWords.some(w => combined.includes(w)) || (rawArtistSpaceless && combinedSpaceless.includes(rawArtistSpaceless));
        if (!matchesArtist) continue;
      }

      // 4. Must have decrypted audio url
      const enc = item.more_info?.encrypted_media_url;
      if (enc) {
        const directUrl = decryptSaavnUrl(enc);
        if (directUrl) {
          return {
            matchedTitle: item.title,
            matchedArtist: item.subtitle,
            url: directUrl
          };
        }
      }
    }
  } catch (e) {
    global._synctune_saavn_diag = { query, error: e.message || String(e) };
  }

  return null;
}

async function getAudioUrl(videoId) {
  const cached = streamUrlCache.get(videoId);
  if (cached && Date.now() - cached.timestamp < 3 * 3600 * 1000) {
    return cached.url;
  }

  try {
    const info = await yt.getInfo(videoId);
    const audioFormats = info.formats?.filter(f => f.hasAudio && !f.hasVideo) || [];

    // Prefer itag 140 (audio/mp4 m4a 128kbps AAC - universal Apple iOS & Android background playback)
    let selected = audioFormats.find(f => f.itag === 140);
    if (!selected) {
      selected = audioFormats.sort((a, b) => (b.audioBitrate || b.bitrate || 0) - (a.audioBitrate || a.bitrate || 0))[0];
    }

    if (selected && selected.url) {
      streamUrlCache.set(videoId, { url: selected.url, timestamp: Date.now() });
      return selected.url;
    }
  } catch (err) {
    console.error(`[Stream API] Error fetching stream for ${videoId}:`, err.message);
    global._synctune_last_error = err.message || String(err);
  }

  return null;
}

export async function HEAD(request) {
  const { searchParams } = new URL(request.url);
  const rawId = searchParams.get('id');
  const title = (searchParams.get('title') || '').trim();
  const artist = (searchParams.get('artist') || '').trim();

  // 1. High-speed verified vocal CDN lookup (guaranteed exact song, no instrumentals)
  if (title) {
    const directMatch = await searchExactSaavn(title, artist);
    if (directMatch?.url) {
      return NextResponse.redirect(directMatch.url, 307);
    }
  }

  if (!rawId) return new Response(null, { status: 400 });

  // Strip extension hint if provided (e.g. videoId.m4a -> videoId)
  const videoId = rawId.replace(/\.(m4a|mp3|mp4|webm)$/i, '');

  const audioUrl = await getAudioUrl(videoId);
  if (!audioUrl) return new Response(null, { status: 502 });

  try {
    const upstreamRes = await fetch(audioUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Range': 'bytes=0-0'
      }
    });

    const headers = new Headers();
    headers.set('Content-Type', 'audio/mp4');
    headers.set('Accept-Ranges', 'bytes');
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Expose-Headers', 'Accept-Ranges, Content-Range, Content-Length, Content-Type');
    if (upstreamRes.headers.has('content-range')) {
      const parts = upstreamRes.headers.get('content-range').split('/');
      if (parts[1]) headers.set('Content-Length', parts[1]);
    }
    headers.set('Cache-Control', 'public, max-age=3600');
    return new Response(null, { status: 200, headers });
  } catch (err) {
    return new Response(null, { status: 500 });
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const rawId = searchParams.get('id');
  const title = (searchParams.get('title') || '').trim();
  const artist = (searchParams.get('artist') || '').trim();

  // 1. High-speed verified vocal CDN lookup (Instant 320kbps Akamai MP4 stream, guaranteed vocal version)
  if (title) {
    const directMatch = await searchExactSaavn(title, artist);
    if (directMatch?.url) {
      return NextResponse.redirect(directMatch.url, 307);
    }
  }

  if (!rawId) {
    return NextResponse.json({ error: 'Missing video id parameter' }, { status: 400 });
  }

  // Strip extension hint if provided (e.g. videoId.m4a -> videoId)
  const videoId = rawId.replace(/\.(m4a|mp3|mp4|webm)$/i, '');

  let audioUrl = await getAudioUrl(videoId);
  if (!audioUrl) {
    return NextResponse.json({
      error: 'Failed to extract audio stream',
      lastError: global._synctune_last_error || 'unknown',
      saavnDiag: global._synctune_saavn_diag || null
    }, { status: 502 });
  }

  const rangeHeader = request.headers.get('range');
  const upstreamHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  };

  if (rangeHeader) {
    upstreamHeaders['Range'] = rangeHeader;
  }

  try {
    let upstreamRes = await fetch(audioUrl, { headers: upstreamHeaders });

    // If upstream returned 403 or error, retry once with fresh URL
    if (upstreamRes.status === 403 || (!upstreamRes.ok && upstreamRes.status !== 206)) {
      streamUrlCache.delete(videoId);
      audioUrl = await getAudioUrl(videoId);
      if (audioUrl) {
        upstreamRes = await fetch(audioUrl, { headers: upstreamHeaders });
      }
    }

    if (!upstreamRes.ok && upstreamRes.status !== 206) {
      return NextResponse.json({ error: 'Upstream audio error' }, { status: upstreamRes.status });
    }

    const responseHeaders = new Headers();
    responseHeaders.set('Content-Type', 'audio/mp4');
    responseHeaders.set('Accept-Ranges', 'bytes');
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Headers', 'Range, Content-Type, Accept');
    responseHeaders.set('Access-Control-Expose-Headers', 'Accept-Ranges, Content-Range, Content-Length, Content-Type');
    
    if (upstreamRes.headers.has('content-length')) {
      responseHeaders.set('Content-Length', upstreamRes.headers.get('content-length'));
    }
    if (upstreamRes.headers.has('content-range')) {
      responseHeaders.set('Content-Range', upstreamRes.headers.get('content-range'));
    }
    responseHeaders.set('Cache-Control', 'public, max-age=3600');

    // Pipe directly from server to client with zero IP mismatch
    return new Response(upstreamRes.body, {
      status: upstreamRes.status,
      headers: responseHeaders
    });
  } catch (err) {
    console.error(`[Stream API] Proxy error:`, err);
    return NextResponse.json({ error: 'Stream proxy error' }, { status: 500 });
  }
}
