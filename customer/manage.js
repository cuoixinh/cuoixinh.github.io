// Configuration
const WEDDING_ID = new URLSearchParams(window.location.search).get("id");
const DOMAIN = window.location.origin;

// Wedding data cache
let WEDDING_SLUG = "";
let WEDDING_THEME = "template1";

// ============= ENCRYPTION/DECRYPTION FUNCTIONS =============

function encryptData(text) {
  if (!text) return "";
  try {
    const encrypted = CryptoJS.AES.encrypt(text, ENCRYPTION_KEY).toString();
    // Make URL-safe by encoding to Base64
    return encodeURIComponent(encrypted);
  } catch (error) {
    console.error("Encryption error:", error);
    throw new Error("Lỗi mã hóa dữ liệu");
  }
}

function decryptData(encryptedText) {
  if (!encryptedText) return "";
  try {
    const decoded = decodeURIComponent(encryptedText);
    const decrypted = CryptoJS.AES.decrypt(decoded, ENCRYPTION_KEY);
    return decrypted.toString(CryptoJS.enc.Utf8);
  } catch (error) {
    console.error("Decryption error:", error);
    return "";
  }
}

// ============= AUTO-GENERATE LINKS FUNCTIONS =============

async function generateLinks(side) {
  const sideText = side === "groom" ? "nhà trai" : "nhà gái";

  try {
    showLoading(true, `Đang kiểm tra cấu hình ${sideText}...`);

    // Use BL layer to generate personalized links
    const result = await weddingBL.generatePersonalizedLinks(
      WEDDING_ID,
      side,
      encryptData, // encryption function
    );

    showLoading(false);

    if (result.success) {
      const skipMsg =
        result.skipped > 0 ? `, bỏ qua ${result.skipped} đã có link` : "";
      showToast(
        `✅ Đã tạo link thành công cho ${result.count} khách mời ${sideText}${skipMsg}`,
      );
    } else {
      showToast(`⚠️ ${result.message}`);
    }
  } catch (error) {
    showLoading(false);
    console.error("Generate links error:", error);
    showToast(`❌ ${error.message}`);
  }
}

// ============= BANK SEARCHABLE SELECT =============

const BANK_LIST = [
  "Vietcombank - Ngân hàng TMCP Ngoại thương Việt Nam",
  "VietinBank - Ngân hàng TMCP Công Thương Việt Nam",
  "BIDV - Ngân hàng TMCP Đầu tư và Phát triển Việt Nam",
  "Agribank - Ngân hàng Nông nghiệp và Phát triển Nông thôn Việt Nam",
  "MB Bank - Ngân hàng TMCP Quân đội",
  "Techcombank - Ngân hàng TMCP Kỹ Thương Việt Nam",
  "ACB - Ngân hàng TMCP Á Châu",
  "VPBank - Ngân hàng TMCP Việt Nam Thịnh Vượng",
  "TPBank - Ngân hàng TMCP Tiên Phong",
  "Sacombank - Ngân hàng TMCP Sài Gòn Thương Tín",
  "HDBank - Ngân hàng TMCP Phát triển TP.HCM",
  "VIB - Ngân hàng TMCP Quốc tế Việt Nam",
  "SHB - Ngân hàng TMCP Sài Gòn - Hà Nội",
  "Eximbank - Ngân hàng TMCP Xuất Nhập khẩu Việt Nam",
  "MSB - Ngân hàng TMCP Hàng Hải Việt Nam",
  "OCB - Ngân hàng TMCP Phương Đông",
  "SeABank - Ngân hàng TMCP Đông Nam Á",
  "VietCapital Bank - Ngân hàng TMCP Bản Việt",
  "SCB - Ngân hàng TMCP Sài Gòn",
  "VietBank - Ngân hàng TMCP Việt Nam Thương Tín",
  "LienVietPostBank - Ngân hàng TMCP Bưu Điện Liên Việt",
  "PVcomBank - Ngân hàng TMCP Đại Chúng Việt Nam",
  "BacABank - Ngân hàng TMCP Bắc Á",
  "VietABank - Ngân hàng TMCP Việt Á",
  "NCB - Ngân hàng TMCP Quốc Dân",
  "SaigonBank - Ngân hàng TMCP Sài Gòn Công Thương",
  "ABBank - Ngân hàng TMCP An Bình",
  "Nam A Bank - Ngân hàng TMCP Nam Á",
  "PGBank - Ngân hàng TMCP Xăng dầu Petrolimex",
  "BaoViet Bank - Ngân hàng TMCP Bảo Việt",
  "GPBank - Ngân hàng TMCP Dầu khí Toàn Cầu",
  "OceanBank - Ngân hàng TMCP Đại Dương",
  "CBBank - Ngân hàng TMCP Xây dựng Việt Nam",
  "KienLongBank - Ngân hàng TMCP Kiên Long",
  "DongA Bank - Ngân hàng TMCP Đông Á",
  "UOB - Ngân hàng United Overseas Bank",
  "Standard Chartered - Ngân hàng Standard Chartered Việt Nam",
  "HSBC - Ngân hàng HSBC Việt Nam",
  "Shinhan Bank - Ngân hàng TNHH MTV Shinhan Việt Nam",
  "Woori Bank - Ngân hàng TNHH MTV Woori Việt Nam",
  "Hong Leong Bank - Ngân hàng TNHH MTV Hong Leong Việt Nam",
  "CIMB - Ngân hàng TNHH MTV CIMB Việt Nam",
  "Public Bank - Ngân hàng TNHH MTV Public Việt Nam",
];

