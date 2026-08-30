// YouTube & Low Data Streaming Helpers for SyncTune

export function getSongListenCount(songId) {
  if (typeof window === 'undefined' || !songId) return 0;
  try {
    const counts = JSON.parse(localStorage.getItem('synctune_play_counts') || '{}');
    return counts[songId] || 0;
  } catch (e) {
    return 0;
  }
}

export function recordSongPlay(song) {
  if (typeof window === 'undefined' || !song || !song.id) return 1;
  try {
    const counts = JSON.parse(localStorage.getItem('synctune_play_counts') || '{}');
    counts[song.id] = (counts[song.id] || 0) + 1;
    localStorage.setItem('synctune_play_counts', JSON.stringify(counts));

    // Also store song metadata in dictionary for recommendations
    const metaDict = JSON.parse(localStorage.getItem('synctune_song_metadata') || '{}');
    metaDict[song.id] = {
      id: song.id,
      title: song.title,
      artist: song.artist,
      thumbnail: song.thumbnail,
      duration: song.duration || 210,
      playCount: counts[song.id]
    };
    localStorage.setItem('synctune_song_metadata', JSON.stringify(metaDict));

    return counts[song.id];
  } catch (e) {
    return 1;
  }
}

export function formatPlayMultiplier(count) {
  const num = parseInt(count, 10) || 1;
  return `x${num}`;
}

export function formatFullDateTime(dateInput) {
  if (!dateInput) return '30 Aug 2026, 10:45 AM';
  try {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    if (isNaN(date.getTime())) return dateInput;

    const day = date.getDate();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getMonth()];
    const year = date.getFullYear();

    let hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;

    return `${day} ${month} ${year}, ${hours}:${minutes} ${ampm}`;
  } catch (e) {
    return '30 Aug 2026, 10:45 AM';
  }
}

export function getUserRecommendations() {
  if (typeof window === 'undefined') return [];
  try {
    const metaDict = JSON.parse(localStorage.getItem('synctune_song_metadata') || '{}');
    const counts = JSON.parse(localStorage.getItem('synctune_play_counts') || '{}');

    const songList = Object.keys(metaDict).map((id) => ({
      ...metaDict[id],
      playCount: counts[id] || metaDict[id].playCount || 1
    }));

    if (songList.length === 0) {
      return [];
    }

    songList.sort((a, b) => b.playCount - a.playCount);
    return songList.slice(0, 10);
  } catch (e) {
    return [];
  }
}

export async function fetchLiveRecommendations(song) {
  if (!song) return { artistTracks: [], genreTracks: [] };
  try {
    const params = new URLSearchParams({
      artist: song.artist || '',
      title: song.title || '',
      videoId: song.id || ''
    });
    const res = await fetch(`/api/recommend?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      return {
        artistTracks: data.artistTracks || [],
        genreTracks: data.genreTracks || []
      };
    }
  } catch (e) {
    console.error("fetchLiveRecommendations error:", e);
  }
  return { artistTracks: [], genreTracks: [] };
}

export async function searchYouTube(query, category = "music") {
  if (!query || !query.trim()) return [];

  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&type=${category}`);
    if (res.ok) {
      const data = await res.json();
      return data.songs || [];
    }
  } catch (err) {
    console.error("YouTube search error:", err);
  }

  return [];
}

export function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
