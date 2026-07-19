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
      <img src="${_escHtml(item.thumbnail)}" class="w-20 h-12 rounded object-cover shrink-0 bg-gray-100" loading="lazy" />
      <div class="min-w-0 flex-1">
        <p class="text-xs font-medium text-gray-800 line-clamp-2 leading-snug">${_escHtml(item.title)}</p>
        <p class="text-[10px] text-gray-400 mt-1">${_escHtml(item.channel)}${item.duration ? " · " + _escHtml(item.duration) : ""}</p>
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
    '<p class="text-xs text-gray-400 py-3 text-center">Đang tải gợi ý...</p>';

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
      '<p class="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-1 pb-1 pt-0.5">Gợi ý</p>' +
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
    '<p class="text-xs text-gray-400 py-3 text-center">Đang tìm...</p>';

  try {
    const res = await fetch(
      `${CONFIG.supabase.edgeUrl}?resource=youtube-search&q=${encodeURIComponent(q)}`,
      { headers: { Authorization: `Bearer ${CONFIG.supabase.anonKey}` } },
    );
    const items = await res.json();

    if (!Array.isArray(items) || items.length === 0) {
      results.innerHTML =
        '<p class="text-xs text-gray-400 py-3 text-center">Không tìm thấy kết quả.</p>';
      return;
    }

    results.innerHTML = _renderYtItems(items);
    _rewireYtResultBtns(results);
  } catch {
    results.innerHTML =
      '<p class="text-xs text-red-400 py-3 text-center">Lỗi tìm kiếm. Vui lòng thử lại.</p>';
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

// Chọn 1 bài (ghi đè bài cũ): lưu URL vào thẻ ẩn + hiện tag + preview. Tag/URL là "bài đang chọn".
// Ô input chỉ hiển thị tên cho tiện nhìn — sửa/xóa input sau đó KHÔNG ảnh hưởng tag.
// title rỗng (dán URL / load từ DB) → tự lấy qua YouTube oEmbed.
async function selectYouTubeSong(url, title) {
  const videoId = extractYouTubeVideoId(url);
  if (!videoId) return;

  _setMusicUrl(url);
  showYouTubePreview(videoId, url);
  const results = document.getElementById("youtube-search-results");
  if (results) results.innerHTML = "";
  document.getElementById("youtube-error")?.classList.add("hidden");

  if (!title) title = await _fetchYouTubeTitle(url);
  const name = title || url;

  const input = document.getElementById("youtube-link-input");
  if (input) {
    input.value = name;
    input.closest("x-input, x-textarea")?.syncClearBtn?.();
  }
  _showMusicTag(name);
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

// Ghi URL thật vào thẻ ẩn (nguồn dữ liệu để lưu music_url)
function _setMusicUrl(url) {
  const el = document.getElementById("music-url-input");
  if (el) el.value = url || "";
}

// Hiện/ẩn tag tên bài hát dưới input
function _showMusicTag(name) {
  const tag = document.getElementById("music-selected-tag");
  const nameEl = document.getElementById("music-selected-name");
  if (!tag) return;
  if (name) {
    if (nameEl) nameEl.textContent = name;
    tag.classList.remove("hidden");
    if (window.lucide) lucide.createIcons();
  } else {
    tag.classList.add("hidden");
  }
}

// Gỡ bài hát đã chọn (nút x trên tag)
function clearMusicSelection() {
  _setMusicUrl("");
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
    playerWrap.className = "aspect-video bg-black rounded-lg overflow-hidden";
    preview.querySelector(".bg-gray-50").prepend(playerWrap);
  }
  playerWrap.innerHTML =
    '<div id="_yt_target" style="width:100%;height:100%"></div>';

  const thumb = document.getElementById("youtube-fallback-thumb");
  if (thumb) thumb.style.display = "none";
  preview.classList.remove("hidden");

  _ensureYTApi(() => {
    _ytPreviewPlayer = new YT.Player("_yt_target", {
      videoId,
      playerVars: { autoplay: 0, modestbranding: 1, rel: 0 },
      events: {
        onError: (e) => {
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
});

async function handleGalleryUpload(event) {
  const files = Array.from(event.target.files);
  event.target.value = "";
  if (files.length === 0) return;

  const remainingSlots =
    MAX_GALLERY_IMAGES - pendingUploads.galleryImages.length;
  if (remainingSlots <= 0) {
    showToast(`❌ Đã đạt giới hạn ${MAX_GALLERY_IMAGES} ảnh`);
    return;
  }

  const filesToProcess = files.slice(0, remainingSlots);
  if (files.length > remainingSlots) {
    showToast(`⚠️ Chỉ chọn được ${remainingSlots} ảnh nữa`);
  }

  const errors = [];
  let added = 0;

  for (let i = 0; i < filesToProcess.length; i++) {
    const file = filesToProcess[i];
    if (!file.type.startsWith("image/")) {
      errors.push(`${file.name} không phải ảnh`);
      continue;
    }

    // Open focal point picker for this image
    const focal = await _openFocalPickerAsync(file, { x: 50, y: 50 });
    if (!focal) continue; // user cancelled this image

    showLoading(true, "Đang nén ảnh...");
    try {
      const processedFile = await resizeImage(file, 1, 1920, 1920);
      pendingUploads.galleryImages.push(processedFile);
      pendingFocalPoints.gallery_images.set(processedFile, focal);
      _idbAddGallery(processedFile);
      added++;
      const progress = Math.round((added / filesToProcess.length) * 100);
      const progressEl = document.getElementById("upload-progress");
      if (progressEl) progressEl.textContent = `${progress}%`;
    } catch (error) {
      console.error(`Error processing ${file.name}:`, error);
      errors.push(`${file.name}: ${error.message}`);
    } finally {
      showLoading(false);
    }
  }

  renderGalleryGrid();
  if (added > 0) showToast(`✅ Đã chọn ${added} ảnh (chưa lưu)`);
  if (errors.length > 0) showToast(`⚠️ ${errors.length} ảnh lỗi`);
}

