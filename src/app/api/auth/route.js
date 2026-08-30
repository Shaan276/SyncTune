import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = body.email || 'piyushpilkhwal74@gmail.com';
    const username = body.username || email.split('@')[0] || 'Piyush';
    
    return NextResponse.json({
      token: 'synctune-jwt-token-v3',
      user: { id: 1, username, email, role: 'admin' },
      status: 'active'
    });
  } catch (e) {
    return NextResponse.json({
      token: 'synctune-jwt-token-v3',
      user: { id: 1, username: 'Piyush', email: 'piyushpilkhwal74@gmail.com', role: 'admin' },
      status: 'active'
    });
  }
}
