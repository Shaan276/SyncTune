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

// Helper to get or refresh audio URL
async function getAudioUrl(videoId) {
  const cached = streamUrlCache.get(videoId);
  if (cached && Date.now() - cached.timestamp < 3 * 3600 * 1000) {
    return cached.url;
  }

  try {
    const info = await yt.getInfo(videoId);
    const audioFormats = info.formats?.filter(f => f.hasAudio && !f.hasVideo) || [];

    // Prefer itag 140 (audio/mp4 m4a 128kbps AAC - universal Apple/Android support)
    let selected = audioFormats.find(f => f.itag === 140);
    if (!selected) {
      // Or best audio bitrate mp4/webm
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

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const videoId = searchParams.get('id');

  if (!videoId) {
    return NextResponse.json({ error: 'Missing video id parameter' }, { status: 400 });
  }

  const audioUrl = await getAudioUrl(videoId);
  if (!audioUrl) {
    return NextResponse.json({ error: 'Failed to extract audio stream' }, { status: 502 });
  }

  // 307 Temporary Redirect:
  // Browser HTML5 <audio> element directly connects to Google CDN stream.
  // Native range seeking, hardware decoding, zero server overhead.
  return NextResponse.redirect(audioUrl, {
    status: 307,
    headers: {
      'Cache-Control': 'public, max-age=3600'
    }
  });
}
