// Ánh xạ dữ liệu form ↔ DB: đọc form, đổ dữ liệu vào form, lưu thiệp.
//
// Tách từ index.js (dòng 3302–3888 bản gốc). Thứ tự nạp khai báo ở loader.js.

// ============= DATA FUNCTIONS =============

function _showContent() {
  document.getElementById("skeleton-loader")?.classList.add("hidden");
  document.getElementById("actual-content")?.classList.remove("hidden");
  // Content thật đã hiện → show thẻ AI (đang ẩn lúc skeleton) và đặt lại vị trí
  // cho khớp form (lúc này #wedding-form mới có kích thước thật).
  const fab = document.querySelector(".ai-fab");
  if (fab) {
    fab.classList.remove("hidden-boot");
    if (typeof _positionAiFab === "function") _positionAiFab();
  }
  _updateHeaderThemeBadge();
  const params = new URLSearchParams(window.location.search);
  const savedTab = params.get("tab");
  // Không có ?tab (hoặc ?tab=edit) vẫn phải đánh dấu "Chỉnh sửa" đang mở — panel
  // của nó hiện sẵn từ HTML nên không cần switchTab, chỉ thiếu phần tô nút và
  // việc trả lại lề phải cho dải xem trực tiếp (lúc skeleton đang tắt).
  if (savedTab && savedTab !== "edit") switchTab(savedTab);
  else {
    _syncRail("edit");
    _setActiveTab("edit");
  }
  // Gọi SAU khi dải đã bật lại: _cxLiveFrames() bỏ qua khi còn cờ .cx-rail-off.
  if (typeof cxLiveRefresh === "function") cxLiveRefresh();
  // Reset dirty sau khi fill form xong — tránh false positive từ fillForm()
  setTimeout(() => _setDirty(false), 0);

  // Nếu được redirect về sau khi đăng nhập để xuất bản → auto trigger
  if (params.get("pendingPublish") === "1") {
    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete("pendingPublish");
    history.replaceState(null, "", cleanUrl.toString());
    setTimeout(() => publishWedding(), 300);
  }
}

// --nav-h = chiều cao thật của thanh dưới. Panel giao diện và phần đệm đáy của
// form dựa vào biến này để không bị navbar che mất phần cuối nội dung.
function _syncNavHeight() {
  const bar = document.getElementById("bottom-nav-bar");
  if (!bar) return;
  document.documentElement.style.setProperty("--nav-h", `${bar.offsetHeight}px`);
}

function _initNavHeightWatcher() {
  const bar = document.getElementById("bottom-nav-bar");
  if (!bar) return;
  _syncNavHeight();
  // Bắt cả lúc chữ trong navbar xuống dòng khi đổi kích thước màn
  if (window.ResizeObserver) {
    new ResizeObserver(_syncNavHeight).observe(bar);
  } else {
    window.addEventListener("resize", _syncNavHeight);
  }
}

async function loadData() {
  // Chốt IS_LOGIN trước khi fillForm() — fillForm gọi _syncAdvancedSection(), mà
  // bộ nút Lưu nháp / Xuất bản phụ thuộc cờ này.
  _watchLoginState();

  // Kiểm tra localStorage trước — nếu _localOnly thì KHÔNG gọi DB
  const localData = getLocalDraft();
  if (localData?._localOnly) {
    _isLocalDraft = true;
    if (!localData.theme)
      localData.theme = sessionStorage.getItem("draft_theme") || "basic-gold";
    fillForm(localData);
    _showContent();
    await _idbRestoreAll();
    return;
  }

  // Có thể đã có trong DB → thử fetch
  try {
    const data = await weddingBL.getWeddingById(WEDDING_ID);
    _isLocalDraft = false;
    fillForm(data);
    _showContent();
    await _idbRestoreAll();
    loadGuestList("groom").catch(console.error);
    loadGuestList("bride").catch(console.error);
  } catch (_dbError) {
    // Không có trong DB và không có localStorage → draft hoàn toàn mới
    _isLocalDraft = true;
    WEDDING_THEME = sessionStorage.getItem("draft_theme") || "basic-gold";
    fillForm({ theme: WEDDING_THEME, is_published: false });
    _showContent();
    await _idbRestoreAll();
  }
}

