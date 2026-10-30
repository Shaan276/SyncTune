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
  if (!dateInput) {
    const now = new Date();
    return `${now.getDate()} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][now.getMonth()]} ${now.getFullYear()}, ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
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
    return 'Recently';
  }
}

// Generates real recommendations purely from actual user history (Zero fake data)
export function getUserRecommendations(history = []) {
  if (typeof window === 'undefined') return [];

  try {
    const metaDict = JSON.parse(localStorage.getItem('synctune_song_metadata') || '{}');
    const counts = JSON.parse(localStorage.getItem('synctune_play_counts') || '{}');

    // Aggregate from both metadata dictionary and passed history array
    const combinedMap = new Map();

    // 1. From history
    for (const h of history) {
      if (!h || !h.id) continue;
      const count = counts[h.id] || 1;
      combinedMap.set(h.id, {
        id: h.id,
        title: h.title,
        artist: h.artist,
        thumbnail: h.thumbnail,
        duration: h.duration || 210,
        playCount: count
      });
    }

    // 2. From stored metadata dict
    for (const id of Object.keys(metaDict)) {
      if (!combinedMap.has(id)) {
        combinedMap.set(id, {
          ...metaDict[id],
          playCount: counts[id] || metaDict[id].playCount || 1
        });
      }
    }

    const songList = Array.from(combinedMap.values());

    if (songList.length === 0) {
      return [];
    }

    // If only 1 song listened, return that 1 song
    if (songList.length === 1) {
      return songList;
    }

    // Sort by play count descending
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
