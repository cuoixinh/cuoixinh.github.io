// ============================================================
// YOUTUBE-HELPER.JS - YouTube Music Player functionality
// ============================================================

let youtubePlayer = null;
let isYouTubeMusicReady = false;
let isYouTubePlaying = false;
// Biết từ lúc khởi tạo, không phải đợi player nạp xong metadata — dùng để dựng
// URL ảnh bìa (thumbnail) cho UI hiển thị sớm.
let _musicVideoId = null;

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

function initYouTubeMusic(musicUrl) {
  if (
    !musicUrl ||
    (!musicUrl.includes("youtube.com") && !musicUrl.includes("youtu.be"))
  ) {
    return;
  }

  const videoId = extractYouTubeVideoId(musicUrl);
  if (!videoId) return;
  _musicVideoId = videoId;

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
            _emitMusicState();
          },
          onStateChange: (event) => {
            if (event.data === YT.PlayerState.ENDED) {
              event.target.playVideo();
            }
            isYouTubePlaying = event.data === YT.PlayerState.PLAYING;
            updateMusicIcon();
            _emitMusicState();
          },
        },
      });
    }
  }, 100);
}

/**
 * Trình duyệt chặn tự phát khi trang chưa có tương tác nào → chờ tương tác đầu
 * tiên (chạm/bấm/cuộn/gõ phím) rồi mới phát. Người dùng đã tự bấm tắt thì thôi.
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
  _emitMusicState();
}

/** Phát tiếp — CHỈ khi người dùng chưa chủ động bấm dừng. */
function resumeMusicIfAllowed() {
  if (!youtubePlayer || isYouTubePlaying || _musicUserPaused) return false;
  try {
    youtubePlayer.playVideo();
  } catch (e) {
    return false;
  }
  return true;
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

// ── Thông tin bài đang phát (cho theme vẽ thanh nhạc kiểu app nghe nhạc) ────

function getMusicInfo() {
  let title = "";
  let author = "";
  let videoId = _musicVideoId || "";
  try {
    // getVideoData chỉ có sau khi player nạp xong metadata → có thể rỗng ở
    // những lần gọi đầu, người gọi cứ hỏi lại ở lần cập nhật sau.
    const d =
      youtubePlayer &&
      youtubePlayer.getVideoData &&
      youtubePlayer.getVideoData();
    if (d) {
      title = d.title || "";
      author = d.author || "";
      videoId = d.video_id || videoId;
    }
  } catch (e) {}
  return {
    playing: isYouTubePlaying,
    title,
    author,
    videoId,
    // mqdefault: 320×180, luôn tồn tại với mọi video (maxres thì không).
    thumbnail: videoId
      ? "https://img.youtube.com/vi/" + videoId + "/mqdefault.jpg"
      : "",
  };
}

/**
 * @returns {{current: number, duration: number}} giây
 */
function getMusicPosition() {
  try {
    if (youtubePlayer && youtubePlayer.getDuration) {
      return {
        current: youtubePlayer.getCurrentTime() || 0,
        duration: youtubePlayer.getDuration() || 0,
      };
    }
  } catch (e) {}
  return { current: 0, duration: 0 };
}

/** Tua tới giây chỉ định. */
function seekMusic(seconds) {
  try {
    if (youtubePlayer && youtubePlayer.seekTo) {
      youtubePlayer.seekTo(Math.max(0, seconds), true);
    }
  } catch (e) {}
}

function _emitMusicState() {
  try {
    window.dispatchEvent(
      new CustomEvent("cx:music-state", { detail: getMusicInfo() }),
    );
  } catch (e) {}
}

// Make toggle function global
window.toggleYouTubeMusic = toggleYouTubeMusic;
window.getMusicInfo = getMusicInfo;
window.resumeMusicIfAllowed = resumeMusicIfAllowed;
window.getMusicPosition = getMusicPosition;
window.seekMusic = seekMusic;
