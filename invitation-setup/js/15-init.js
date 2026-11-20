// Khởi tạo trang: nạp thiệp, khôi phục nháp, dựng form.
//
// Tách từ index.js (dòng 4240–4634 bản gốc). Thứ tự nạp khai báo ở loader.js.

// ============= INITIALIZATION =============

function setupLunarDateListeners() {
  // Helper function to update lunar display
  const updateLunarDisplay = (
    dateValue,
    displayEl,
    valueEl,
    emptyText = "Chọn ngày để tự động tính ngày âm lịch",
  ) => {
    if (dateValue) {
      const lunarDate = formatLunarDate(dateValue);
      const fullText = `Tức ngày ${lunarDate}`;
      displayEl.textContent = fullText;
      valueEl.value = fullText;
      displayEl.classList.remove("italic", "text-gray-500");
      displayEl.classList.add("text-gray-700");
    } else {
      displayEl.textContent = emptyText;
      valueEl.value = "";
      displayEl.classList.add("italic", "text-gray-500");
      displayEl.classList.remove("text-gray-700");
    }
  };

  // Helper function to subtract one day from a date string
  const subtractOneDay = (dateString) => {
    const date = new Date(dateString);
    date.setDate(date.getDate() - 1);
    return date.toISOString().split("T")[0];
  };

  // Lễ thành hôn (chung)
  const ceremonyDate = document.querySelector('input[name="ceremony_date"]');
  const ceremonyTime = document.querySelector('input[name="ceremony_time"]');
  const ceremonyLunarDisplay = document.getElementById(
    "ceremony-lunar-display",
  );
  const ceremonyLunarValue = document.getElementById("ceremony-lunar-value");

  if (ceremonyDate && ceremonyLunarDisplay && ceremonyLunarValue) {
    ceremonyDate.addEventListener("change", (e) => {
      updateLunarDisplay(
        e.target.value,
        ceremonyLunarDisplay,
        ceremonyLunarValue,
      );

      // Auto-fill party dates if empty
      const groomPartyDate = document.querySelector(
        'input[name="groom_party_date"]',
      );
      const bridePartyDate = document.querySelector(
        'input[name="bride_party_date"]',
      );

      if (e.target.value) {
        const oneDayBefore = subtractOneDay(e.target.value);

        // Fill groom party date if empty
        if (groomPartyDate && !groomPartyDate.value) {
          if (
            window.flatpickrInstances &&
            window.flatpickrInstances["groom_party_date"]
          ) {
            window.flatpickrInstances["groom_party_date"].setDate(
              oneDayBefore,
              true,
            );
          } else {
            groomPartyDate.value = oneDayBefore;
          }
          // Trigger change event to update lunar date
          const event = new Event("change", { bubbles: true });
          groomPartyDate.dispatchEvent(event);
        }

        // Fill bride party date if empty
        if (bridePartyDate && !bridePartyDate.value) {
          if (
            window.flatpickrInstances &&
            window.flatpickrInstances["bride_party_date"]
          ) {
            window.flatpickrInstances["bride_party_date"].setDate(
              oneDayBefore,
              true,
            );
          } else {
            bridePartyDate.value = oneDayBefore;
          }
          // Trigger change event to update lunar date
          const event = new Event("change", { bubbles: true });
          bridePartyDate.dispatchEvent(event);
        }
      }
    });
    ceremonyDate.addEventListener("blur", (e) => {
      updateLunarDisplay(
        e.target.value,
        ceremonyLunarDisplay,
        ceremonyLunarValue,
      );
    });
  }

  // Auto-fill party time when ceremony time is entered
  if (ceremonyTime) {
    ceremonyTime.addEventListener("change", (e) => {
      const groomPartyTime = document.querySelector(
        'input[name="groom_party_time"]',
      );
      const bridePartyTime = document.querySelector(
        'input[name="bride_party_time"]',
      );

      // Fill party times with 17:00 if empty
      if (groomPartyTime && !groomPartyTime.value) {
        groomPartyTime.value = "17:00";
      }
      if (bridePartyTime && !bridePartyTime.value) {
        bridePartyTime.value = "17:00";
      }
    });
    ceremonyTime.addEventListener("blur", (e) => {
      const groomPartyTime = document.querySelector(
        'input[name="groom_party_time"]',
      );
      const bridePartyTime = document.querySelector(
        'input[name="bride_party_time"]',
      );

      // Fill party times with 17:00 if empty
      if (groomPartyTime && !groomPartyTime.value) {
        groomPartyTime.value = "17:00";
      }
      if (bridePartyTime && !bridePartyTime.value) {
        bridePartyTime.value = "17:00";
      }
    });
  }

  // Lễ vu quy — bỏ trống ngày thì thiệp lấy ngày lễ thành hôn, ngày âm cũng vậy.
  const vuQuyDate = document.querySelector('input[name="vu_quy_date"]');
  const vuQuyLunarDisplay = document.getElementById("vu-quy-lunar-display");
  const vuQuyLunarValue = document.getElementById("vu-quy-lunar-value");

  if (vuQuyDate && vuQuyLunarDisplay && vuQuyLunarValue) {
    const syncVuQuyLunar = (e) =>
      updateLunarDisplay(
        e.target.value,
        vuQuyLunarDisplay,
        vuQuyLunarValue,
        "Bỏ trống thì lấy theo ngày lễ thành hôn",
      );
    vuQuyDate.addEventListener("change", syncVuQuyLunar);
    vuQuyDate.addEventListener("blur", syncVuQuyLunar);
  }

  // Tiệc cưới nhà trai
  const groomPartyDate = document.querySelector(
    'input[name="groom_party_date"]',
  );
  const groomPartyLunarDisplay = document.getElementById(
    "groom-party-lunar-display",
  );
  const groomPartyLunarValue = document.getElementById(
    "groom-party-lunar-value",
  );

  if (groomPartyDate && groomPartyLunarDisplay && groomPartyLunarValue) {
    groomPartyDate.addEventListener("change", (e) => {
      updateLunarDisplay(
        e.target.value,
        groomPartyLunarDisplay,
        groomPartyLunarValue,
      );
    });
    groomPartyDate.addEventListener("blur", (e) => {
      updateLunarDisplay(
        e.target.value,
        groomPartyLunarDisplay,
        groomPartyLunarValue,
      );
    });
  }

  // Tiệc cưới nhà gái
  const bridePartyDate = document.querySelector(
    'input[name="bride_party_date"]',
  );
  const bridePartyLunarDisplay = document.getElementById(
    "bride-party-lunar-display",
  );
  const bridePartyLunarValue = document.getElementById(
    "bride-party-lunar-value",
  );

  if (bridePartyDate && bridePartyLunarDisplay && bridePartyLunarValue) {
    bridePartyDate.addEventListener("change", (e) => {
      updateLunarDisplay(
        e.target.value,
        bridePartyLunarDisplay,
        bridePartyLunarValue,
      );
    });
    bridePartyDate.addEventListener("blur", (e) => {
      updateLunarDisplay(
        e.target.value,
        bridePartyLunarDisplay,
        bridePartyLunarValue,
      );
    });
  }

  // Auto-fill party location from address
  const groomAddress = document.querySelector('textarea[name="groom_address"]');
  const groomPartyLocation = document.querySelector(
    'textarea[name="groom_party_location"]',
  );

  if (groomAddress && groomPartyLocation) {
    groomAddress.addEventListener("change", (e) => {
      if (e.target.value && !groomPartyLocation.value) {
        groomPartyLocation.value = e.target.value;
      }
    });
    groomAddress.addEventListener("blur", (e) => {
      if (e.target.value && !groomPartyLocation.value) {
        groomPartyLocation.value = e.target.value;
      }
    });
  }

  const brideAddress = document.querySelector('textarea[name="bride_address"]');
  const bridePartyLocation = document.querySelector(
    'textarea[name="bride_party_location"]',
  );

  if (brideAddress && bridePartyLocation) {
    brideAddress.addEventListener("change", (e) => {
      if (e.target.value && !bridePartyLocation.value) {
        bridePartyLocation.value = e.target.value;
      }
    });
    brideAddress.addEventListener("blur", (e) => {
      if (e.target.value && !bridePartyLocation.value) {
        bridePartyLocation.value = e.target.value;
      }
    });
  }
}

