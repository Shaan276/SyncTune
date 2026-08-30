import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    success: true,
    playlists: [
      { id: 1, name: 'Liked Songs', count: 1, songs: [{ id: "hT_nvWreIhg", title: "One Love", artist: "Shubh", duration: 160, thumbnail: "https://img.youtube.com/vi/hT_nvWreIhg/mqdefault.jpg" }] },
      { id: 2, name: 'Late Night Chill', count: 0, songs: [] }
    ]
  });
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    return NextResponse.json({
      success: true,
      playlist: { id: Date.now(), name: body.name || 'New Playlist', count: 0, songs: [] }
    });
  } catch (e) {
    return NextResponse.json({ success: true });
  }
}
