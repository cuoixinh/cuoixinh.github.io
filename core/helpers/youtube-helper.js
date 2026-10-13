// ============================================================
// YOUTUBE-HELPER.JS - YouTube Music Player functionality
// ============================================================

let youtubePlayer = null;
let isYouTubeMusicReady = false;
let isYouTubePlaying = false;
// Biết từ lúc khởi tạo, không phải đợi player nạp xong metadata — dùng để dựng
// URL ảnh bìa (thumbnail) cho UI hiển thị sớm.
let _musicVideoId = null;

// ?cxdebug=music → nhật ký nhạc ngay trên màn hình, để dò lỗi trên điện thoại thật.
if (/[?&]cxdebug=music\b/.test(location.search)) {
  const s = document.createElement("script");
  s.src = "/core/helpers/music-debug.js";
  document.head.appendChild(s);
}

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
  // Giây bắt đầu (tham số `t` trong link, chỉnh ở tab Cấu hình). Có thì tự lặp
  // ở ENDED bằng seekTo: `loop`+`playlist` của YouTube quay về giây 0.
  const start = typeof cxYtStart === "function" ? cxYtStart(musicUrl) : 0;
  const loopVars = start ? { start } : { loop: 1, playlist: videoId };

  loadYouTubeAPI();

  const checkReady = setInterval(() => {
    if (window.YT && window.YT.Player) {
      clearInterval(checkReady);

      // Player ghim TRONG màn, 200×200, mờ 0.01, không bắt chạm. Đo trên iPhone
      // (Zalo): iframe 0×0 thì iOS chặn phát hẳn, khung hiện rõ thì video bật ra
      // toàn màn hình — chỉ khung lớn mà gần như trong suốt là phát yên trong trang.
      let playerContainer = document.getElementById("youtube-music-player");
      if (!playerContainer) {
        const host = document.createElement("div");
        host.setAttribute("aria-hidden", "true");
        host.style.cssText =
          "position:fixed;left:0;bottom:0;width:200px;height:200px;overflow:hidden;opacity:0.01;pointer-events:none;z-index:2147483000";
        playerContainer = document.createElement("div");
        playerContainer.id = "youtube-music-player";
        host.appendChild(playerContainer);
        document.body.appendChild(host);
      }

      youtubePlayer = new YT.Player("youtube-music-player", {
        height: "200",
        width: "200",
        videoId: videoId,
        playerVars: {
          // Không tự phát — chờ khách cuộn sau khi mở bìa (_playOnScroll).
          autoplay: 0,
          ...loopVars,
          controls: 0,
          showinfo: 0,
          modestbranding: 1,
          // iOS thiếu cờ này là phát bằng trình phát toàn màn của máy — video
          // YouTube bật ra che thiệp.
          playsinline: 1,
        },
        events: {
          onReady: (event) => {
            // Nhỏ hết cỡ trước, _fadeInMusic kéo lên khi thật sự phát.
            event.target.setVolume(0);
            // Khung chỉnh giao diện (?edit=1, tab Giao diện của trang Thiết lập)
            // KHÔNG tự phát — nhạc chỉ nghe ở Chỉnh sửa/Xem trước; bấm nút nhạc
            // vẫn phát được để thử trình phát.
            if (_cxMusicNoAutoplay()) _musicUserPaused = true;
            if (!_musicUserPaused) {
              _primeOnTap();
              _playOnScroll();
            }
            _emitMusicState();
          },
          onStateChange: (event) => {
            if (event.data === YT.PlayerState.ENDED) {
              if (start) event.target.seekTo(start, true);
              event.target.playVideo();
            }
            const S = YT.PlayerState;
            // Lượt mở khoá của _primeOnTap đã chạy (tắt tiếng) → dừng, tua về đầu
            // bài, trả tiếng lại.
            if (event.data === S.PLAYING && _musicPriming) {
              _musicPriming = false;
              _musicPrimed = true;
              _primeOff();
              event.target.pauseVideo();
              event.target.seekTo(start || 0, true);
              event.target.unMute();
              return;
            }
            // Lượt phát đầu đi đường tắt tiếng (_playMusic) đã chạy → để nó chạy câm
            // MUSIC_UNMUTE_DELAY_MS rồi mới bật tiếng.
            if (event.data === S.PLAYING && _musicUnmuteOnPlay) {
              _musicUnmuteOnPlay = false;
              _musicPrimed = true;
              setTimeout(() => {
                if (!isYouTubePlaying || _musicUserPaused) return;
                youtubePlayer.unMute();
                _fadeInMusic(youtubePlayer);
              }, MUSIC_UNMUTE_DELAY_MS);
            }
            // Đang bị dừng (người bấm, hoặc trang cha gọi cxMusicPause) mà
            // player tự phát — autoplay của onReady tới muộn — thì dừng lại.
            if (event.data === S.PLAYING && _musicUserPaused) {
              event.target.pauseVideo();
              return;
            }
            if (event.data === S.PLAYING && !_musicAudible) {
              _musicAudible = true;
              _fadeInMusic(event.target);
            } else if (event.data !== S.PLAYING && event.data !== S.BUFFERING) {
              _musicAudible = false;
              _stopMusicFade();
            }
            isYouTubePlaying = event.data === S.PLAYING;
            updateMusicIcon();
            _emitMusicState();
          },
        },
      });
    }
  }, 100);
}

