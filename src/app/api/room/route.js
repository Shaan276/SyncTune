import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = (searchParams.get('code') || 'BEAT1').toUpperCase();

  return NextResponse.json({
    success: true,
    room: {
      code,
      host_name: 'Piyush',
      host_id: 1,
      member_count: 5,
      song_title: 'One Love',
      song_artist: 'Shubh',
      is_playing: 1,
      current_time: 0
    },
    members: [{ id: 1, username: 'Piyush', is_online: true }],
    rooms: [
      { code: 'BEAT1', host_name: 'Piyush', member_count: 5, song_title: 'One Love', is_playing: 1 },
      { code: 'CHILL', host_name: 'Alex', member_count: 3, song_title: 'Softly', is_playing: 1 }
    ]
  });
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const code = (body.code || 'ROOM1').toUpperCase();

    return NextResponse.json({
      success: true,
      code,
      room: {
        code,
        host_name: body.username || 'Piyush',
        host_id: 1,
        member_count: 1,
        song_title: 'One Love',
        song_artist: 'Shubh',
        is_playing: 1,
        current_time: 0
      }
    });
  } catch (e) {
    return NextResponse.json({ success: true, code: 'BEAT1' });
  }
}