function fillForm(data) {
  const form = document.getElementById("wedding-form");
  if (!form) return;

  console.log("Filling form with data:", data);
  console.log(
    "Available Flatpickr instances:",
    window.flatpickrInstances ? Object.keys(window.flatpickrInstances) : "none",
  );

  // Tuỳ chỉnh giao diện (font/màu chữ)
  if (data.theme_setting != null) {
    let ts = data.theme_setting;
    if (typeof ts === "string") {
      try {
        ts = JSON.parse(ts);
      } catch (e) {
        ts = {};
      }
    }
    if (ts && typeof ts === "object") _themeSetting = ts;
  }

  // Save slug + theme for generating links
  if (data.slug) {
    WEDDING_SLUG = data.slug;
    if (data.theme) WEDDING_THEME = data.theme;
    // Điền slug vào input
    const slugInput = document.getElementById("slug-input");
    if (slugInput) slugInput.value = data.slug;
    // Update links
    const groomLink = document.getElementById("link-groom");
    const brideLink = document.getElementById("link-bride");
    if (groomLink) groomLink.value = `${DOMAIN}/${data.slug}?isGroom=true`;
    if (brideLink) brideLink.value = `${DOMAIN}/${data.slug}`;
  }

  // Câu mẫu chia sẻ (nằm ngoài <form> nên fill riêng)
  if (data.share_message_template !== undefined) {
    const tplEl = document.getElementById("share-message-template");
    if (tplEl) tplEl.value = data.share_message_template || "";
  }

  // Process image_focal_points FIRST so pendingFocalPoints is ready before any renderSingleImageUpload call
  if (data.image_focal_points) {
    let points = data.image_focal_points;
    if (typeof points === "string") {
      try {
        points = JSON.parse(points);
      } catch (e) {
        points = {};
      }
    }
    if (points && typeof points === "object") {
      FOCAL_POINT_FIELDS.forEach((field) => {
        if (points[field] && typeof points[field].x === "number") {
          pendingFocalPoints[field] = {
            x: points[field].x,
            y: points[field].y,
          };
        }
      });
      const galleryFp = points.gallery_images;
      const entries =
        galleryFp && typeof galleryFp === "object" && !Array.isArray(galleryFp)
          ? Object.entries(galleryFp).filter(
              ([, p]) =>
                p && typeof p.x === "number" && typeof p.y === "number",
            )
          : [];
      pendingFocalPoints.gallery_images = new Map(entries);
    }
  }

  Object.keys(data).forEach((key) => {
    let el = form.querySelector(`[name="${key}"]`);
    // Các control tuỳ biến (<x-input>/<x-date>/<x-time>) giữ attribute name và đứng trước
    // <input> con → phải nhắm vào control thật bên trong.
    if (el && el.tagName.startsWith("X-"))
      el = el.querySelector("input, textarea, select") || el;

    if (key === "gallery_images") {
      const textarea = form.querySelector('[name="gallery_images_raw"]');
      if (textarea) {
        console.log("Gallery images from DB:", data[key]);
        // Store filenames in textarea
        const images = Array.isArray(data[key]) ? data[key] : [];
        textarea.value = images.join("\n");
        console.log("Textarea value:", textarea.value);
        renderGalleryGrid();
      }
      return; // Skip the rest for gallery_images
    }

    // Skip if data is null
    if (data[key] == null) return;

    // Special handling for bank fields
    if (key === "groom_bank_name") {
      const input = document.getElementById("groom-bank-input");
      const hidden = document.getElementById("groom-bank-value");
      if (input) input.value = data[key];
      if (hidden) hidden.value = data[key];
      return;
    }

    if (key === "bride_bank_name") {
      const input = document.getElementById("bride-bank-input");
      const hidden = document.getElementById("bride-bank-value");
      if (input) input.value = data[key];
      if (hidden) hidden.value = data[key];
      return;
    }

    // Special handling for section visibility toggles
    if (key in SECTION_VIS_FIELDS) {
      // handled by _initVisToggles below
      return;
    }

    // Special handling for timeline (JSON string)
    if (key === "timeline") {
      let items = [];
      try {
        items =
          typeof data[key] === "string"
            ? JSON.parse(data[key])
            : Array.isArray(data[key])
              ? data[key]
              : [];
      } catch (e) {
        items = [];
      }
      _timelineItems = items;
      _syncTimelineHidden();
      renderTimelineList();
      return;
    }

    // Special handling for love_story (JSONB)
    if (key === "love_story") {
      const raw = data[key];
      if (raw === null || raw === undefined) return;
      let items = [];
      try {
        items =
          typeof raw === "string"
            ? JSON.parse(raw)
            : Array.isArray(raw)
              ? raw
              : [];
      } catch (e) {
        items = [];
      }
      _loveStoryItems = items;
      _loveStoryKeyExists = true;
      _syncLoveStoryHidden();
      renderLoveStoryList();
      return;
    }

    // image_focal_points already processed before this loop
    if (key === "image_focal_points") return;

    // theme_setting đã xử lý trước vòng lặp
    if (key === "theme_setting") return;

    // Special handling for YouTube music URL
    if (key === "music_url") {
      _currentMusicUrl = data[key] || "";
      if (data[key]) renderExistingYouTubeMusic(data[key]);
      return;
    }

    // Check if this is a date field with Flatpickr
    if (window.flatpickrInstances && window.flatpickrInstances[key]) {
      console.log(`Setting date for ${key} using Flatpickr:`, data[key]);
      // Set value using Flatpickr instance
      window.flatpickrInstances[key].setDate(data[key], true);

      // Manually trigger lunar date update for date fields
      if (
        key === "ceremony_date" ||
        key === "groom_party_date" ||
        key === "bride_party_date"
      ) {
        const event = new Event("change", { bubbles: true });
        el.dispatchEvent(event);
      }
    } else if (el) {
      // Store value in input for non-date fields
      el.value = data[key];
      // Gán .value bằng code không phát "input" → tự đồng bộ nút "x" xoá của
      // <x-input>/<x-textarea> để nó hiện đúng khi ô có nội dung sau khi nạp DB.
      el.closest("x-input, x-textarea")?.syncClearBtn?.();
    }

    // For image URL fields, render the UI
    if (
      key === "cover_image_url" ||
      key === "groom_image_url" ||
      key === "bride_image_url" ||
      key === "groom_qr_url" ||
      key === "bride_qr_url"
    ) {
      if (data[key]) {
        renderSingleImageUpload(key);
      }
    } else if (key.includes("_url") && data[key]) {
      showImagePreview(key, data[key]);
    }
  });

  _initVisToggles(data);
  if (typeof initMapDisplays === "function") initMapDisplays(data);
  initCeremonySection(data);

  IS_PUBLISHED = !!data.is_published;
  _syncAdvancedSection();

  if (typeof lucide !== "undefined") lucide.createIcons();

  // Sync clear-button state on all x-input components after programmatic fill
  document.querySelectorAll("x-input").forEach((el) => el.syncClearBtn?.());
}

