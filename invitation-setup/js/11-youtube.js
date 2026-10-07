// Tìm và phát thử nhạc nền YouTube cho thiệp.
//
// Tách từ index.js (dòng 2752–3140 bản gốc). Thứ tự nạp khai báo ở loader.js.

// ============= YOUTUBE SEARCH =============
function _escHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function _renderYtItems(items) {
  return items
    .map(
      (item) => `
    <button type="button" data-yt-url="${_escHtml(item.url)}" data-yt-title="${_escHtml(item.title)}"
      class="yt-result-btn w-full flex gap-3 p-2 rounded-lg hover:bg-rose-50 text-left transition-colors">
      <img src="${_escHtml(item.thumbnail)}" alt="" class="w-20 h-12 rounded object-cover shrink-0 bg-gray-100" loading="lazy" />
      <div class="min-w-0 flex-1">
        <p class="text-xs font-medium text-gray-800 line-clamp-2 leading-snug">${_escHtml(item.title)}</p>
        <p class="text-xs text-gray-500 mt-1">${_escHtml(item.channel)}${item.duration ? " · " + _escHtml(item.duration) : ""}</p>
      </div>
    </button>
  `,
    )
    .join("");
}

function _rewireYtResultBtns(container) {
  container.querySelectorAll(".yt-result-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const url = btn.dataset.ytUrl;
      if (!url) return;
      // Đã có sẵn tên bài từ kết quả tìm kiếm → chọn luôn, khỏi gọi oEmbed
      selectYouTubeSong(url, btn.dataset.ytTitle || "");
      _scheduleAutoSave("config");
    });
  });
}

let _ytSuggestionsCache = null;

async function _showYouTubeSuggestions() {
  const results = document.getElementById("youtube-search-results");
  if (!results) return;

  if (_ytSuggestionsCache) {
    results.innerHTML = _ytSuggestionsCache;
    _rewireYtResultBtns(results);
    return;
  }

  results.innerHTML =
    '<p class="text-xs text-gray-500 py-3 text-center">Đang tải gợi ý...</p>';

  try {
    const res = await fetch(
      `${CONFIG.supabase.edgeUrl}?resource=youtube-search&q=${encodeURIComponent("Một đời")}`,
      { headers: { Authorization: `Bearer ${CONFIG.supabase.anonKey}` } },
    );
    const items = await res.json();

    if (!Array.isArray(items) || items.length === 0) {
      results.innerHTML = "";
      return;
    }

    results.innerHTML =
      '<p class="text-xs font-semibold text-gray-500 px-1 pb-1 pt-0.5">Gợi ý</p>' +
      _renderYtItems(items);

    _ytSuggestionsCache = results.innerHTML;
    _rewireYtResultBtns(results);
  } catch {
    results.innerHTML = "";
  }
}

async function _doYouTubeSearch(q) {
  const results = document.getElementById("youtube-search-results");
  if (!results) return;

  results.innerHTML =
    '<p class="text-xs text-gray-500 py-3 text-center">Đang tìm...</p>';

  try {
    const res = await fetch(
      `${CONFIG.supabase.edgeUrl}?resource=youtube-search&q=${encodeURIComponent(q)}`,
      { headers: { Authorization: `Bearer ${CONFIG.supabase.anonKey}` } },
    );
    const items = await res.json();

    if (!Array.isArray(items) || items.length === 0) {
      results.innerHTML =
        '<p class="text-xs text-gray-500 py-3 text-center">Không tìm thấy bài nào. Thử gõ tên khác hoặc dán thẳng link YouTube.</p>';
      return;
    }

    results.innerHTML = _renderYtItems(items);
    _rewireYtResultBtns(results);
  } catch {
    results.innerHTML =
      '<p class="text-xs text-red-600 py-3 text-center">Lỗi tìm kiếm. Vui lòng thử lại.</p>';
  }
}