function initializePage() {
  const idLabel = document.getElementById("wedding-id-label");
  const groomLink = document.getElementById("link-groom");
  const brideLink = document.getElementById("link-bride");

  if (idLabel) idLabel.textContent = `ID: ${WEDDING_ID}`;

  // Links will be updated after loading data with slug
  if (groomLink) groomLink.value = "Đang tải...";
  if (brideLink) brideLink.value = "Đang tải...";

  // Setup bank searchable select
  setupBankSearchableSelect(
    "groom-bank-input",
    "groom-bank-dropdown",
    "groom-bank-value",
  );
  setupBankSearchableSelect(
    "bride-bank-input",
    "bride-bank-dropdown",
    "bride-bank-value",
  );

  // Initialize single image uploads
  renderSingleImageUpload("cover_image_url");
  renderSingleImageUpload("groom_image_url");
  renderSingleImageUpload("bride_image_url");
  renderSingleImageUpload("groom_qr_url");
  renderSingleImageUpload("bride_qr_url");

  // Initialize gallery grid
  renderGalleryGrid();

  // Setup lunar date auto-fill
  setupLunarDateListeners();

  // Setup form submit handler
  const form = document.getElementById("wedding-form");
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      saveAll();
    });
  }

  // Auto-save to localStorage on any form change
  _initAutoSave();

  // Sync party "Trùng địa điểm" khi user gõ tay vào ceremony/vu_quy location
  ["ceremony_location", "vu_quy_location"].forEach((name) => {
    document
      .querySelector(`textarea[name="${name}"]`)
      ?.addEventListener("input", _syncPartyIfSame);
  });

  // Ô "Vị trí trên bản đồ" → ghim bản đồ theo toạ độ/chữ khách gõ (ngừng gõ mới ghim, khỏi
  // tải lại khung bản đồ mỗi phím); xoá rỗng (kể cả nút "x") → gỡ bản đồ ngay.
  ["ceremony", "vu_quy", "groom_party", "bride_party"].forEach((mapSide) => {
    const inp = document.getElementById(`${mapSide}_map_query`);
    let pinTimer = null;
    inp?.addEventListener("input", () => {
      clearTimeout(pinTimer);
      if (inp.readOnly || typeof cxMapFromQuery !== "function") return;
      const run = () => cxMapFromQuery(mapSide, inp.value);
      if (!inp.value.trim()) run();
      else pinTimer = setTimeout(run, 700);
    });
  });


  // Load data after Flatpickr is ready
  if (WEDDING_ID) {
    // Wait for Flatpickr to initialize
    const checkFlatpickr = setInterval(() => {
      if (window.flatpickrInstances) {
        clearInterval(checkFlatpickr);
        loadData();
      }
    }, 50);
  } else {
    showToast("Không tìm thấy ID thiệp cưới!", "error");
  }

  if (typeof lucide !== "undefined") lucide.createIcons();
}

// ============= EXPOSE TO GLOBAL SCOPE =============

window.handleTimeInput = handleTimeInput;
window.randomQuote = randomQuote;
window.handleImageUpload = handleImageUpload;
window.handleGalleryUpload = handleGalleryUpload;
window.removeImage = removeImage;
window.removeGalleryImage = removeGalleryImage;
window.removeExistingGalleryImage = removeExistingGalleryImage;
window.saveAll = saveAll;
window.copyText = copyText;
