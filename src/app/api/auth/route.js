import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const action = body.action || 'login';
    const email = (body.email || '').trim().toLowerCase();
    const rawUsername = (body.username || '').trim();
    const username = rawUsername || (email ? email.split('@')[0] : 'Listener');
    
    // Only designated admin email or explicit admin username gets admin role
    const isAdmin = email === 'piyushpilkhwal74@gmail.com' || username.toLowerCase() === 'piyush';
    const role = isAdmin ? 'admin' : 'user';

    const userObj = {
      id: Date.now(),
      username,
      email: email || 'listener@synctune.app',
      role,
      status: 'active',
      createdAt: new Date().toISOString()
    };

    return NextResponse.json({
      success: true,
      token: `synctune-jwt-${Date.now()}`,
      user: userObj
    });
  } catch (e) {
    return NextResponse.json({
      success: true,
      token: 'synctune-jwt-token-v3',
      user: { id: 1, username: 'Listener', email: 'user@synctune.app', role: 'user' }
    });
  }
}