function setupBankSearchableSelect(inputId, dropdownId, hiddenInputId) {
  const input = document.getElementById(inputId);
  const dropdown = document.getElementById(dropdownId);
  const hiddenInput = document.getElementById(hiddenInputId);

  if (!input || !dropdown || !hiddenInput) return;

  let selectedIndex = -1;

  // Render dropdown options
  function renderOptions(banks) {
    if (banks.length === 0) {
      dropdown.innerHTML =
        '<div class="px-4 py-3 text-sm text-gray-500">Không tìm thấy ngân hàng</div>';
      dropdown.classList.remove("hidden");
      return;
    }

    dropdown.innerHTML = banks
      .map(
        (bank, index) => `
      <div class="bank-option px-4 py-3 hover:bg-rose-50 cursor-pointer transition-colors text-sm border-b border-gray-100 last:border-b-0 ${index === selectedIndex ? "bg-rose-50" : ""}" data-value="${bank}">
        ${bank}
      </div>
    `,
      )
      .join("");

    dropdown.classList.remove("hidden");

    // Add click handlers
    dropdown.querySelectorAll(".bank-option").forEach((option) => {
      option.addEventListener("click", () => {
        const value = option.dataset.value;
        input.value = value;
        hiddenInput.value = value;
        dropdown.classList.add("hidden");
        selectedIndex = -1;
      });
    });
  }

  // Filter banks
  function filterBanks(query) {
    if (!query.trim()) {
      renderOptions(BANK_LIST);
      return;
    }

    const normalizedQuery = query.toLowerCase().trim();
    const filtered = BANK_LIST.filter((bank) =>
      bank.toLowerCase().includes(normalizedQuery),
    );

    renderOptions(filtered);
  }

  // Input event
  input.addEventListener("input", (e) => {
    selectedIndex = -1;
    hiddenInput.value = e.target.value; // Update hidden input as user types
    filterBanks(e.target.value);
  });

  // Focus event
  input.addEventListener("focus", () => {
    filterBanks(input.value);
  });

  // Keyboard navigation
  input.addEventListener("keydown", (e) => {
    const options = dropdown.querySelectorAll(".bank-option");

    if (e.key === "ArrowDown") {
      e.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, options.length - 1);
      updateSelection(options);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, -1);
      updateSelection(options);
    } else if (
      e.key === "Enter" &&
      selectedIndex >= 0 &&
      options[selectedIndex]
    ) {
      e.preventDefault();
      options[selectedIndex].click();
    } else if (e.key === "Escape") {
      dropdown.classList.add("hidden");
      selectedIndex = -1;
    }
  });

  function updateSelection(options) {
    options.forEach((opt, idx) => {
      if (idx === selectedIndex) {
        opt.classList.add("bg-rose-50");
        opt.scrollIntoView({ block: "nearest" });
      } else {
        opt.classList.remove("bg-rose-50");
      }
    });
  }

  // Click outside to close
  document.addEventListener("click", (e) => {
    if (!input.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.classList.add("hidden");
      selectedIndex = -1;
    }
  });
}

// ============= QUOTE RANDOM =============

const QUOTE_LIST = [
  "Cảm ơn em đã đến bên đời nhau, cùng nhau viết nên câu chuyện của riêng chúng ta.",
  "Tình yêu không phải là nhìn nhau, mà là cùng nhau nhìn về một hướng.",
  "Hạnh phúc là khi có một người để yêu, một nơi để về và một lý do để tin.",
  "Từ hôm nay, anh/em không còn là một, mà là hai người cùng chung một trái tim.",
  "Yêu nhau không chỉ là nói lời yêu, mà là ở bên nhau mỗi ngày.",
  "Tình yêu đích thực là khi hai người cùng nhau trưởng thành.",
  "Hôn nhân không phải là điểm kết thúc, mà là khởi đầu của một hành trình mới.",
  "Tình yêu là khi hai trái tim cùng đập chung một nhịp.",
  "Hạnh phúc nhất là được sống bên người mình yêu mỗi ngày.",
  "Yêu là cho đi không cần đòi hỏi, là chia sẻ không cần tính toán.",
];

function randomQuote() {
  const textarea = document.getElementById("story-quote-textarea");
  if (!textarea) return;

  const randomIndex = Math.floor(Math.random() * QUOTE_LIST.length);
  textarea.value = QUOTE_LIST[randomIndex];

  // Add a little animation
  textarea.classList.add("ring-4", "ring-purple-500/20");
  setTimeout(() => {
    textarea.classList.remove("ring-4", "ring-purple-500/20");
  }, 500);
}

// ============= TIME INPUT VALIDATION =============

function handleTimeInput(event) {
  const char = String.fromCharCode(event.which);
  const input = event.target;
  const value = input.value;

  // Chỉ cho phép số và dấu :
  if (!/[0-9:]/.test(char)) {
    event.preventDefault();
    return false;
  }

  // Tự động thêm dấu : sau khi nhập 2 số đầu
  if (value.length === 2 && char !== ":") {
    input.value = value + ":";
  }

  return true;
}

