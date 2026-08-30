import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    success: true,
    stats: {
      totalUsers: 3,
      activeRooms: 2,
      todayMB: 18.5,
      monthMB: 514.2,
      dataSavedMB: 482.0,
      totalListens: 1240,
      maintenance: false
    },
    users: [
      { id: 1, username: 'Piyush', email: 'piyushpilkhwal74@gmail.com', role: 'admin', current_status: 'active', todayMB: 4.2, monthMB: 128.5 },
      { id: 2, username: 'Aarav', email: 'aarav@gmail.com', role: 'user', current_status: 'listening', todayMB: 12.8, monthMB: 340.0 },
      { id: 3, username: 'Ananya', email: 'ananya@gmail.com', role: 'user', current_status: 'active', todayMB: 1.5, monthMB: 45.2 },
    ],
    rooms: [
      { code: 'BEAT1', host_name: 'Piyush', member_count: 5, song_title: 'One Love', is_playing: 1 },
      { code: 'CHILL', host_name: 'Alex', member_count: 3, song_title: 'Softly', is_playing: 1 }
    ]
  });
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    return NextResponse.json({ success: true, message: 'Action processed successfully' });
  } catch (e) {
    return NextResponse.json({ success: true });
  }
}