// Mỗi lần bắt đầu phát (lần đầu, phát tiếp sau khi dừng, quay vòng) âm lượng
// tăng dần từ 0 lên MUSIC_VOLUME trong MUSIC_FADE_MS — không phát to đột ngột.
// Đường cong bình phương: tai nghe theo log, tăng tuyến tính thì vài phần trăm
// đầu đã nghe rõ nên vẫn thấy bật lên. iOS bỏ qua setVolume (âm lượng theo phím
// cứng) nên ở đó không có hiệu ứng này.
const MUSIC_VOLUME = 100;
const MUSIC_FADE_MS = 2000;
let _musicFadeTimer = null;
// Riêng với isYouTubePlaying (toggle đặt trước khi player báo): chỉ dừng/hết bài
// mới tính là tắt — BUFFERING lúc tua hay mạng chậm không fade lại từ 0.
let _musicAudible = false;

function _stopMusicFade() {
  clearInterval(_musicFadeTimer);
  _musicFadeTimer = null;
}

function _fadeInMusic(player) {
  _stopMusicFade();
  const t0 = Date.now();
  const step = () => {
    const k = Math.min(1, (Date.now() - t0) / MUSIC_FADE_MS);
    try {
      player.setVolume(Math.round(MUSIC_VOLUME * k * k));
    } catch (e) {}
    if (k >= 1) _stopMusicFade();
  };
  step();
  _musicFadeTimer = setInterval(step, 50);
}

// Nhạc CHỈ tự phát khi khách bắt đầu CUỘN thiệp — bấm "Mở thiệp" chưa tính: màn
// bìa còn đó (hoặc vừa đóng mà chưa cuộn) thì im. Nghe THAO TÁC cuộn (lăn chuột,
// vuốt, phím) chứ không nghe sự kiện `scroll`: openInvitation và onOpen của mẫu
// lật trang tự cuộn bằng code lúc mở bìa, nghe `scroll` là nhạc bật khi chưa ai cuộn.
const _MUSIC_SCROLLS = ["wheel", "touchmove"];
const _MUSIC_SCROLL_KEYS = ["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Space", "End", "Home"];
let _musicUserPaused = false;
let _musicScrollArmed = false;

// iOS chỉ cho phát tiếng sau một cú CHẠM, mà vuốt không tính — phát lúc cuộn bị
// chặn tới tận cú chạm kế tiếp. Nên mượn cú chạm sớm nhất (thường là "Mở thiệp")
// phát TẮT TIẾNG rồi dừng ngay (onStateChange): trình phát đã được mở khoá, lần
// phát lúc cuộn không cần chạm nữa. touchend/click chứ không pointerdown — chạm
// xuống chưa phải kích hoạt trên iOS.
const _MUSIC_PRIME_EVENTS = ["touchend", "click", "keydown"];
let _musicPriming = false;
let _primeOff = () => {};

// Lần ĐẦU player thật sự chạy phải TẮT tiếng: đo trên iPhone, lần đầu đã có tiếng
// là iOS bật video ra toàn màn hình; chạy tắt tiếng một lần rồi thì bật tiếng / phát
// lại vẫn nằm yên trong trang. Mọi đường phát nhạc đi qua _playMusic. Hai lần đo
// chạy yên đều bật tiếng sau ≥1,3 giây chạy câm — bật ngay lúc PLAYING chưa đo.
const MUSIC_UNMUTE_DELAY_MS = 1500;
let _musicPrimed = false;
let _musicUnmuteOnPlay = false;

function _playMusic() {
  if (_musicPrimed) {
    youtubePlayer.unMute();
  } else {
    _musicUnmuteOnPlay = true;
    youtubePlayer.mute();
  }
  youtubePlayer.playVideo();
}

function _primeOnTap() {
  const onTap = () => {
    if (!youtubePlayer || isYouTubePlaying || _musicUserPaused) return;
    _musicPriming = true;
    try {
      youtubePlayer.mute();
      youtubePlayer.playVideo();
    } catch (e) {}
  };
  _primeOff = () => {
    _MUSIC_PRIME_EVENTS.forEach((ev) => document.removeEventListener(ev, onTap, true));
  };
  _MUSIC_PRIME_EVENTS.forEach((ev) =>
    document.addEventListener(ev, onTap, { capture: true, passive: true }),
  );
}

// Phát THẬT (cuộn, bấm nút nhạc): lượt mở khoá đang dở thì thôi dừng nó, cứ để
// chạy tiếp (vẫn tắt tiếng) — _playMusic lo bật tiếng. Đừng unMute ở đây: lượt đó
// chưa PLAYING mà có tiếng là thành "lần đầu đã có tiếng".
function _primeCancel() {
  _primeOff();
  _musicPriming = false;
}

