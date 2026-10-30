import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const dataDir = path.join(process.cwd(), 'data');
const usersFilePath = path.join(dataDir, 'users.json');

// Ensure directory and initial file exist
function getAccountsFromDisk() {
  try {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    if (!fs.existsSync(usersFilePath)) {
      const defaultUsers = [
        {
          id: 1,
          username: 'Piyush',
          email: 'piyushpilkhwal74@gmail.com',
          password: 'admin',
          role: 'admin',
          createdAt: '2026-08-30T00:00:00.000Z'
        }
      ];
      fs.writeFileSync(usersFilePath, JSON.stringify(defaultUsers, null, 2), 'utf-8');
      return defaultUsers;
    }
    const raw = fs.readFileSync(usersFilePath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch (err) {
    console.error('Error reading users from disk:', err);
  }
  return [
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

function saveAccountsToDisk(accounts) {
  try {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(usersFilePath, JSON.stringify(accounts, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Error saving users to disk:', err);
    return false;
  }
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const action = (body.action || 'login').toLowerCase();
    const email = (body.email || '').trim().toLowerCase();
    const rawUsername = (body.username || '').trim();
    const password = body.password || '';

    // Always load current persisted accounts from disk
    const accounts = getAccountsFromDisk();

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

      // Check if email or username already registered
      const existing = accounts.find(
        (a) => a.email.toLowerCase() === email || a.username.toLowerCase() === rawUsername.toLowerCase()
      );
      if (existing) {
        return NextResponse.json({
          success: false,
          error: existing.email.toLowerCase() === email
            ? 'An account with this email already exists. Please switch to Sign In.'
            : 'This username is already taken. Please choose another.'
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

      accounts.push(newAccount);
      saveAccountsToDisk(accounts);

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

    const account = accounts.find(
      (a) => a.email.toLowerCase() === email || a.username.toLowerCase() === email
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
