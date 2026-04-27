// Configuration
const MANAGE_EDGE_URL =
  "https://lcobawmkywtxhpezndsh.supabase.co/functions/v1/wedding-admin";
const MANAGE_SUPABASE_URL = "https://lcobawmkywtxhpezndsh.supabase.co";
const MANAGE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxjb2Jhd21reXd0eGhwZXpuZHNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4OTA5ODMsImV4cCI6MjA5MTQ2Njk4M30.4BNmxnfixXdHOq0ovtaF_4wQZ9sap3IWbJNJK9H4Mg4";
const STORAGE_BASE_URL =
  "https://lcobawmkywtxhpezndsh.supabase.co/storage/v1/object/public/wedding-images";
const ENCRYPTION_KEY = "dqvinh";

const params = new URLSearchParams(window.location.search);
const WEDDING_ID = params.get("id");
const DOMAIN = window.location.origin;

// Initialize Supabase client
let manageSupabase;
if (window.supabase) {
  manageSupabase = window.supabase.createClient(
    MANAGE_SUPABASE_URL,
    MANAGE_ANON_KEY,
  );
}

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
  const isGroom = side === "groom";

  try {
    showLoading(true, `Đang kiểm tra cấu hình ${sideText}...`);

    // Fetch wedding data from database to get Google Sheet URL
    const response = await fetch(`${MANAGE_EDGE_URL}?id=${WEDDING_ID}`, {
      headers: { Authorization: `Bearer ${MANAGE_ANON_KEY}` },
    });

    if (!response.ok) {
      throw new Error("Không thể tải dữ liệu đám cưới");
    }

    const weddingData = await response.json();
    const sheetUrl =
      side === "groom"
        ? weddingData.groom_google_sheet_url
        : weddingData.bride_google_sheet_url;

    // Validate URL
    if (!sheetUrl || !sheetUrl.trim()) {
      showLoading(false);
      showToast(`⚠️ Vui lòng cấu hình URL Google Sheet ${sideText} trước`);
      return;
    }

    // Validate URL format
    if (!sheetUrl.includes("script.google.com")) {
      showLoading(false);
      showToast(`⚠️ URL Google Sheet ${sideText} không hợp lệ`);
      return;
    }

    showLoading(true, `Đang lấy danh sách khách mời ${sideText}...`);

    // Fetch all guests from Google Sheet
    const guests = await fetchAllGuests(sheetUrl);

    if (!guests || guests.length === 0) {
      showLoading(false);
      showToast(
        `⚠️ Không tìm thấy khách mời nào trong Google Sheet ${sideText}`,
      );
      return;
    }

    showLoading(true, `Đang tạo link cho ${guests.length} khách mời...`);

    // Generate links: chỉ tạo cho khách có relationship + chưa có link
    const updates = [];
    let skipped = 0;
    for (const guest of guests) {
      // Bỏ qua nếu chưa có relationship hoặc đã có link rồi
      if (!guest.relationship || guest.link) {
        skipped++;
        continue;
      }

      try {
        const encryptedName = encryptData(guest.displayName || "");
        const encryptedRelationship = encryptData(guest.relationship);

        const link = `${DOMAIN}/${WEDDING_SLUG}?isGroom=${isGroom}&name=${encryptedName}&relationship=${encryptedRelationship}`;

        updates.push({ row: guest.row, link });
      } catch (error) {
        console.error(`Error generating link for row ${guest.row}:`, error);
      }
    }

    if (updates.length === 0) {
      showLoading(false);
      showToast(
        skipped > 0
          ? `⚠️ Tất cả khách đã có link hoặc chưa có quan hệ`
          : "⚠️ Không có khách mời nào để tạo link",
      );
      return;
    }

    showLoading(
      true,
      `Đang cập nhật ${updates.length} link vào Google Sheet...`,
    );

    // Batch update links to Google Sheet
    const result = await batchUpdateLinks(sheetUrl, updates);

    showLoading(false);

    if (result.success) {
      const skipMsg = skipped > 0 ? `, bỏ qua ${skipped} đã có link` : "";
      showToast(
        `✅ Đã tạo link thành công cho ${result.count} khách mời ${sideText}${skipMsg}`,
      );
    } else {
      showToast(`❌ Lỗi cập nhật link: ${result.message}`);
    }
  } catch (error) {
    showLoading(false);
    console.error("Generate links error:", error);
    showToast(`❌ ${error.message}`);
  }
}

async function fetchAllGuests(sheetUrl) {
  try {
    // GET request không trigger CORS preflight nên không cần no-cors
    const response = await fetch(`${sheetUrl}?action=getAllGuests`);

    if (!response.ok) {
      throw new Error("Không thể kết nối đến Google Sheets");
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message || "Lỗi lấy dữ liệu từ Google Sheets");
    }

    return data.guests || [];
  } catch (error) {
    console.error("Fetch guests error:", error);
    throw new Error("Không thể kết nối đến Google Sheets");
  }
}