function validateTimeFormat(input) {
  const value = input.value.trim();

  if (!value) return; // Cho phép để trống

  // Kiểm tra format HH:MM
  const timeRegex = /^([0-1][0-9]|2[0-3]):([0-5][0-9])$/;

  if (!timeRegex.test(value)) {
    showToast(
      "❌ Giờ không hợp lệ! Vui lòng nhập theo định dạng HH:MM (00:00 - 23:59)",
    );
    input.value = "";
    input.focus();
    return false;
  }

  return true;
}

// ============= LUNAR CALENDAR FUNCTIONS =============
// Thuật toán chuyển đổi âm lịch của Hồ Ngọc Đức

function jdFromDate(dd, mm, yy) {
  const a = Math.floor((14 - mm) / 12);
  const y = yy + 4800 - a;
  const m = mm + 12 * a - 3;
  let jd =
    dd +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32045;
  if (jd < 2299161) {
    jd =
      dd + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - 32083;
  }
  return jd;
}

function getNewMoonDay(k, timeZone) {
  const T = k / 1236.85;
  const T2 = T * T;
  const T3 = T2 * T;
  const dr = Math.PI / 180;
  let Jd1 = 2415020.75933 + 29.53058868 * k + 0.0001178 * T2 - 0.000000155 * T3;
  Jd1 = Jd1 + 0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * dr);
  const M = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3;
  const Mpr = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3;
  const F = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3;
  let C1 =
    (0.1734 - 0.000393 * T) * Math.sin(M * dr) + 0.0021 * Math.sin(2 * dr * M);
  C1 = C1 - 0.4068 * Math.sin(Mpr * dr) + 0.0161 * Math.sin(dr * 2 * Mpr);
  C1 = C1 - 0.0004 * Math.sin(dr * 3 * Mpr);
  C1 = C1 + 0.0104 * Math.sin(dr * 2 * F) - 0.0051 * Math.sin(dr * (M + Mpr));
  C1 =
    C1 -
    0.0074 * Math.sin(dr * (M - Mpr)) +
    0.0004 * Math.sin(dr * (2 * F + M));
  C1 =
    C1 -
    0.0004 * Math.sin(dr * (2 * F - M)) -
    0.0006 * Math.sin(dr * (2 * F + Mpr));
  C1 =
    C1 +
    0.001 * Math.sin(dr * (2 * F - Mpr)) +
    0.0005 * Math.sin(dr * (2 * Mpr + M));
  let deltat;
  if (T < -11) {
    deltat =
      0.001 +
      0.000839 * T +
      0.0002261 * T2 -
      0.00000845 * T3 -
      0.000000081 * T * T3;
  } else {
    deltat = -0.000278 + 0.000265 * T + 0.000262 * T2;
  }
  const JdNew = Jd1 + C1 - deltat;
  return Math.floor(JdNew + 0.5 + timeZone / 24);
}

function getSunLongitude(jdn, timeZone) {
  const T = (jdn - 2451545.5 - timeZone / 24) / 36525;
  const T2 = T * T;
  const dr = Math.PI / 180;
  const M = 357.5291 + 35999.0503 * T - 0.0001559 * T2 - 0.00000048 * T * T2;
  const L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T2;
  let DL = (1.9146 - 0.004817 * T - 0.000014 * T2) * Math.sin(dr * M);
  DL =
    DL +
    (0.019993 - 0.000101 * T) * Math.sin(dr * 2 * M) +
    0.00029 * Math.sin(dr * 3 * M);
  let L = L0 + DL;
  L = L * dr;
  L = L - Math.PI * 2 * Math.floor(L / (Math.PI * 2));
  return Math.floor((L / Math.PI) * 6);
}

function getLunarMonth11(yy, timeZone) {
  const off = jdFromDate(31, 12, yy) - 2415021;
  const k = Math.floor(off / 29.530588853);
  let nm = getNewMoonDay(k, timeZone);
  const sunLong = getSunLongitude(nm, timeZone);
  if (sunLong >= 9) {
    nm = getNewMoonDay(k - 1, timeZone);
  }
  return nm;
}

function getLeapMonthOffset(a11, timeZone) {
  const k = Math.floor((a11 - 2415021.076998695) / 29.530588853 + 0.5);
  let last = 0;
  let i = 1;
  let arc = getSunLongitude(getNewMoonDay(k + i, timeZone), timeZone);
  do {
    last = arc;
    i++;
    arc = getSunLongitude(getNewMoonDay(k + i, timeZone), timeZone);
  } while (arc != last && i < 14);
  return i - 1;
}

function convertSolar2Lunar(dd, mm, yy, timeZone = 7) {
  const dayNumber = jdFromDate(dd, mm, yy);
  const k = Math.floor((dayNumber - 2415021.076998695) / 29.530588853);
  let monthStart = getNewMoonDay(k + 1, timeZone);
  if (monthStart > dayNumber) {
    monthStart = getNewMoonDay(k, timeZone);
  }
  let a11 = getLunarMonth11(yy, timeZone);
  let b11 = a11;
  let lunarYear;
  if (a11 >= monthStart) {
    lunarYear = yy;
    a11 = getLunarMonth11(yy - 1, timeZone);
  } else {
    lunarYear = yy + 1;
    b11 = getLunarMonth11(yy + 1, timeZone);
  }
  const lunarDay = dayNumber - monthStart + 1;
  const diff = Math.floor((monthStart - a11) / 29);
  let lunarLeap = 0;
  let lunarMonth = diff + 11;
  if (b11 - a11 > 365) {
    const leapMonthDiff = getLeapMonthOffset(a11, timeZone);
    if (diff >= leapMonthDiff) {
      lunarMonth = diff + 10;
      if (diff == leapMonthDiff) {
        lunarLeap = 1;
      }
    }
  }
  if (lunarMonth > 12) {
    lunarMonth = lunarMonth - 12;
  }
  if (lunarMonth >= 11 && diff < 4) {
    lunarYear -= 1;
  }
  return { day: lunarDay, month: lunarMonth, year: lunarYear, leap: lunarLeap };
}