// ============= YOUTUBE MUSIC FUNCTIONS =============
function extractYouTubeVideoId(url) {
  // Support various YouTube URL formats
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

// Input là ô TÌM KIẾM độc lập — gõ/xoá ở đây KHÔNG đụng tới bài đã chọn (tag + URL).
// Chỉ dán 1 URL hợp lệ mới là hành động "chọn bài" (ghi đè tag).
function autoPreviewYouTubeMusic() {
  const input = document.getElementById("youtube-link-input");
  const error = document.getElementById("youtube-error");
  const results = document.getElementById("youtube-search-results");
  const val = input.value.trim();

  if (!val) {
    error?.classList.add("hidden");
    input.classList.remove("border-red-400");
    _showYouTubeSuggestions();
    return;
  }

  const isUrl = val.includes("youtube.com") || val.includes("youtu.be");

  if (isUrl) {
    if (results) results.innerHTML = "";
    const videoId = extractYouTubeVideoId(val);
    if (!videoId) {
      error?.classList.remove("hidden");
      input.classList.add("border-red-400");
      return;
    }
    error?.classList.add("hidden");
    input.classList.remove("border-red-400");
    // Dán URL hợp lệ = chọn bài → ghi đè tag + URL, lấy tên qua oEmbed
    selectYouTubeSong(val, "");
    _scheduleAutoSave("config");
  } else {
    // Gõ text = tìm kiếm; bài đã chọn (tag/URL/preview) giữ nguyên
    error?.classList.add("hidden");
    input.classList.remove("border-red-400");
    _doYouTubeSearch(val);
  }
}

// Chọn 1 bài (ghi đè bài cũ): lưu URL vào thẻ ẩn + hiện thẻ bài đang chọn (trình phát + tên).
// Ô input là ô TÌM KIẾM thuần nên trống lại — tên bài chỉ hiện ở thẻ, không lặp hai nơi.
// title rỗng (dán URL / load từ DB) → tự lấy qua YouTube oEmbed.
async function selectYouTubeSong(url, title) {
  const videoId = extractYouTubeVideoId(url);
  if (!videoId) return;

  _setMusicUrl(url);
  showYouTubePreview(videoId, url);
  const results = document.getElementById("youtube-search-results");
  if (results) results.innerHTML = "";
  document.getElementById("youtube-error")?.classList.add("hidden");

  const input = document.getElementById("youtube-link-input");
  if (input) {
    input.value = "";
    input.closest("x-input, x-textarea")?.syncClearBtn?.();
  }
  _showMusicStart(cxYtStart(url));
  _showMusicTag(title || "Đang lấy tên bài…");
  if (!title) _showMusicTag((await _fetchYouTubeTitle(url)) || url);
}

// Lấy tên bài từ URL YouTube (endpoint oEmbed công khai, có CORS)
async function _fetchYouTubeTitle(url) {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
    );
    if (!res.ok) return "";
    const data = await res.json();
    return data.title || "";
  } catch {
    return "";
  }
}

// Ghi URL thật vào thẻ ẩn (nguồn dữ liệu để lưu music_url).
// Đồng bộ luôn _currentMusicUrl: _initConfigPanel dựng lại bài theo biến đó mỗi lần
// mở tab, bỏ quên là gỡ bài xong quay lại tab thấy bài cũ như chưa hề lưu.
function _setMusicUrl(url) {
  const el = document.getElementById("music-url-input");
  if (el) el.value = url || "";
  _currentMusicUrl = url || "";
}

// Hiện/ẩn thẻ bài đang chọn (rỗng = ẩn)
function _showMusicTag(name) {
  const tag = document.getElementById("music-selected-tag");
  const nameEl = document.getElementById("music-selected-name");
  if (!tag) return;
  if (nameEl) nameEl.textContent = name || "";
  tag.classList.toggle("hidden", !name);
}

