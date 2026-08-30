import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function cleanArtistName(name) {
  if (!name) return 'Artist';
  if (name.endsWith(' - Topic')) return name.slice(0, -8);
  if (name.endsWith('VEVO')) return name.slice(0, -4);
  return name.trim();
}

async function fetchFromYouTube(searchQuery, excludeId = '') {
  try {
    const targetUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(searchQuery)}`;
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      next: { revalidate: 3600 }
    });

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

            const title = video.title?.runs?.[0]?.text || 'YouTube Song';
            let artist = video.ownerText?.runs?.[0]?.text || 'YouTube Artist';
            artist = cleanArtistName(artist);

            const durationText = video.lengthText?.simpleText || '3:30';
            const parts = durationText.split(':').map(Number);
            let duration = 210;
            if (parts.length === 2) duration = parts[0] * 60 + parts[1];
            else if (parts.length === 3) duration = parts[0] * 3600 + parts[1] * 60 + parts[2];

            seen.add(videoId);
            songs.push({
              id: videoId,
              title,
              artist,
              duration,
              thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
            });

            if (songs.length >= 6) break;
          }
        }
        return songs;
      }
    }
  } catch (e) {
    console.error('Recommend fetch error:', e);
  }
  return [];
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const artist = searchParams.get('artist') || '';
  const title = searchParams.get('title') || '';
  const videoId = searchParams.get('videoId') || '';

  if (!artist && !title) {
    return NextResponse.json({ artistTracks: [], genreTracks: [] });
  }

  // 1. Fetch same artist tracks
  const artistQuery = artist ? `${artist} songs official audio` : `${title} songs`;
  const artistTracks = await fetchFromYouTube(artistQuery, videoId);

  // 2. Fetch same genre & taste recommendations
  const genreQuery = artist ? `${artist} radio mix similar songs` : `${title} radio mix`;
  const genreTracks = await fetchFromYouTube(genreQuery, videoId);

  return NextResponse.json({
    success: true,
    artist,
    artistTracks,
    genreTracks
  });
}