function getCanChi(year) {
  const can = [
    "Canh",
    "Tân",
    "Nhâm",
    "Quý",
    "Giáp",
    "Ất",
    "Bính",
    "Đinh",
    "Mậu",
    "Kỷ",
  ];
  const chi = [
    "Thân",
    "Dậu",
    "Tuất",
    "Hợi",
    "Tý",
    "Sửu",
    "Dần",
    "Mão",
    "Thìn",
    "Tỵ",
    "Ngọ",
    "Mùi",
  ];
  return can[(year + 6) % 10] + " " + chi[(year + 8) % 12];
}

function formatLunarDate(solarDateString) {
  if (!solarDateString) return "";

  try {
    const solarDate = new Date(solarDateString);
    const dd = solarDate.getDate();
    const mm = solarDate.getMonth() + 1;
    const yy = solarDate.getFullYear();

    const lunar = convertSolar2Lunar(dd, mm, yy, 7);
    const canChi = getCanChi(lunar.year);

    // Format: "19 tháng 9 năm Giáp Thìn"
    return `${lunar.day} tháng ${lunar.month} năm ${canChi}`;
  } catch (error) {
    console.error("Error converting to lunar date:", error);
    return "";
  }
}

// ============= HELPER FUNCTIONS =============

function generateUUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Build full image URL from filename
function getImageUrl(filename) {
  return storageDAL.getPublicUrl(filename);
}

// Resize image if too large (use BL layer)
async function resizeImage(
  file,
  maxSizeMB = 1,
  maxWidth = 1920,
  maxHeight = 1920,
  quality = 0.85,
) {
  return await imageBL.resizeImage(file);
}

function showToast(msg) {
  const toast = document.getElementById("toast");
  const toastText = document.getElementById("toast-text");
  if (toast && toastText) {
    toastText.innerHTML = msg;
    toast.style.opacity = "1";
    toast.style.transform = "translate(-50%, 0)";
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translate(-50%, 10px)";
    }, 3000);
  }
}

function showLoading(show, message = null) {
  const overlay = document.getElementById("loading-overlay");
  if (!overlay) return;

  if (show) {
    overlay.classList.remove("hidden");
    overlay.classList.add("flex");

    // Update message if provided
    if (message) {
      const messageEl = document.getElementById("loading-message");
      if (messageEl) {
        messageEl.textContent = message;
      }
    }
  } else {
    overlay.classList.add("hidden");
    overlay.classList.remove("flex");
    const progress = document.getElementById("upload-progress");
    if (progress) progress.textContent = "0%";

    // Reset message to default
    const messageEl = document.getElementById("loading-message");
    if (messageEl) {
      messageEl.textContent = "Đang xử lý...";
    }
  }
}

// ============= IMAGE PREVIEW FUNCTIONS =============

function showImagePreview(fieldName, url) {
  const prefix = fieldName.replace("_url", "").replace("_image", "");
  const uploadArea = document.getElementById(`${prefix}-upload-area`);
  const preview = document.getElementById(`${prefix}-preview`);
  const previewImg = document.getElementById(`${prefix}-preview-img`);

  if (uploadArea && preview && previewImg) {
    uploadArea.classList.add("hidden");
    preview.classList.remove("hidden");
    previewImg.src = url;
  }
}

function renderGalleryGrid() {
  const container = document.getElementById("gallery-container");
  if (!container) return;

  container.innerHTML = "";

  // Get existing filenames from textarea
  const textarea = document.querySelector(
    'textarea[name="gallery_images_raw"]',
  );
  const existingFilenames = textarea
    ? textarea.value.trim().split("\n").filter(Boolean)
    : [];

  // Render existing images from DB
  existingFilenames.forEach((filename, index) => {
    const fullUrl = getImageUrl(filename);
    const div = document.createElement("div");
    div.className =
      "relative aspect-square rounded-lg overflow-hidden border border-gray-200 shadow-sm group bg-gray-100";
    div.innerHTML = `
      <img src="${fullUrl}" alt="Gallery ${index + 1}" class="w-full h-full object-contain" />
      <button onclick="removeExistingGalleryImage(${index})" class="absolute top-1 right-1 bg-red-500 rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600 transition-colors shadow-md p-1">
        <img src="../assets/icons/bin.png" alt="Delete" class="w-full h-full" />
      </button>
    `;
    container.appendChild(div);
  });

  // Render pending new uploads
  pendingUploads.galleryImages.forEach((file, index) => {
    const url = URL.createObjectURL(file);
    const div = document.createElement("div");
    div.className =
      "relative aspect-square rounded-lg overflow-hidden border border-gray-200 shadow-sm group bg-gray-100";
    div.innerHTML = `
      <img src="${url}" alt="New ${index + 1}" class="w-full h-full object-contain" />
      <button onclick="removeGalleryImage(${index})" class="absolute top-1 right-1 bg-red-500 rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600 transition-colors shadow-md p-1">
        <img src="../assets/icons/bin.png" alt="Delete" class="w-full h-full" />
      </button>
    `;
    container.appendChild(div);
  });

  const totalImages =
    existingFilenames.length + pendingUploads.galleryImages.length;

  // Render upload button if not at max
  if (totalImages < MAX_GALLERY_IMAGES) {
    const uploadBtn = document.createElement("div");
    uploadBtn.className =
      "aspect-square rounded-lg border border-dashed border-gray-300 bg-gray-50 hover:border-rose-400 hover:bg-rose-50 transition-all cursor-pointer flex items-center justify-center";
    uploadBtn.style.borderWidth = "1px";
    uploadBtn.style.borderStyle = "dashed";
    uploadBtn.onclick = () =>
      document.getElementById("gallery-file-input").click();
    uploadBtn.innerHTML = `
      <div class="text-center">
        <div class="text-3xl text-gray-400 mb-1">+</div>
        <p class="text-xs text-gray-500">${totalImages}/${MAX_GALLERY_IMAGES}</p>
      </div>
    `;
    container.appendChild(uploadBtn);
  }
}

