import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const dataDir = path.join(process.cwd(), 'data');
const usersFilePath = path.join(dataDir, 'users.json');

function getUsers() {
  try {
    if (!fs.existsSync(usersFilePath)) return [];
    const raw = fs.readFileSync(usersFilePath, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

function saveUsers(users) {
  try {
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2), 'utf-8');
    return true;
  } catch (e) {
    return false;
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const email = searchParams.get('email');

  const users = getUsers();
  const user = users.find(u => (userId && String(u.id) === String(userId)) || (email && u.email.toLowerCase() === email.toLowerCase()));

  if (!user) {
    return NextResponse.json({ success: true, history: [] });
  }

  return NextResponse.json({
    success: true,
    history: user.listened_history || []
  });
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { userId, email, song } = body;

    if (!song || !song.id) {
      return NextResponse.json({ success: false, error: 'Invalid song object' }, { status: 400 });
    }

    const users = getUsers();
    const userIndex = users.findIndex(u => (userId && String(u.id) === String(userId)) || (email && u.email.toLowerCase() === email.toLowerCase()));

    if (userIndex === -1) {
      return NextResponse.json({ success: true, history: [] }, { status: 200 });
    }

    const user = users[userIndex];
    if (!user.listened_history) {
      user.listened_history = [];
    }

    const songEntry = {
      id: song.id,
      title: song.title || 'Unknown Title',
      artist: song.artist || 'Unknown Artist',
      duration: song.duration || 210,
      thumbnail: song.thumbnail || (/^[a-zA-Z0-9_-]{11}$/.test(song.id) ? `https://img.youtube.com/vi/${song.id}/mqdefault.jpg` : 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80'),
      listenedAt: new Date().toISOString()
    };

    // Filter out duplicate and insert at the top of the history stack
    user.listened_history = [
      songEntry,
      ...user.listened_history.filter(s => s.id !== song.id)
    ].slice(0, 50);

    users[userIndex] = user;
    saveUsers(users);

    return NextResponse.json({
      success: true,
      history: user.listened_history
    });
  } catch (err) {
    console.error('History API Error:', err);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const email = searchParams.get('email');

  const users = getUsers();
  const userIndex = users.findIndex(u => (userId && String(u.id) === String(userId)) || (email && u.email.toLowerCase() === email.toLowerCase()));

  if (userIndex !== -1) {
    users[userIndex].listened_history = [];
    saveUsers(users);
  }

  return NextResponse.json({ success: true, history: [] });
}
