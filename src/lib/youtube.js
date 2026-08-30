// YouTube & Low Data Streaming Helpers for SyncTune

export const TOP_RECOMMENDED_SONGS = [
  {
    id: "4NRXx6U8ABQ",
    title: "Blinding Lights - Official Music Video",
    artist: "The Weeknd",
    duration: 260,
    thumbnail: "https://img.youtube.com/vi/4NRXx6U8ABQ/mqdefault.jpg",
    basePlays: 4890120
  },
  {
    id: "JGwWNGJdvx8",
    title: "Shape of You - Official Music Video",
    artist: "Ed Sheeran",
    duration: 234,
    thumbnail: "https://img.youtube.com/vi/JGwWNGJdvx8/mqdefault.jpg",
    basePlays: 4510400
  },
  {
    id: "34Na4j8AVgA",
    title: "Starboy - ft. Daft Punk",
    artist: "The Weeknd",
    duration: 230,
    thumbnail: "https://img.youtube.com/vi/34Na4j8AVgA/mqdefault.jpg",
    basePlays: 3820300
  },
  {
    id: "7wtfhZwyrcc",
    title: "Believer - Official Music Video",
    artist: "Imagine Dragons",
    duration: 204,
    thumbnail: "https://img.youtube.com/vi/7wtfhZwyrcc/mqdefault.jpg",
    basePlays: 3410500
  },
  {
    id: "60ItHLz5WEA",
    title: "Faded - Official Music Video",
    artist: "Alan Walker",
    duration: 212,
    thumbnail: "https://img.youtube.com/vi/60ItHLz5WEA/mqdefault.jpg",
    basePlays: 3120900
  },
  {
    id: "hT_nvWreIhg",
    title: "One Love - Official Music Video",
    artist: "Shubh",
    duration: 160,
    thumbnail: "https://img.youtube.com/vi/hT_nvWreIhg/mqdefault.jpg",
    basePlays: 2650400
  },
  {
    id: "BddP6PYo2gs",
    title: "Kesariya - Brahmāstra",
    artist: "Arijit Singh, Pritam",
    duration: 268,
    thumbnail: "https://img.youtube.com/vi/BddP6PYo2gs/mqdefault.jpg",
    basePlays: 2430200
  },
  {
    id: "vJQMv7A_N30",
    title: "Cheques - Official Music Video",
    artist: "Shubh",
    duration: 184,
    thumbnail: "https://img.youtube.com/vi/vJQMv7A_N30/mqdefault.jpg",
    basePlays: 2190800
  },
  {
    id: "A66TYFbgYAM",
    title: "Softly - Official Music Video",
    artist: "Karan Aujla, Ikky",
    duration: 154,
    thumbnail: "https://img.youtube.com/vi/A66TYFbgYAM/mqdefault.jpg",
    basePlays: 1980600
  },
  {
    id: "3gFcCXxjy4U",
    title: "Tauba Tauba - Bad Newz",
    artist: "Karan Aujla",
    duration: 208,
    thumbnail: "https://img.youtube.com/vi/3gFcCXxjy4U/mqdefault.jpg",
    basePlays: 1740500
  }
];

export const DEFAULT_POPULAR_SONGS = TOP_RECOMMENDED_SONGS;

export function getSongListenCount(songId, basePlays = 54200) {
  if (typeof window === 'undefined') return basePlays;
  try {
    const counts = JSON.parse(localStorage.getItem('synctune_play_counts') || '{}');
    return (counts[songId] || 0) + basePlays;
  } catch (e) {
    return basePlays;
  }
}

export function recordSongPlay(songId) {
  if (typeof window === 'undefined' || !songId) return;
  try {
    const counts = JSON.parse(localStorage.getItem('synctune_play_counts') || '{}');
    counts[songId] = (counts[songId] || 0) + 1;
    localStorage.setItem('synctune_play_counts', JSON.stringify(counts));
  } catch (e) {}
}

export function formatListenCount(count) {
  if (!count || isNaN(count)) return '1.2K plays';
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M plays`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K plays`;
  }
  return `${count} plays`;
}

export function getTop10RecommendedSongs() {
  return [...TOP_RECOMMENDED_SONGS]
    .map(song => ({
      ...song,
      currentPlays: getSongListenCount(song.id, song.basePlays || 50000)
    }))
    .sort((a, b) => b.currentPlays - a.currentPlays);
}

export async function searchYouTube(query, category = "music") {
  if (!query || !query.trim()) return [];

  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&type=${category}`);
    if (res.ok) {
      const data = await res.json();
      return (data.songs || []).map(s => ({
        ...s,
        basePlays: Math.floor(15000 + Math.random() * 85000)
      }));
    }
  } catch (err) {
    console.error("YouTube search error:", err);
  }

  return TOP_RECOMMENDED_SONGS.filter(s => 
    s.title.toLowerCase().includes(query.toLowerCase()) || 
    s.artist.toLowerCase().includes(query.toLowerCase())
  );
}

export function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