function renderSingleImageUpload(fieldName) {
  // Map field names to container IDs
  const containerMap = {
    cover_image_url: "cover",
    groom_image_url: "groom",
    bride_image_url: "bride",
    groom_qr_url: "groom-qr",
    bride_qr_url: "bride-qr",
  };

  const prefix = containerMap[fieldName];
  if (!prefix) {
    console.error(`Unknown field name: ${fieldName}`);
    return;
  }

  const container = document.getElementById(`${prefix}-container`);

  if (!container) {
    console.error(`Container not found: ${prefix}-container`);
    return;
  }

  container.innerHTML = "";

  // Determine size and object-fit based on field
  let sizeClass, objectFit;
  if (fieldName === "cover_image_url") {
    sizeClass = "aspect-[3/4]"; // Khung dọc cho cover
    objectFit = "object-cover";
  } else if (
    fieldName === "groom_image_url" ||
    fieldName === "bride_image_url"
  ) {
    sizeClass = "h-52"; // h-52 = 208px, width sẽ set inline
    objectFit = "object-cover";
  } else if (fieldName === "groom_qr_url" || fieldName === "bride_qr_url") {
    sizeClass = "aspect-square"; // QR code hình vuông
    objectFit = "object-contain";
  } else {
    sizeClass = "aspect-square";
    objectFit = "object-contain";
  }

  // Check if there's a pending upload (new file selected)
  if (pendingUploads.singleImages[fieldName]) {
    // Has new image, show preview from File object
    const url = URL.createObjectURL(pendingUploads.singleImages[fieldName]);
    const div = document.createElement("div");
    div.className = `relative ${sizeClass} rounded-lg overflow-hidden border border-gray-200 shadow-sm group bg-gray-100`;
    if (fieldName === "groom_image_url" || fieldName === "bride_image_url") {
      div.style.width = "183px";
    }
    div.innerHTML = `
      <img src="${url}" alt="Preview" class="w-full h-full ${objectFit}" />
      <button onclick="removeImage('${fieldName}')" class="absolute top-1 right-1 bg-red-500 rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600 transition-colors shadow-md p-1">
        <img src="../assets/icons/bin.png" alt="Delete" class="w-full h-full" />
      </button>
    `;
    container.appendChild(div);
  } else {
    // Check if there's an existing filename in hidden input
    const hiddenInput = document.querySelector(`input[name="${fieldName}"]`);
    const existingFilename = hiddenInput ? hiddenInput.value : null;

    if (existingFilename) {
      // Has existing image from DB, build full URL and show preview
      const fullUrl = getImageUrl(existingFilename);
      const div = document.createElement("div");
      div.className = `relative ${sizeClass} rounded-lg overflow-hidden border border-gray-200 shadow-sm group bg-gray-100`;
      if (fieldName === "groom_image_url" || fieldName === "bride_image_url") {
        div.style.width = "183px";
      }
      div.innerHTML = `
        <img src="${fullUrl}" alt="Preview" class="w-full h-full ${objectFit}" />
        <button onclick="removeImage('${fieldName}')" class="absolute top-1 right-1 bg-red-500 rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600 transition-colors shadow-md p-1">
          <img src="../assets/icons/bin.png" alt="Delete" class="w-full h-full" />
        </button>
      `;
      container.appendChild(div);
    } else {
      // No image at all, show upload button
      const uploadBtn = document.createElement("div");
      uploadBtn.className = `${sizeClass} rounded-lg border border-dashed border-gray-300 bg-gray-50 hover:border-rose-400 hover:bg-rose-50 transition-all cursor-pointer flex items-center justify-center`;
      uploadBtn.style.borderWidth = "1px";
      uploadBtn.style.borderStyle = "dashed";
      if (fieldName === "groom_image_url" || fieldName === "bride_image_url") {
        uploadBtn.style.width = "183px";
      }
      uploadBtn.onclick = () =>
        document.getElementById(`${prefix}-file-input`).click();
      uploadBtn.innerHTML = `
        <div class="text-center">
          <div class="text-3xl text-gray-400 mb-1">+</div>
          <p class="text-xs text-gray-500">Chọn ảnh</p>
        </div>
      `;
      container.appendChild(uploadBtn);
    }
  }
}

