// YouTube & Low Data Streaming Helpers for SyncTune

export const DEFAULT_POPULAR_SONGS = [
  {
    id: "hT_nvWreIhg",
    title: "One Love - Official Music Video",
    artist: "Shubh",
    duration: 160,
    thumbnail: "https://img.youtube.com/vi/hT_nvWreIhg/mqdefault.jpg"
  },
  {
    id: "vJQMv7A_N30",
    title: "Cheques - Official Music Video",
    artist: "Shubh",
    duration: 184,
    thumbnail: "https://img.youtube.com/vi/vJQMv7A_N30/mqdefault.jpg"
  },
  {
    id: "cl0a3iBN78U",
    title: "Elevated - Official Music Video",
    artist: "Shubh",
    duration: 202,
    thumbnail: "https://img.youtube.com/vi/cl0a3iBN78U/mqdefault.jpg"
  },
  {
    id: "A66TYFbgYAM",
    title: "Softly - Official Music Video",
    artist: "Karan Aujla, Ikky",
    duration: 154,
    thumbnail: "https://img.youtube.com/vi/A66TYFbgYAM/mqdefault.jpg"
  },
  {
    id: "3gFcCXxjy4U",
    title: "Tauba Tauba - Bad Newz",
    artist: "Karan Aujla",
    duration: 208,
    thumbnail: "https://img.youtube.com/vi/3gFcCXxjy4U/mqdefault.jpg"
  },
  {
    id: "k4g4X32dJ8Q",
    title: "Winning Speech - Official Music Video",
    artist: "Karan Aujla",
    duration: 215,
    thumbnail: "https://img.youtube.com/vi/k4g4X32dJ8Q/mqdefault.jpg"
  }
];

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

  // Fallback filtering if API fetch is unavailable
  return DEFAULT_POPULAR_SONGS.filter(s => 
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
