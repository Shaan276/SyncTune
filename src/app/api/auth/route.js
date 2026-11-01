import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const CLOUD_USERS_BIN = 'https://extendsclass.com/api/json-storage/bin/fccfdcb';
const dataDir = path.join(process.cwd(), 'data');
const usersFilePath = path.join(dataDir, 'users.json');

if (!global._synctune_accounts_cache) {
  global._synctune_accounts_cache = {
    accounts: null,
    lastFetched: 0
  };
}

function getAccountsFromDisk() {
  try {
    if (fs.existsSync(usersFilePath)) {
      const raw = fs.readFileSync(usersFilePath, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (err) {}
  return [];
}

function saveAccountsToDisk(accounts) {
  try {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(usersFilePath, JSON.stringify(accounts, null, 2), 'utf-8');
    return true;
  } catch (err) {
    return false;
  }
}

// Global cross-device account fetcher (Syncs Mobile & PC seamlessly)
async function getAccounts(forceFresh = false) {
  const cache = global._synctune_accounts_cache;
  const now = Date.now();

  if (!forceFresh && cache.accounts && (now - cache.lastFetched < 3000)) {
    return cache.accounts;
  }

  // 1. Fetch from cloud multi-device persistent store
  try {
    const res = await fetch(`${CLOUD_USERS_BIN}?_t=${now}`, {
      headers: { 'Accept': 'application/json' },
      cache: 'no-store'
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.users) && data.users.length > 0) {
        cache.accounts = data.users;
        cache.lastFetched = now;
        saveAccountsToDisk(data.users);
        return cache.accounts;
      }
    }
  } catch (err) {
    console.warn('Cloud accounts fetch deferred:', err.message);
  }

  // 2. Fallback to memory or disk
  if (cache.accounts) return cache.accounts;
  const diskAccounts = getAccountsFromDisk();
  cache.accounts = diskAccounts;
  cache.lastFetched = now;
  return diskAccounts;
}

// Global cross-device account saver
async function saveAccounts(accounts) {
  const cache = global._synctune_accounts_cache;
  cache.accounts = accounts;
  cache.lastFetched = Date.now();

  saveAccountsToDisk(accounts);

  try {
    await fetch(CLOUD_USERS_BIN, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ users: accounts })
    });
  } catch (err) {
    console.warn('Cloud accounts sync deferred:', err.message);
  }
  return true;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const action = (searchParams.get('action') || 'search').toLowerCase();
  const query = (searchParams.get('q') || '').trim().toLowerCase();

  const accounts = await getAccounts(true);

  if (action === 'search' && query) {
    const results = accounts
      .filter((a) => a.username.toLowerCase().includes(query) || a.email.toLowerCase().includes(query))
      .map(({ password, ...safe }) => safe)
      .slice(0, 10);
    return NextResponse.json({ success: true, users: results });
  }

  return NextResponse.json({
    success: true,
    total: accounts.length
  });
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const action = (body.action || 'login').toLowerCase();
    const email = (body.email || '').trim().toLowerCase();
    const rawUsername = (body.username || '').trim();
    const password = body.password || '';

    // Always fetch latest cloud-synced accounts
    const accounts = await getAccounts(true);

    // 0. VERIFY SESSION (Validates if existing user is still in database)
    if (action === 'verify') {
      const userKey = body.id ? String(body.id).toLowerCase() : '';
      const userEmail = (body.email || email).trim().toLowerCase();
      const account = accounts.find(
        (a) => (userKey && String(a.id).toLowerCase() === userKey) ||
               (userEmail && a.email.toLowerCase() === userEmail)
      );
      if (!account) {
        return NextResponse.json({ success: false, error: 'Account has been deleted or does not exist.' }, { status: 404 });
      }
      const { password: _, ...safeUser } = account;
      return NextResponse.json({ success: true, user: safeUser });
    }

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

      const newAccount = {
        id: Date.now(),
        username: rawUsername,
        email,
        password,
        role: 'user',
        createdAt: new Date().toISOString()
      };

      accounts.push(newAccount);
      await saveAccounts(accounts);

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