// ============= PENDING UPLOADS STORAGE =============

const MAX_GALLERY_IMAGES = 7;

const pendingUploads = {
  singleImages: {}, // { fieldName: File }
  galleryImages: [], // [File, File, ...]
};

// Track deleted images (filenames that were in DB but user deleted)
const deletedImages = {
  singleImages: [], // [filename1, filename2, ...]
  galleryImages: [], // [filename1, filename2, ...]
};

// ============= PREVIEW FUNCTIONS (LOCAL) =============

async function handleImageUpload(event, fieldName) {
  const file = event.target.files[0];
  if (!file) return;

  console.log(
    `Selected image for ${fieldName}: ${file.name}, size: ${(file.size / 1024 / 1024).toFixed(2)}MB`,
  );

  if (!file.type.startsWith("image/")) {
    showToast("❌ Chỉ chấp nhận file ảnh!");
    return;
  }

  // Check if this is a QR code field
  const isQRField =
    fieldName === "groom_qr_url" || fieldName === "bride_qr_url";

  if (isQRField) {
    // Open crop modal for QR codes
    openImageCropModal(file, async (croppedBlob) => {
      showLoading(true, "Đang xử lý ảnh...");
      try {
        // Convert blob to File
        const croppedFile = new File([croppedBlob], file.name, {
          type: "image/png",
          lastModified: Date.now(),
        });

        // Resize cropped image
        const processedFile = await resizeImage(croppedFile, 1, 800, 800);

        // Store file for later upload
        pendingUploads.singleImages[fieldName] = processedFile;

        // Render UI
        renderSingleImageUpload(fieldName);

        showToast("✅ Đã chọn ảnh (chưa lưu)");
      } catch (error) {
        console.error("Error processing image:", error);
        showToast("❌ Lỗi xử lý ảnh: " + error.message);
      } finally {
        showLoading(false);
      }
    });
  } else {
    // Normal image upload (no crop)
    showLoading(true, "Ảnh vượt quá dung lượng cho phép, đang nén ảnh lại...");

    try {
      // Resize image locally
      const processedFile = await resizeImage(file, 1, 1920, 1920);

      // Store file for later upload
      pendingUploads.singleImages[fieldName] = processedFile;

      // Render UI
      renderSingleImageUpload(fieldName);

      showToast("✅ Đã chọn ảnh (chưa lưu)");
    } catch (error) {
      console.error("Error processing image:", error);
      showToast("❌ Lỗi xử lý ảnh: " + error.message);
    } finally {
      showLoading(false);
    }
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

function autoPreviewYouTubeMusic() {
  const input = document.getElementById("youtube-link-input");
  const url = input.value.trim();
  const preview = document.getElementById("youtube-preview");

  // If empty, hide preview
  if (!url) {
    preview.classList.add("hidden");
    return;
  }

  const videoId = extractYouTubeVideoId(url);
  if (!videoId) {
    // Invalid URL, hide preview
    preview.classList.add("hidden");
    return;
  }

  // Valid URL, show preview
  showYouTubePreview(videoId, url);
}

function showYouTubePreview(videoId, url) {
  const preview = document.getElementById("youtube-preview");
  const container = document.getElementById("youtube-player-container");

  // Simple YouTube embed
  container.innerHTML = `
    <div style="position: relative; width: 100%; height: 100%; background: #000;">
      <iframe
        src="https://www.youtube.com/embed/${videoId}"
        title="YouTube video player"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowfullscreen
        style="width: 100%; height: 100%; border: 0; display: block;"
      ></iframe>
    </div>
  `;

  // Show preview
  preview.classList.remove("hidden");
}

function renderExistingYouTubeMusic(musicUrl) {
  if (
    !musicUrl ||
    (!musicUrl.includes("youtube.com") && !musicUrl.includes("youtu.be"))
  ) {
    return; // Not a YouTube URL
  }

  const input = document.getElementById("youtube-link-input");
  input.value = musicUrl;

  // Auto preview
  autoPreviewYouTubeMusic();
}

// Setup auto-preview on input change
document.addEventListener("DOMContentLoaded", function () {
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
  if (files.length === 0) return;

  // Check limit
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

  console.log(`Selected ${filesToProcess.length} gallery images`);
  showLoading(true, "Ảnh vượt quá dung lượng cho phép, đang nén ảnh lại...");
  const errors = [];

  try {
    for (let i = 0; i < filesToProcess.length; i++) {
      const file = filesToProcess[i];

      if (!file.type.startsWith("image/")) {
        errors.push(`${file.name} không phải ảnh`);
        continue;
      }

      try {
        // Resize image locally
        const processedFile = await resizeImage(file, 1, 1920, 1920);
        pendingUploads.galleryImages.push(processedFile);

        // Update progress
        const progress = Math.round(((i + 1) / filesToProcess.length) * 100);
        const progressEl = document.getElementById("upload-progress");
        if (progressEl) progressEl.textContent = `${progress}%`;
      } catch (error) {
        console.error(`Error processing ${file.name}:`, error);
        errors.push(`${file.name}: ${error.message}`);
      }
    }

    // Render grid
    renderGalleryGrid();

    const successCount = filesToProcess.length - errors.length;
    if (successCount > 0) {
      showToast(`✅ Đã chọn ${successCount} ảnh (chưa lưu)`);
    }

    if (errors.length > 0) {
      console.error("Selection errors:", errors);
      showToast(`⚠️ ${errors.length} ảnh lỗi`);
    }
  } catch (error) {
    console.error("Gallery selection error:", error);
    showToast("❌ Lỗi chọn ảnh: " + error.message);
  } finally {
    showLoading(false);
    // Reset input to allow selecting same files again
    event.target.value = "";
  }
}

// ============= ACTUAL UPLOAD FUNCTIONS =============

async function uploadSingleImage(fieldName, file) {
  // Use BL layer to upload
  return await imageBL.uploadSingleImage(WEDDING_ID, fieldName, file);
}

async function uploadAllPendingImages() {
  const uploadedFilenames = {};
  const errors = [];

  // Upload single images
  for (const [fieldName, file] of Object.entries(pendingUploads.singleImages)) {
    try {
      const filename = await uploadSingleImage(fieldName, file);
      uploadedFilenames[fieldName] = filename;
      console.log(`Uploaded ${fieldName}: ${filename}`);
    } catch (error) {
      console.error(`Error uploading ${fieldName}:`, error);
      errors.push(`${fieldName}: ${error.message}`);
    }
  }

  // Upload gallery images using BL layer
  if (pendingUploads.galleryImages.length > 0) {
    try {
      const result = await imageBL.uploadMultipleImages(
        WEDDING_ID,
        pendingUploads.galleryImages,
      );

      if (result.filenames.length > 0) {
        uploadedFilenames.gallery_images = result.filenames;
      }

      if (result.errors.length > 0) {
        result.errors.forEach((err) => {
          errors.push(`Gallery ${err.index + 1}: ${err.error}`);
        });
      }
    } catch (error) {
      console.error("Error uploading gallery:", error);
      errors.push(`Gallery: ${error.message}`);
    }
  }

  return { uploadedFilenames, errors };
}

// ============= REMOVE FUNCTIONS =============

function removeImage(fieldName) {
  // Check if this is a pending upload (temp image) or existing image from DB
  if (pendingUploads.singleImages[fieldName]) {
    // This is a temp image, just remove from pendingUploads
    delete pendingUploads.singleImages[fieldName];
  } else {
    // This is an existing image from DB, mark for deletion
    const hiddenInput = document.querySelector(`input[name="${fieldName}"]`);
    const existingFilename = hiddenInput ? hiddenInput.value : null;

    if (existingFilename) {
      // Extract filename from URL if it's a full URL
      let filename = existingFilename;
      if (existingFilename.startsWith("http")) {
        // Extract filename from URL: https://...workers.dev/abc123.jpg -> abc123.jpg
        filename = existingFilename.split("/").pop();
      }
      deletedImages.singleImages.push(filename);
      console.log("Marked for deletion:", filename);
    }

    if (hiddenInput) hiddenInput.value = "";
  }

  // Render UI
  renderSingleImageUpload(fieldName);

  showToast("🗑️ Đã xóa ảnh");
}

function removeGalleryImage(index) {
  // Remove from pending uploads (temp images not yet saved)
  // These are NEW images user just selected, not in DB yet
  pendingUploads.galleryImages.splice(index, 1);

  // Render grid
  renderGalleryGrid();

  showToast("🗑️ Đã xóa ảnh");
}

function removeExistingGalleryImage(index) {
  // Remove from existing images (already in DB)
  const textarea = document.querySelector(
    'textarea[name="gallery_images_raw"]',
  );
  if (!textarea) return;

  const filenames = textarea.value.trim().split("\n").filter(Boolean);
  const deletedFilename = filenames[index];

  // Mark for deletion in Storage
  if (deletedFilename) {
    // Extract filename from URL if it's a full URL
    let filename = deletedFilename;
    if (deletedFilename.startsWith("http")) {
      // Extract filename from URL: https://...workers.dev/abc123.jpg -> abc123.jpg
      filename = deletedFilename.split("/").pop();
    }
    deletedImages.galleryImages.push(filename);
    console.log("Marked gallery image for deletion:", filename);
  }

  filenames.splice(index, 1);
  textarea.value = filenames.join("\n");

  // Render grid
  renderGalleryGrid();

  showToast("🗑️ Đã xóa ảnh");
}

// ============= DATA FUNCTIONS =============

async function loadData() {
  try {
    // Use BL layer to fetch wedding data
    const data = await weddingBL.getWeddingById(WEDDING_ID);
    fillForm(data);

    // Hide skeleton and show actual content
    const skeleton = document.getElementById("skeleton-loader");
    const content = document.getElementById("actual-content");
    if (skeleton) skeleton.classList.add("hidden");
    if (content) content.classList.remove("hidden");
  } catch (error) {
    showToast("❌ " + error.message);
    // Still hide skeleton on error
    const skeleton = document.getElementById("skeleton-loader");
    const content = document.getElementById("actual-content");
    if (skeleton) skeleton.classList.add("hidden");
    if (content) content.classList.remove("hidden");
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

  Object.keys(data).forEach((key) => {
    const el = form.querySelector(`[name="${key}"]`);

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

    // Special handling for YouTube music URL
    if (key === "music_url" && data[key]) {
      renderExistingYouTubeMusic(data[key]);
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
}

async function saveAll() {
  const btn = document.getElementById("save-btn");
  if (!btn) return;

  const originalText = btn.innerHTML;
  btn.innerHTML =
    '<span class="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span> Đang lưu...';
  btn.disabled = true;

  try {
    // Step 1: Upload pending images
    showLoading(true, "Đang tải ảnh lên server...");
    const { uploadedFilenames, errors } = await uploadAllPendingImages();
    showLoading(false);

    if (errors.length > 0) {
      console.error("Upload errors:", errors);
      showToast(`⚠️ ${errors.length} ảnh lỗi khi upload`);
    }

    // Step 2: Prepare form data
    const form = document.getElementById("wedding-form");
    const formData = new FormData(form);
    const payload = { id: WEDDING_ID, slug: WEDDING_SLUG };

    // Step 2.5: Get YouTube music URL (prioritize textbox input over hidden input)
    const youtubeTextbox = document.getElementById("youtube-link-input");
    const musicUrlInput = document.getElementById("music-url-input");

    // Use textbox value if available, otherwise use hidden input
    const musicUrl =
      youtubeTextbox?.value?.trim() || musicUrlInput?.value?.trim();

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
      if (key === "gallery_images_raw") {
        // Skip, will handle separately
      } else if (key === "slug") {
        // Slug được lưu riêng qua nút Áp dụng, không lưu ở đây
      } else if (value.trim()) {
        // Only add non-empty values
        payload[key] = value.trim();
      } else if (key.includes("_url") || key.includes("_lunar")) {
        // For image URLs and lunar dates, explicitly set null if empty
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

    // Step 4: Save to database using BL layer
    await weddingBL.updateWedding(payload);

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

    // Step 7: Re-render UI to reflect saved state
    renderSingleImageUpload("cover_image_url");
    renderSingleImageUpload("groom_image_url");
    renderSingleImageUpload("bride_image_url");
    renderSingleImageUpload("groom_qr_url");
    renderSingleImageUpload("bride_qr_url");
    renderGalleryGrid();

    showToast("✅ Đã lưu thành công!");
  } catch (e) {
    console.error("Save error:", e);
    showToast("❌ Lỗi: " + e.message);
  } finally {
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
}

function copyText(inputId) {
  const input = document.getElementById(inputId);
  if (!input) return;

  navigator.clipboard.writeText(input.value);
  showToast("📋 Đã copy link!");
}

async function applySlug() {
  const input = document.getElementById("slug-input");
  if (!input) return;

  const newSlug = input.value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  if (!newSlug) {
    showToast("❌ Vui lòng nhập slug hợp lệ");
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
    showToast("✅ Đã cập nhật slug!");
  } catch (e) {
    showToast("❌ " + e.message);
  } finally {
    showLoading(false);
  }
}

// ============= DRAG & DROP =============

function setupDragDrop(areaId, inputId, fieldName) {
  const area = document.getElementById(areaId);
  if (!area) return;

  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  ["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
    area.addEventListener(eventName, preventDefaults, false);
  });

  ["dragenter", "dragover"].forEach((eventName) => {
    area.addEventListener(
      eventName,
      () => area.classList.add("dragover"),
      false,
    );
  });

  ["dragleave", "drop"].forEach((eventName) => {
    area.addEventListener(
      eventName,
      () => area.classList.remove("dragover"),
      false,
    );
  });

  area.addEventListener(
    "drop",
    (e) => {
      const dt = e.dataTransfer;
      const files = dt.files;
      if (files.length > 0) {
        const input = document.getElementById(inputId);
        if (input) {
          input.files = files;
          if (fieldName === "gallery") {
            handleGalleryUpload({ target: input });
          } else {
            handleImageUpload({ target: input }, fieldName);
          }
        }
      }
    },
    false,
  );
}

// ============= INITIALIZATION =============

function setupLunarDateListeners() {
  // Helper function to update lunar display
  const updateLunarDisplay = (dateValue, displayEl, valueEl) => {
    if (dateValue) {
      const lunarDate = formatLunarDate(dateValue);
      const fullText = `Tức ngày ${lunarDate}`;
      displayEl.textContent = fullText;
      valueEl.value = fullText;
      displayEl.classList.remove("italic", "text-gray-500");
      displayEl.classList.add("text-gray-700");
    } else {
      displayEl.textContent = "Chọn ngày để tự động tính ngày âm lịch";
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
  const groomAddress = document.querySelector('input[name="groom_address"]');
  const groomPartyLocation = document.querySelector(
    'input[name="groom_party_location"]',
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

  const brideAddress = document.querySelector('input[name="bride_address"]');
  const bridePartyLocation = document.querySelector(
    'input[name="bride_party_location"]',
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
    showToast("❌ Không tìm thấy ID thiệp cưới!");
  }
}

// ============= EXPOSE TO GLOBAL SCOPE =============

window.handleTimeInput = handleTimeInput;
window.validateTimeFormat = validateTimeFormat;
window.randomQuote = randomQuote;
window.handleImageUpload = handleImageUpload;
window.handleGalleryUpload = handleGalleryUpload;
window.removeImage = removeImage;
window.removeGalleryImage = removeGalleryImage;
window.removeExistingGalleryImage = removeExistingGalleryImage;
window.saveAll = saveAll;
window.copyText = copyText;
window.applySlug = applySlug;
window.generateLinks = generateLinks;
// YouTube functions removed - now auto-preview on input

// ============= START =============

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializePage);
} else {
  initializePage();
}
