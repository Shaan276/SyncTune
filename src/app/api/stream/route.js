import { NextResponse } from 'next/server';
import { Ytdl } from '@distube/ytdl-core';

export const dynamic = 'force-dynamic';

if (!global._synctune_ytdl_instance) {
  global._synctune_ytdl_instance = new Ytdl();
}
const yt = global._synctune_ytdl_instance;

if (!global._synctune_stream_cache) {
  global._synctune_stream_cache = new Map();
}
const streamUrlCache = global._synctune_stream_cache;

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
  }

  return null;
}

export async function HEAD(request) {
  const { searchParams } = new URL(request.url);
  const rawId = searchParams.get('id');
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

  if (!rawId) {
    return NextResponse.json({ error: 'Missing video id parameter' }, { status: 400 });
  }

  // Strip extension hint if provided (e.g. videoId.m4a -> videoId)
  const videoId = rawId.replace(/\.(m4a|mp3|mp4|webm)$/i, '');

  let audioUrl = await getAudioUrl(videoId);
  if (!audioUrl) {
    return NextResponse.json({ error: 'Failed to extract audio stream' }, { status: 502 });
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