// ── Giây bắt đầu phát (ô #music-start-input) ── lưu thành `t` trong music_url.
function _fmtMusicStart(sec) {
  if (!sec) return "";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = String(sec % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

// "90" · "1:30" · "1:02:03" → giây; sai dạng trả null.
function _parseMusicStart(val) {
  val = String(val || "").trim();
  if (!val) return 0;
  if (!/^\d+(:\d{1,2}){0,2}$/.test(val)) return null;
  return val.split(":").reduce((acc, n) => acc * 60 + Number(n), 0);
}

function _showMusicStart(sec) {
  const el = document.getElementById("music-start-input");
  if (el) el.value = _fmtMusicStart(sec);
  const range = document.getElementById("music-start-range");
  if (range) {
    range.value = String(sec || 0);
    window.CXProgress?.paint(range);
  }
  document.getElementById("music-start-error")?.classList.add("hidden");
}

// Thanh kéo cần độ dài bài, chỉ trình phát thử mới biết: "loading" = chờ player
// (thanh mờ) · "slider" = đã có độ dài · "manual" = video chặn nhúng → ô nhập tay.
function _setMusicStartMode(mode, dur) {
  const range = document.getElementById("music-start-range");
  const wrap = range && window.CXProgress?.attach(range, {
    format: (v) => _fmtMusicStart(v) || "0:00",
  });
  const manual = mode === "manual";
  document.getElementById("music-start-slider")?.classList.toggle("hidden", manual);
  document.getElementById("music-start-actions")?.classList.toggle("hidden", manual);
  document.getElementById("music-start-input")?.classList.toggle("hidden", !manual);
  if (!range) return;
  if (mode === "slider") {
    range.max = String(Math.max(0, dur - 1));
    range.value = String(Math.min(cxYtStart(_currentMusicUrl), dur - 1));
  }
  range.disabled = mode !== "slider";
  wrap?.classList.toggle("is-off", mode !== "slider");
  window.CXProgress?.paint(range);
}

function _musicStartError(msg) {
  const err = document.getElementById("music-start-error");
  if (!err) return;
  err.textContent = msg || "";
  err.classList.toggle("hidden", !msg);
}

// Ghi giây bắt đầu vào URL đang chọn + tua trình phát thử tới đó.
function _applyMusicStart(sec) {
  if (!_currentMusicUrl) return;
  const dur = _ytPreviewPlayer?.getDuration?.() || 0;
  if (dur && sec >= dur) {
    _musicStartError(`Bài chỉ dài ${_fmtMusicStart(Math.floor(dur))}.`);
    return;
  }
  _musicStartError("");
  _showMusicStart(sec);
  _seekYtPreview(sec);
  const next = cxYtWithStart(_currentMusicUrl, sec);
  if (next === _currentMusicUrl) return;
  _setMusicUrl(next);
  _scheduleAutoSave("config");
}

function _seekYtPreview(sec) {
  const p = _ytPreviewPlayer;
  if (!p?.getPlayerState) return;
  try {
    const st = p.getPlayerState();
    // Chưa phát lần nào thì seekTo sẽ tự phát → chỉ nạp sẵn ở giây đó.
    if (st === YT.PlayerState.PLAYING || st === YT.PlayerState.PAUSED) {
      p.seekTo(sec, true);
    } else {
      p.cueVideoById({ videoId: extractYouTubeVideoId(_currentMusicUrl), startSeconds: sec });
    }
  } catch {}
}

// "Nghe thử": phát chính video bên cạnh từ giây bắt đầu đang đặt — đúng đoạn
// khách mời sẽ nghe đầu tiên.
function playMusicFromStart() {
  const p = _ytPreviewPlayer;
  if (!p?.seekTo || !p?.playVideo) {
    _musicStartError("Trình phát chưa sẵn sàng, thử lại sau giây lát.");
    return;
  }
  const range = document.getElementById("music-start-range");
  const sec = range && !range.disabled ? Number(range.value) : cxYtStart(_currentMusicUrl);
  _musicStartError("");
  try {
    p.seekTo(sec, true);
    p.playVideo();
  } catch {}
}

function setMusicStartFromPreview() {
  const t = _ytPreviewPlayer?.getCurrentTime?.();
  if (t == null) {
    _musicStartError("Trình phát chưa sẵn sàng, bấm phát bài trước đã.");
    return;
  }
  _applyMusicStart(Math.floor(t));
}

// Gỡ bài hát đã chọn (nút "Gỡ bài" trên thẻ bài đang chọn)
function clearMusicSelection() {
  _setMusicUrl("");
  _showMusicStart(0);
  _showMusicTag("");
  const input = document.getElementById("youtube-link-input");
  if (input) {
    input.value = "";
    input.closest("x-input, x-textarea")?.syncClearBtn?.();
  }
  document.getElementById("youtube-preview")?.classList.add("hidden");
  document.getElementById("youtube-error")?.classList.add("hidden");
  _scheduleAutoSave("config");
  _showYouTubeSuggestions();
}

let _ytPreviewPlayer = null;
let _ytApiInjected = false;
const _ytApiQueue = [];

window.onYouTubeIframeAPIReady = function () {
  _ytApiQueue.forEach((cb) => cb());
  _ytApiQueue.length = 0;
};

function _ensureYTApi(cb) {
  if (window.YT?.Player) return cb();
  _ytApiQueue.push(cb);
  if (!_ytApiInjected) {
    _ytApiInjected = true;
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(s);
  }
}

function showYouTubePreview(videoId, url) {
  const preview = document.getElementById("youtube-preview");

  if (_ytPreviewPlayer) {
    try {
      _ytPreviewPlayer.destroy();
    } catch {}
    _ytPreviewPlayer = null;
  }

  // Tạo lại player container nếu đã bị remove() lần trước
  let playerWrap = document.getElementById("youtube-player-container");
  if (!playerWrap) {
    playerWrap = document.createElement("div");
    playerWrap.id = "youtube-player-container";
    playerWrap.className = "aspect-video bg-black rounded-xl overflow-hidden";
    preview.prepend(playerWrap);
  }
  playerWrap.innerHTML =
    '<div id="_yt_target" style="width:100%;height:100%"></div>';

  const thumb = document.getElementById("youtube-fallback-thumb");
  if (thumb) thumb.style.display = "none";
  preview.classList.remove("hidden");

  _setMusicStartMode("loading");
  _ensureYTApi(() => {
    _ytPreviewPlayer = new YT.Player("_yt_target", {
      videoId,
      playerVars: {
        autoplay: 0,
        modestbranding: 1,
        rel: 0,
        start: cxYtStart(url),
      },
      events: {
        onReady: (e) => {
          const dur = Math.floor(e.target.getDuration?.() || 0);
          _setMusicStartMode(dur > 1 ? "slider" : "manual", dur);
        },
        onError: (e) => {
          _setMusicStartMode("manual");
          if (e.data === 101 || e.data === 150) {
            document.getElementById("youtube-player-container")?.remove();
            const thumb = document.getElementById("youtube-fallback-thumb");
            if (thumb) {
              thumb.src = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
              thumb.style.display = "";
              thumb.onclick = () =>
                window.open(`https://youtu.be/${videoId}`, "_blank");
            }
          }
        },
      },
    });
  });
}

function renderExistingYouTubeMusic(musicUrl) {
  if (
    !musicUrl ||
    (!musicUrl.includes("youtube.com") && !musicUrl.includes("youtu.be"))
  ) {
    return; // Not a YouTube URL
  }

  // Load từ DB: chỉ có URL → selectYouTubeSong tự lấy tên bài (oEmbed), hiện tag + preview.
  // Không gọi _scheduleAutoSave để tránh đánh dấu "dirty" khi vừa nạp.
  selectYouTubeSong(musicUrl, "");
}

// Setup auto-preview on input change
_onDomReady(function () {
  const input = document.getElementById("youtube-link-input");
  if (input) {
    // Debounce to avoid too many previews while typing
    let debounceTimer;
    input.addEventListener("input", function () {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        autoPreviewYouTubeMusic();
      }, 500); // Wait 500ms after user stops typing
    });

    // Also preview on paste
    input.addEventListener("paste", function () {
      setTimeout(() => {
        autoPreviewYouTubeMusic();
      }, 100);
    });
  }

  // Kéo: tua trình phát thử theo (nếu nó đang phát/dừng) để nghe ngay đoạn đó;
  // thả tay mới ghi vào URL.
  const range = document.getElementById("music-start-range");
  if (range) {
    range.addEventListener("input", () => {
      const p = _ytPreviewPlayer;
      try {
        const st = p?.getPlayerState?.();
        if (st === YT.PlayerState.PLAYING || st === YT.PlayerState.PAUSED)
          p.seekTo(Number(range.value), false);
      } catch {}
    });
    range.addEventListener("change", () => _applyMusicStart(Number(range.value)));
  }

  const startInput = document.getElementById("music-start-input");
  if (startInput) {
    const commit = () => {
      const sec = _parseMusicStart(startInput.value);
      if (sec === null) {
        _musicStartError("Nhập dạng phút:giây, ví dụ 1:30.");
        return;
      }
      _applyMusicStart(sec);
    };
    startInput.addEventListener("change", commit);
    startInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        startInput.blur();
      }
    });
  }
});
