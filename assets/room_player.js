// room_player.js - Manages a separate YouTube player for each room
// This script expects that the YouTube Iframe API is already loaded (as done by the main bundle).

// Map to store YT.Player instances keyed by room code
window.roomPlayers = new Map();

/**
 * Returns a YT.Player instance for the given room code.
 * If the player does not exist yet, it will be created and attached to a dynamically
 * generated container element. The container is inserted into the DOM but kept hidden.
 *
 * @param {string} roomCode - Upper‑case room identifier.
 * @returns {YT.Player} The YouTube player for the room.
 */
window.getRoomPlayer = function(roomCode) {
  if (!roomCode) {
    console.error('getRoomPlayer: roomCode is required');
    return null;
  }
  const code = roomCode.toUpperCase();
  if (window.roomPlayers.has(code)) {
    return window.roomPlayers.get(code);
  }

  // Create a hidden container for the player if it doesn't exist
  const containerId = `yt-player-${code}`;
  let container = document.getElementById(containerId);
  if (!container) {
    container = document.createElement('div');
    container.id = containerId;
    // Keep it off‑screen but still part of the layout for the API to work.
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '-9999px';
    container.style.width = '200px';
    container.style.height = '200px';
    document.body.appendChild(container);
  }

  // Create a new YouTube player attached to this container.
  const player = new YT.Player(containerId, {
    host: 'https://www.youtube-nocookie.com',
    height: '200',
    width: '200',
    videoId: '', // will be set later via loadVideoById
    playerVars: {
      autoplay: 0,
      controls: 0,
      disablekb: 1,
      fs: 0,
      rel: 0,
      showinfo: 0,
      modestbranding: 1,
      origin: window.location.origin
    },
    events: {
      onReady: function(event) {
        // Immediately set volume to a default (e.g., 50%). Adjust as needed.
        event.target.setVolume(50);
      },
      onStateChange: function(event) {
        // The application will handle sync logic elsewhere; we only expose the player.
      }
    }
  });

  window.roomPlayers.set(code, player);
  return player;
};

/**
 * Utility to destroy a room's player when the room is empty.
 * Call this from your server‑side cleanup logic if desired.
 */
window.destroyRoomPlayer = function(roomCode) {
  const code = roomCode ? roomCode.toUpperCase() : null;
  if (!code) return;
  const player = window.roomPlayers.get(code);
  if (player && typeof player.destroy === 'function') {
    player.destroy();
  }
  const container = document.getElementById(`yt-player-${code}`);
  if (container && container.parentNode) {
    container.parentNode.removeChild(container);
  }
  window.roomPlayers.delete(code);
};