// Ngày sự kiện KHÔNG bị chặn theo hôm nay — cho nhập/lưu cả ngày trong quá khứ.

async function saveAll(overrides = {}, label = "Đang lưu...") {
  const form = document.getElementById("wedding-form");
  if (!validateForm(form)) {
    showLoading(false);
    return false;
  }

  // Đọc lại phiên ngay trước khi ghi: quyết định "chỉ lưu localStorage" hay "tạo
  // record trong DB" ở dưới dựa vào cờ này, để lệch là lưu sai chỗ. Hỏi supabase
  // (await) chứ không đọc storage — token hết hạn thì storage vẫn còn nguyên.
  await _refreshLoginState();

  try {
    // Step 1: Upload pending images
    showLoading(true, "Đang tải ảnh lên server...");
    const { uploadedFilenames, errors } = await uploadAllPendingImages();
    showLoading(true, label);

    if (errors.length > 0) {
      console.error("Upload errors:", errors);
      showToast(`${errors.length} ảnh lỗi khi upload`, "warning");
    }

    // Step 2: Prepare form data
    const form = document.getElementById("wedding-form");
    const formData = new FormData(form);
    const payload = {
      id: WEDDING_ID,
      slug: WEDDING_SLUG,
      // theme không phải field của <form> nên phải gửi tay: thiếu nó thì đổi mẫu
      // xong lưu, DB vẫn giữ mẫu cũ → thiệp thật (và QR xem trên điện thoại)
      // hiện sai mẫu so với màn đang chỉnh.
      theme: WEDDING_THEME,
      theme_setting: _themeSetting,
    };

    // Step 2.5: Get YouTube music URL — URL thật lấy từ thẻ ẩn (#music-url-input);
    // input hiển thị chỉ chứa TÊN bài nên không dùng để lưu.
    const musicUrl = document
      .getElementById("music-url-input")
      ?.value?.trim();

    if (musicUrl) {
      // Validate YouTube URL
      const videoId = extractYouTubeVideoId(musicUrl);
      if (videoId) {
        payload.music_url = musicUrl;
      } else {
        console.warn("Invalid YouTube URL:", musicUrl);
      }
    } else {
      // If empty, explicitly set to null to clear music
      payload.music_url = null;
    }

    // Câu mẫu chia sẻ (ngoài <form> nên thu thập riêng)
    payload.share_message_template =
      document.getElementById("share-message-template")?.value?.trim() || null;

    // Add deleted images list
    const allDeletedImages = [
      ...deletedImages.singleImages,
      ...deletedImages.galleryImages,
    ];
    console.log("Deleted images to send:", allDeletedImages);
    if (allDeletedImages.length > 0) {
      payload.deleted_images = allDeletedImages;
      console.log("Added deleted_images to payload:", payload.deleted_images);
    }

    formData.forEach((value, key) => {
      if (key === "gallery_images_raw" || key === "slug") return;
      if (typeof value !== "string") return; // skip File objects
      if (value.trim()) {
        payload[key] = value.trim();
      } else if (key.includes("_url") || key.includes("_lunar")) {
        payload[key] = null;
      }
    });

    // Step 3: Add uploaded filenames to payload
    for (const [fieldName, filename] of Object.entries(uploadedFilenames)) {
      if (fieldName === "gallery_images") {
        // Get existing gallery filenames from form
        const textarea = document.querySelector(
          'textarea[name="gallery_images_raw"]',
        );
        const existingFilenames = textarea
          ? textarea.value.trim().split("\n").filter(Boolean)
          : [];

        // Merge existing filenames with newly uploaded filenames
        payload.gallery_images = [...existingFilenames, ...filename];
      } else {
        payload[fieldName] = filename;
      }
    }

    // Handle gallery images if no new uploads
    if (!uploadedFilenames.gallery_images) {
      const textarea = document.querySelector(
        'textarea[name="gallery_images_raw"]',
      );
      if (textarea) {
        payload.gallery_images = textarea.value
          .trim()
          .split("\n")
          .filter(Boolean);
      }
    }

    // Step 3.5: Build điểm lấy nét (focal points) cho payload
    // gallery_images lưu dạng map { filename: {x,y} } — tra theo tên file (key ổn định),
    // không phụ thuộc thứ tự/ index nên thêm/xoá/sắp xếp lại ảnh không làm lệch dữ liệu
    const galleryFocalMap = {};
    const newGalleryFilenames = uploadedFilenames.gallery_images || [];
    pendingUploads.galleryImages.forEach((file, i) => {
      const fn = newGalleryFilenames[i];
      if (fn) galleryFocalMap[fn] = getGalleryFocalPoint(file);
    });
    (payload.gallery_images || []).forEach((fn) => {
      if (!(fn in galleryFocalMap))
        galleryFocalMap[fn] = getGalleryFocalPoint(fn);
    });

    payload.image_focal_points = {
      cover_image_url: pendingFocalPoints.cover_image_url,
      groom_image_url: pendingFocalPoints.groom_image_url,
      bride_image_url: pendingFocalPoints.bride_image_url,
      groom_qr_url: pendingFocalPoints.groom_qr_url,
      bride_qr_url: pendingFocalPoints.bride_qr_url,
      gallery_images: galleryFocalMap,
    };

    // Apply overrides (e.g. is_published: true from publishWedding)
    Object.assign(payload, overrides);

    // Step 4: Luôn lưu vào localStorage trước
    saveLocalDraft(payload);

    // Step 4b: Lưu DB nếu record đã tồn tại, hoặc user đã đăng nhập
    if (!_isLocalDraft) {
      // Record đã có trong DB → PATCH bình thường
      await weddingBL.updateWedding(payload);
    } else if (IS_LOGIN) {
      // Local draft + đã đăng nhập → tạo record trong DB lần đầu
      const generatedSlug = payload.slug || `wedding-${WEDDING_ID.slice(0, 8)}`;
      // Đính JWT user (qua _authHeaders) để edge gán user_id = chủ thiệp ngay khi tạo.
      await fetch(CONFIG.supabase.edgeUrl, {
        method: "POST",
        headers: await window.weddingDAL._authHeaders(),
        body: JSON.stringify({
          manage_id: WEDDING_ID,
          theme: WEDDING_THEME,
          is_published: false,
          slug: generatedSlug,
        }),
      });
      WEDDING_SLUG = generatedSlug;
      payload.slug = generatedSlug;
      await weddingBL.updateWedding(payload);
      _isLocalDraft = false;
      clearLocalDraft();
    }
    // else: chỉ localStorage, chưa đăng nhập → không lưu DB


    // Step 5: Update hidden inputs with uploaded filenames
    for (const [fieldName, filename] of Object.entries(uploadedFilenames)) {
      if (fieldName !== "gallery_images") {
        const hiddenInput = document.querySelector(
          `input[name="${fieldName}"]`,
        );
        if (hiddenInput) {
          hiddenInput.value = filename;
        }
      }
    }

    // Update gallery textarea with all filenames (existing + new)
    if (uploadedFilenames.gallery_images) {
      const textarea = document.querySelector(
        'textarea[name="gallery_images_raw"]',
      );
      if (textarea) {
        const existingFilenames = textarea.value
          .trim()
          .split("\n")
          .filter(Boolean);
        const allFilenames = [
          ...existingFilenames,
          ...uploadedFilenames.gallery_images,
        ];
        textarea.value = allFilenames.join("\n");
      }
    }

    // Step 6: Clear pending uploads and deleted images
    pendingUploads.singleImages = {};
    pendingUploads.galleryImages = [];
    deletedImages.singleImages = [];
    deletedImages.galleryImages = [];
    _galleryIdbKeys.clear();
    _idbClearWedding();

    // Step 7: Re-render UI to reflect saved state
    renderSingleImageUpload("cover_image_url");
    renderSingleImageUpload("groom_image_url");
    renderSingleImageUpload("bride_image_url");
    renderSingleImageUpload("groom_qr_url");
    renderSingleImageUpload("bride_qr_url");
    renderGalleryGrid();

    // Đồng bộ câu mẫu chia sẻ sang iframe khách mời (nếu đã nạp) — tránh phải F5 mới có câu mới
    document
      .getElementById("guests-iframe")
      ?.contentWindow?.setShareTemplate?.(payload.share_message_template ?? null);

    if (_isLocalDraft && !IS_LOGIN) {
      showToast("Đã lưu nháp vào thiết bị này", "success");
    } else {
      showToast("Đã lưu thành công!", "success");
    }
    _setDirty(false);
    return true;
  } catch (e) {
    console.error("Save error:", e);

    // Thiệp giờ bắt buộc đăng nhập mới sửa được (chống người lạ có link UUID sửa
    // thiệp, tráo QR nhận tiền mừng). Nhắc đăng nhập thay vì báo lỗi thô; bản nháp
    // đã được lưu ở localStorage phía trên nên không mất dữ liệu.
    if (e.code === "AUTH_REQUIRED" || e.status === 401) {
      showToast("Vui lòng đăng nhập để lưu thiệp lên hệ thống", "warning");
      window.AuthUI?.openModal?.({ onAuth: () => location.reload() });
      return false;
    }
    if (e.code === "FORBIDDEN" || e.status === 403) {
      showToast("Bạn không có quyền chỉnh sửa thiệp này", "error");
      return false;
    }

    showToast("Lỗi: " + e.message, "error");
    return false;
  } finally {
    showLoading(false);
  }
}

function copyText(inputId) {
  const input = document.getElementById(inputId);
  if (!input) return;

  navigator.clipboard.writeText(input.value);
  showToast("Đã copy link!", "default", "clipboard");
}

async function applySlug() {
  const input = document.getElementById("slug-input");
  if (!input) return;

  // Luật đặt slug ở weddingBL.validateSlug (bỏ dấu, chỉ giữ a-z0-9 và "-").
  const newSlug = _toSlug(input.value);
  if (!newSlug) {
    showToast("Vui lòng nhập slug hợp lệ", "error");
    return;
  }

  input.value = newSlug;

  try {
    showLoading(true, "Đang cập nhật slug...");

    // Use BL layer to update slug
    await weddingBL.updateWedding({ id: WEDDING_ID, slug: newSlug });

    WEDDING_SLUG = newSlug;
    const groomLink = document.getElementById("link-groom");
    const brideLink = document.getElementById("link-bride");
    if (groomLink) groomLink.value = `${DOMAIN}/${newSlug}?isGroom=true`;
    if (brideLink) brideLink.value = `${DOMAIN}/${newSlug}`;
    showToast("Đã cập nhật slug!", "success");
  } catch (e) {
    showToast(e.message, "error");
  } finally {
    showLoading(false);
  }
}

