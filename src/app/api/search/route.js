import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function cleanArtistName(name) {
  if (name.endsWith(' - Topic')) return name.slice(0, -8);
  if (name.endsWith('VEVO')) return name.slice(0, -4);
  return name.trim();
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q') || '';
  const category = searchParams.get('type') || 'music';

  if (!query.trim()) {
    return NextResponse.json({ songs: [], total: 0 });
  }

  try {
    let searchQuery = query;
    if (category === 'mix') searchQuery += ' mashup mix';
    else if (category === 'artist') searchQuery += ' songs';
    else searchQuery += ' official audio';

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

        for (const item of items) {
          if (item?.videoRenderer) {
            const video = item.videoRenderer;
            const videoId = video.videoId;
            if (!videoId || seen.has(videoId)) continue;

            const title = video.title?.runs?.[0]?.text || 'YouTube Music';
            let artist = video.ownerText?.runs?.[0]?.text || 'YouTube Artist';
            artist = cleanArtistName(artist);

            const durationText = video.lengthText?.simpleText || '3:30';
            const parts = durationText.split(':').map(Number);
            let duration = 210;
            if (parts.length === 2) duration = parts[0] * 60 + parts[1];
            else if (parts.length === 3) duration = parts[0] * 3600 + parts[1] * 60 + parts[2];

            const thumbnail = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;

            seen.add(videoId);
            songs.push({
              id: videoId,
              title,
              artist,
              duration,
              thumbnail
            });

            if (songs.length >= 15) break;
          }
        }

        if (songs.length > 0) {
          return NextResponse.json({ songs, total: songs.length });
        }
      }
    }
  } catch (err) {
    console.error("Next.js Search API error:", err);
  }

  // Fallback
  return NextResponse.json({
    songs: [
      { id: "hT_nvWreIhg", title: "One Love - Official Music Video", artist: "Shubh", duration: 160, thumbnail: "https://img.youtube.com/vi/hT_nvWreIhg/mqdefault.jpg" },
      { id: "vJQMv7A_N30", title: "Cheques - Official Music Video", artist: "Shubh", duration: 184, thumbnail: "https://img.youtube.com/vi/vJQMv7A_N30/mqdefault.jpg" },
      { id: "cl0a3iBN78U", title: "Elevated - Official Music Video", artist: "Shubh", duration: 202, thumbnail: "https://img.youtube.com/vi/cl0a3iBN78U/mqdefault.jpg" }
    ],
    total: 3
  });
}
