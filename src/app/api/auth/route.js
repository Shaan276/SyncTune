import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Server-side persistent accounts store
if (!global._synctune_accounts) {
  global._synctune_accounts = [
    {
      id: 1,
      username: 'Piyush',
      email: 'piyushpilkhwal74@gmail.com',
      password: 'admin',
      role: 'admin',
      createdAt: '2026-08-30T00:00:00.000Z'
    }
  ];
}

const accountsStore = global._synctune_accounts;

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const action = (body.action || 'login').toLowerCase();
    const email = (body.email || '').trim().toLowerCase();
    const rawUsername = (body.username || '').trim();
    const password = body.password || '';

    // 1. REGISTER (Create New ID)
    if (action === 'register') {
      if (!rawUsername) {
        return NextResponse.json({ success: false, error: 'Please choose a username.' }, { status: 400 });
      }
      if (!email || !email.includes('@')) {
        return NextResponse.json({ success: false, error: 'Please provide a valid email address.' }, { status: 400 });
      }
      if (!password || password.length < 3) {
        return NextResponse.json({ success: false, error: 'Password must be at least 3 characters long.' }, { status: 400 });
      }

      // Check if email already registered
      const existing = accountsStore.find((a) => a.email === email);
      if (existing) {
        return NextResponse.json({
          success: false,
          error: 'An account with this email already exists. Please switch to Sign In.'
        }, { status: 409 });
      }

      const isAdmin = email === 'piyushpilkhwal74@gmail.com' || rawUsername.toLowerCase() === 'piyush';
      const newAccount = {
        id: Date.now(),
        username: rawUsername,
        email,
        password,
        role: isAdmin ? 'admin' : 'user',
        createdAt: new Date().toISOString()
      };

      accountsStore.push(newAccount);

      const { password: _, ...safeUser } = newAccount;
      return NextResponse.json({
        success: true,
        token: `synctune-jwt-${newAccount.id}`,
        user: safeUser
      });
    }

    // 2. LOGIN (Sign In)
    if (!email) {
      return NextResponse.json({ success: false, error: 'Please enter your registered email address.' }, { status: 400 });
    }
    if (!password) {
      return NextResponse.json({ success: false, error: 'Please enter your password.' }, { status: 400 });
    }

    const account = accountsStore.find(
      (a) => a.email === email || a.username.toLowerCase() === email
    );

    // If account does NOT exist: DO NOT auto-create! Return strict error!
    if (!account) {
      return NextResponse.json({
        success: false,
        error: 'No account found with this email. Please click "Create New ID" to register first.'
      }, { status: 404 });
    }

    // Validate Password Strictly
    if (account.password !== password) {
      return NextResponse.json({
        success: false,
        error: 'Incorrect password. Please verify and try again.'
      }, { status: 401 });
    }

    const { password: _, ...safeUser } = account;
    return NextResponse.json({
      success: true,
      token: `synctune-jwt-${account.id}`,
      user: safeUser
    });
  } catch (err) {
    console.error("Auth API Error:", err);
    return NextResponse.json({
      success: false,
      error: 'Authentication server error. Please try again.'
    }, { status: 500 });
  }
}