// Thiệp không có màn bìa, hoặc bìa đã đóng (openInvitation ẩn #cover-screen).
function _cxCoverClosed() {
  const c = document.getElementById("cover-screen");
  return !c || getComputedStyle(c).display === "none";
}

function _playOnScroll() {
  if (_musicScrollArmed) return;
  _musicScrollArmed = true;

  const off = () => {
    _MUSIC_SCROLLS.forEach((ev) => document.removeEventListener(ev, onScroll, true));
    document.removeEventListener("keydown", onKey, true);
    _musicScrollArmed = false;
  };
  const onScroll = () => {
    if (!_cxCoverClosed()) return;
    off();
    if (!youtubePlayer || isYouTubePlaying || _musicUserPaused) return;
    _primeCancel();
    _playMusic();
    // Cuộn không phải "user activation": máy chưa từng được chạm (iOS hay gặp)
    // có thể chặn phát → chờ cú chạm/bấm kế tiếp.
    setTimeout(() => {
      if (!isYouTubePlaying && !_musicUserPaused) _playOnFirstGesture();
    }, 1000);
  };
  const onKey = (e) => {
    if (_MUSIC_SCROLL_KEYS.indexOf(e.code) >= 0) onScroll();
  };

  _MUSIC_SCROLLS.forEach((ev) =>
    document.addEventListener(ev, onScroll, { capture: true, passive: true }),
  );
  document.addEventListener("keydown", onKey, true);
}

// Lối dự phòng khi trình duyệt chặn lần phát do cuộn: cú chạm/bấm/gõ phím kế
// tiếp mới đủ quyền phát. touchend/click chứ không touchstart/pointerdown — chạm
// xuống chưa được tính là kích hoạt trên iOS, mà listener tự gỡ ở sự kiện đầu.
const _MUSIC_GESTURES = ["touchend", "click", "keydown"];
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
    _primeCancel();
    _playMusic();
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
    _primeCancel();
    _playMusic();
    isYouTubePlaying = true;
    _musicUserPaused = false;
  }
  updateMusicIcon();
  _emitMusicState();
}

function _cxMusicNoAutoplay() {
  try {
    return new URLSearchParams(location.search).get("edit") === "1";
  } catch (e) {
    return false;
  }
}

/**
 * Dừng nhạc như thể người xem bấm dừng (không tự phát lại khi chạm). Trang Thiết
 * lập gọi qua iframe khi rời tab Chỉnh sửa/Xem trước: iframe bị ẩn vẫn phát tiếp.
 */
function cxMusicPause() {
  _musicUserPaused = true;
  if (!youtubePlayer || !isYouTubePlaying) return;
  try {
    youtubePlayer.pauseVideo();
  } catch (e) {
    return;
  }
  isYouTubePlaying = false;
  updateMusicIcon();
  _emitMusicState();
}

// Khách rời trang (về màn hình chính, đổi tab/app) thì dừng, quay lại thì phát
// tiếp: iOS để nhạc chạy dở lúc rời Safari là bật video YouTube ra cửa sổ nổi (PiP).
// Không đụng _musicUserPaused — đây không phải khách bấm dừng.
let _musicHiddenPause = false;
document.addEventListener("visibilitychange", () => {
  if (!youtubePlayer) return;
  if (document.hidden) {
    if (!isYouTubePlaying) return;
    _musicHiddenPause = true;
    try {
      youtubePlayer.pauseVideo();
    } catch (e) {}
  } else if (_musicHiddenPause) {
    _musicHiddenPause = false;
    if (!resumeMusicIfAllowed()) return;
    // Máy chặn lần phát tiếp không có cú chạm → chờ cú chạm kế tiếp.
    setTimeout(() => {
      if (!isYouTubePlaying && !_musicUserPaused) _playOnFirstGesture();
    }, 1000);
  }
});

/** Phát tiếp — CHỈ khi người dùng chưa chủ động bấm dừng. */
function resumeMusicIfAllowed() {
  if (!youtubePlayer || isYouTubePlaying || _musicUserPaused) return false;
  try {
    _primeCancel();
    _playMusic();
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
  if (!musicIcon) return;
  // Thẻ #music-icon là thẻ BỌC; icon do lucide dựng, phải gọi createIcons lại
  // sau mỗi lần thay ruột vì thư viện chỉ quét khi được gọi.
  musicIcon.innerHTML = `<i data-lucide="${
    isYouTubePlaying ? "pause" : "music"
  }" style="width:18px;height:18px"></i>`;
  window.lucide?.createIcons({ root: musicIcon });
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
window.cxMusicPause = cxMusicPause;
window.getMusicInfo = getMusicInfo;
window.resumeMusicIfAllowed = resumeMusicIfAllowed;
window.getMusicPosition = getMusicPosition;
window.seekMusic = seekMusic;