async function batchUpdateLinks(sheetUrl, updates) {
  try {
    // Google Apps Script không hỗ trợ CORS preflight cho POST với Content-Type: application/json
    // Dùng no-cors mode với text/plain để tránh preflight request
    const response = await fetch(sheetUrl, {
      method: "POST",
      mode: "no-cors", // Bypass CORS preflight
      headers: {
        "Content-Type": "text/plain", // text/plain không trigger preflight
      },
      body: JSON.stringify({
        action: "batchUpdateLinks",
        updates: updates,
      }),
    });

    // no-cors mode không đọc được response body
    // Nên ta coi như thành công nếu không có network error
    return { success: true, count: updates.length };
  } catch (error) {
    console.error("Batch update error:", error);
    throw new Error("Lỗi cập nhật link vào Google Sheets");
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
  if (!filename) return "";
  // If already a full URL, return as is (backward compatibility)
  if (filename.startsWith("http://") || filename.startsWith("https://")) {
    return filename;
  }
  // Build full URL from filename
  return `${STORAGE_BASE_URL}/${filename}`;
}

// Resize image if too large
async function resizeImage(
  file,
  maxSizeMB = 1,
  maxWidth = 1920,
  maxHeight = 1920,
  quality = 0.85,
) {
  return new Promise((resolve, reject) => {
    console.log(
      `Processing ${file.name}: ${(file.size / 1024 / 1024).toFixed(2)}MB`,
    );

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // Calculate new dimensions
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            if (width > maxWidth) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }
        }

        // Create canvas and resize
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        // Try to compress to target size
        let currentQuality = quality;
        const tryCompress = (q) => {
          canvas.toBlob(
            (blob) => {
              if (blob) {
                const sizeMB = blob.size / 1024 / 1024;
                console.log(
                  `Compressed with quality ${q.toFixed(2)}: ${sizeMB.toFixed(2)}MB`,
                );

                // If still too large and quality can be reduced, try again
                if (sizeMB > maxSizeMB && q > 0.3) {
                  tryCompress(q - 0.1);
                } else {
                  const resizedFile = new File([blob], file.name, {
                    type: file.type,
                    lastModified: Date.now(),
                  });
                  console.log(
                    `Final size: ${(resizedFile.size / 1024 / 1024).toFixed(2)}MB`,
                  );
                  resolve(resizedFile);
                }
              } else {
                reject(new Error("Failed to resize image"));
              }
            },
            file.type,
            q,
          );
        };

        tryCompress(currentQuality);
      };
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
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
        <img src="assets/icons/bin.png" alt="Delete" class="w-full h-full" />
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
        <img src="assets/icons/bin.png" alt="Delete" class="w-full h-full" />
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
        <img src="assets/icons/bin.png" alt="Delete" class="w-full h-full" />
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
          <img src="assets/icons/bin.png" alt="Delete" class="w-full h-full" />
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
  const extension = file.name.split(".").pop();
  const imageId = generateUUID();
  const filename = `${imageId}.${extension}`;

  console.log(`Uploading ${fieldName} to: ${filename}`);

  const { data, error } = await manageSupabase.storage
    .from("wedding-images")
    .upload(filename, file, {
      cacheControl: "3600",
      upsert: false,
    });

  if (error) throw error;

  // Return only filename, not full URL
  return filename;
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

  // Upload gallery images
  const galleryFilenames = [];
  for (let i = 0; i < pendingUploads.galleryImages.length; i++) {
    const file = pendingUploads.galleryImages[i];
    try {
      const filename = await uploadSingleImage(`gallery-${i}`, file);
      galleryFilenames.push(filename);
      console.log(`Uploaded gallery image ${i + 1}: ${filename}`);
    } catch (error) {
      console.error(`Error uploading gallery image ${i + 1}:`, error);
      errors.push(`Gallery ${i + 1}: ${error.message}`);
    }
  }

  if (galleryFilenames.length > 0) {
    uploadedFilenames.gallery_images = galleryFilenames;
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

    if (existingFilename && !existingFilename.startsWith("http")) {
      deletedImages.singleImages.push(existingFilename);
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
  if (deletedFilename && !deletedFilename.startsWith("http")) {
    deletedImages.galleryImages.push(deletedFilename);
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
    const res = await fetch(`${MANAGE_EDGE_URL}?id=${WEDDING_ID}`, {
      headers: { Authorization: `Bearer ${MANAGE_ANON_KEY}` },
    });
    if (!res.ok) throw new Error("Không tải được dữ liệu");
    const data = await res.json();
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
    const payload = { id: WEDDING_ID };

    // Add deleted images list
    const allDeletedImages = [
      ...deletedImages.singleImages,
      ...deletedImages.galleryImages,
    ];
    if (allDeletedImages.length > 0) {
      payload.deleted_images = allDeletedImages;
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

    // Step 4: Save to database
    const res = await fetch(`${MANAGE_EDGE_URL}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${MANAGE_ANON_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error("Lỗi lưu dữ liệu");

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
    const res = await fetch(MANAGE_EDGE_URL, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${MANAGE_ANON_KEY}`,
      },
      body: JSON.stringify({ id: WEDDING_ID, slug: newSlug }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        res.status === 409
          ? `Tên <b>${newSlug}</b> đã được người khác sử dụng. Vui lòng chọn tên khác`
          : err.error || "Lỗi cập nhật slug",
      );
    }
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

let WEDDING_SLUG = null;
let WEDDING_THEME = "template1"; // fallback default

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

// ============= START =============

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializePage);
} else {
  initializePage();
}
