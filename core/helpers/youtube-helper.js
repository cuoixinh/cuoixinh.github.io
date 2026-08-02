// ============================================================
// YOUTUBE-HELPER.JS - YouTube Music Player functionality
// ============================================================

let youtubePlayer = null;
let isYouTubeMusicReady = false;
let isYouTubePlaying = false;

/**
 * Load YouTube IFrame API
 */
function loadYouTubeAPI() {
  if (!window.YT) {
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName("script")[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
  }
}

/**
 * YouTube API ready callback
 */
window.onYouTubeIframeAPIReady = function () {
  isYouTubeMusicReady = true;
};

/**
 * Extract YouTube video ID from URL
 * @param {string} url - YouTube URL
 * @returns {string|null} Video ID or null
 */
function extractYouTubeVideoId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/,
    /youtube\.com\/embed\/([^&\n?#]+)/,
    /youtube\.com\/v\/([^&\n?#]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  return null;
}

/**
 * Initialize YouTube music player
 * @param {string} musicUrl - YouTube URL
 */
function initYouTubeMusic(musicUrl) {
  if (
    !musicUrl ||
    (!musicUrl.includes("youtube.com") && !musicUrl.includes("youtu.be"))
  ) {
    return;
  }

  const videoId = extractYouTubeVideoId(musicUrl);
  if (!videoId) return;

  loadYouTubeAPI();

  const checkReady = setInterval(() => {
    if (window.YT && window.YT.Player) {
      clearInterval(checkReady);

      let playerContainer = document.getElementById("youtube-music-player");
      if (!playerContainer) {
        playerContainer = document.createElement("div");
        playerContainer.id = "youtube-music-player";
        playerContainer.style.display = "none";
        document.body.appendChild(playerContainer);
      }

      youtubePlayer = new YT.Player("youtube-music-player", {
        height: "0",
        width: "0",
        videoId: videoId,
        playerVars: {
          autoplay: 1,
          loop: 1,
          playlist: videoId,
          controls: 0,
          showinfo: 0,
          modestbranding: 1,
        },
        events: {
          onReady: (event) => {
            event.target.setVolume(30);
            event.target.playVideo();
            // KHÔNG coi như đang phát: trình duyệt có thể chặn (xem
            // _playOnFirstGesture). onStateChange mới là nguồn sự thật.
            _playOnFirstGesture();
          },
          onStateChange: (event) => {
            if (event.data === YT.PlayerState.ENDED) {
              event.target.playVideo();
            }
            isYouTubePlaying = event.data === YT.PlayerState.PLAYING;
            updateMusicIcon();
          },
        },
      });
    }
  }, 100);
}

/**
 * Trình duyệt CHẶN nhạc tự phát khi trang chưa được người dùng chạm vào lần nào,
 * nên playVideo() lúc onReady thường im lặng thất bại. Rõ nhất là khung xem thử:
 * cú bấm "Xem thử" nằm ở TRANG CHA, còn iframe thì vừa nạp xong nên chưa có
 * tương tác nào của riêng nó. Thiệp thật cũng vậy khi mở link lần đầu.
 *
 * Cách chữa: chờ tương tác ĐẦU TIÊN (chạm / bấm / cuộn / gõ phím) rồi phát —
 * lúc đó trình duyệt mới cho. Nghe capture để bắt được cả cú bấm "Mở thiệp".
 * Đang phát hoặc người dùng tự bấm tắt thì thôi, không tự bật lại.
 */
const _MUSIC_GESTURES = ["pointerdown", "touchstart", "keydown", "wheel"];
let _musicUserPaused = false;
let _musicGestureArmed = false;

function _playOnFirstGesture() {
  if (_musicGestureArmed) return;
  _musicGestureArmed = true;

  const onGesture = () => {
    _MUSIC_GESTURES.forEach((ev) =>
      document.removeEventListener(ev, onGesture, true),
    );
    _musicGestureArmed = false;
    if (!youtubePlayer || isYouTubePlaying || _musicUserPaused) return;
    youtubePlayer.playVideo();
    // Cú chạm đó vẫn chưa đủ (hiếm) → chờ tiếp cú sau.
    setTimeout(() => {
      if (!isYouTubePlaying && !_musicUserPaused) _playOnFirstGesture();
    }, 1000);
  };

  _MUSIC_GESTURES.forEach((ev) =>
    document.addEventListener(ev, onGesture, { capture: true, passive: true }),
  );
}

/**
 * Toggle YouTube music play/pause
 */
function toggleYouTubeMusic() {
  if (!youtubePlayer) return;

  if (isYouTubePlaying) {
    youtubePlayer.pauseVideo();
    isYouTubePlaying = false;
    _musicUserPaused = true;
  } else {
    youtubePlayer.playVideo();
    isYouTubePlaying = true;
    _musicUserPaused = false;
  }
  updateMusicIcon();
}

/**
 * Update music icon based on playing state
 */
function updateMusicIcon() {
  const musicIcon = document.getElementById("music-icon");
  if (musicIcon) {
    musicIcon.className = isYouTubePlaying
      ? "fas fa-pause text-lg"
      : "fas fa-music text-lg";
  }
}

// Make toggle function global
window.toggleYouTubeMusic = toggleYouTubeMusic;
