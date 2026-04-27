// ===== SUPABASE CONFIG =====
// Dùng Worker URL nếu có để giảm tải Supabase free tier
const WORKER_URL = "https://wedding-cache-proxy.cuoixinh-api.workers.dev";
const SUPABASE_EDGE_URL =
  "https://lcobawmkywtxhpezndsh.supabase.co/functions/v1/wedding-admin";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxjb2Jhd21reXd0eGhwZXpuZHNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4OTA5ODMsImV4cCI6MjA5MTQ2Njk4M30.4BNmxnfixXdHOq0ovtaF_4wQZ9sap3IWbJNJK9H4Mg4";
const API_BASE = WORKER_URL || SUPABASE_EDGE_URL;

// Lấy slug từ URL: ?slug=van-hung-thuy-hang
// Hoặc hardcode cho 1 thiệp cụ thể
function getSlug() {
  const params = new URLSearchParams(window.location.search);
  return params.get("slug") || "van-hung-thuy-hang"; // fallback default
}

// Fetch data qua Cloudflare Worker (cache) hoặc Supabase trực tiếp
async function fetchWedding() {
  const slug = getSlug();
  const res = await fetch(`${API_BASE}?slug=${encodeURIComponent(slug)}`, {
    headers: {
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });
  const data = await res.json();
  if (!data || data.error) return null;
  return data; // Edge Function trả về object trực tiếp, không phải array
}

// Chuyển đổi dương lịch sang âm lịch (fallback nếu DB không có)
function toLunar(dateStr) {
  if (!dateStr) return "";
  // Thuật toán chuyển đổi âm lịch Việt Nam
  const date = new Date(dateStr);
  const result = convertSolarToLunar(
    date.getDate(),
    date.getMonth() + 1,
    date.getFullYear(),
  );
  const canChiYear = getCanChiYear(result[2]);
  return `Ngày ${result[0]} tháng ${result[1]} năm ${canChiYear}`;
}

// Render toàn bộ thiệp từ data
function renderWedding(w) {
  if (!w) {
    showExpired("Không tìm thấy thiệp");
    return;
  }
  if (!w.is_active) {
    showExpired("Thiệp cưới đã hết hạn");
    return;
  }

  // --- COVER ---
  setText("cover-groom-name", w.groom_name);
  setText("cover-bride-name", w.bride_name);
  setAttr("cover-bg-img", "src", w.cover_image_url);

  // --- SAVE THE DATE ---
  setAttr("main-photo", "src", w.cover_image_url);
  setText("couple-names-groom", w.groom_name);
  setText("couple-names-bride", w.bride_name);

  // --- THÔNG TIN NHÀ TRAI ---
  setText("groom-father", w.groom_father);
  setText("groom-mother", w.groom_mother);
  setText("groom-address", w.groom_address);
  setText("groom-name-label", w.groom_name);
  setAttr("groom-photo", "src", w.groom_image_url);

  // --- THÔNG TIN NHÀ GÁI ---
  setText("bride-father", w.bride_father);
  setText("bride-mother", w.bride_mother);
  setText("bride-address", w.bride_address);
  setText("bride-name-label", w.bride_name);
  setAttr("bride-photo", "src", w.bride_image_url);

  // --- THƯ MỜI ---
  setText("invite-groom", w.groom_name);
  setText("invite-bride", w.bride_name);
  const ceremonyDate = w.groom_ceremony_date;
  const ceremonyDateObj = new Date(ceremonyDate);
  setText("invite-day", ceremonyDateObj.getDate());
  setText(
    "invite-month-year",
    `Tháng ${ceremonyDateObj.getMonth() + 1} · ${ceremonyDateObj.getFullYear()}`,
  );
  setText("invite-time", w.groom_ceremony_time);
  setText("invite-lunar", w.groom_ceremony_lunar || toLunar(ceremonyDate));

  // --- TIỆC MỪNG LỄ THÀNH HÔN ---
  const partyDate = new Date(w.groom_party_date);
  setText(
    "party-datetime",
    `${w.groom_party_time} - ${partyDate.getDate()}.${String(partyDate.getMonth() + 1).padStart(2, "0")}.${partyDate.getFullYear()}`,
  );
  setText("party-lunar", w.groom_party_lunar || toLunar(w.groom_party_date));
  setText("party-location", w.groom_party_location);

  // --- LỊCH ---
  if (w.groom_ceremony_date && w.groom_party_date) {
    const d1 = new Date(w.groom_ceremony_date);
    const d2 = new Date(w.groom_party_date);
    weddingDates[0] = {
      year: d1.getFullYear(),
      month: d1.getMonth() + 1,
      day: d1.getDate(),
    };
    weddingDates[1] = {
      year: d2.getFullYear(),
      month: d2.getMonth() + 1,
      day: d2.getDate(),
    };
    renderMiniCalendar();
  }

  // --- GALLERY ---
  if (w.gallery_images && w.gallery_images.length > 0) {
    images.length = 0;
    w.gallery_images.forEach((url) => images.push(url));
    // Re-render carousel
    track.innerHTML = "";
    dotsContainer.innerHTML = "";
    for (let i = 0; i < images.length; i++) {
      const item = document.createElement("div");
      item.className =
        "carousel-item shrink-0 rounded-2xl overflow-hidden cursor-pointer";
      item.style.cssText =
        "transition: width 0.4s cubic-bezier(0.4,0,0.2,1), height 0.4s cubic-bezier(0.4,0,0.2,1), opacity 0.4s cubic-bezier(0.4,0,0.2,1), box-shadow 0.4s ease;";
      item.innerHTML = `<img src="${images[i]}" class="w-full h-full object-cover pointer-events-none" alt="">`;
      item.addEventListener("click", () => {
        if (i !== current) {
          current = i;
          update();
        }
      });
      track.appendChild(item);
      const dot = document.createElement("div");
      dot.style.cssText =
        "height:6px; border-radius:9999px; transition: all 0.3s;";
      dotsContainer.appendChild(dot);
    }
    current = Math.floor(images.length / 2);
    fixHeight();
    update();
    setTimeout(attachClickHandler, 100);
  }

  // --- HỘP MỪNG CƯỚI ---
  setText("groom-bank-name", w.groom_bank_name);
  setText("groom-bank-number", w.groom_bank_number);
  setText("groom-bank-owner", w.groom_bank_owner);
  setAttr("groom-qr-img", "src", w.groom_qr_url);
  setText("bride-bank-name", w.bride_bank_name);
  setText("bride-bank-number", w.bride_bank_number);
  setText("bride-bank-owner", w.bride_bank_owner);
  setAttr("bride-qr-img", "src", w.bride_qr_url);

  // --- BẢN ĐỒ ---
  setAttr("map-thumbnail-iframe", "src", w.groom_map_embed_url);
  setAttr("map-link", "href", w.groom_map_link);

  // --- STORY QUOTE ---
  setText("story-quote", w.story_quote);

  // --- LOAD TÊN KHÁCH TỪ GOOGLE SHEET ---
  if (w.google_sheet_url) {
    loadGuestName(w.google_sheet_url);
  }

  // --- ĐÁNH DẤU ĐÃ XEM THIỆP ---
  const urlParams = new URLSearchParams(window.location.search);
  const isGroom = urlParams.get("isGroom") !== "false";
  const sheetUrl = isGroom
    ? w.groom_google_sheet_url
    : w.bride_google_sheet_url;
  const hasPersonalLink =
    urlParams.get("name") && urlParams.get("relationship");

  if (sheetUrl && hasPersonalLink) {
    // Gửi full URL hiện tại lên, server tự tìm dòng khớp để update
    fetch(sheetUrl, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({
        action: "markViewed",
        link: window.location.href,
      }),
    }).catch((e) => console.log("Không thể đánh dấu đã xem:", e));
  }
}

// Load tên khách từ Google Apps Script
async function loadGuestName(scriptUrl) {
  try {
    const slug = getSlug();
    const res = await fetch(`${scriptUrl}?slug=${slug}`);
    const data = await res.json();
    if (data && data.guest_name) {
      setText("cover-guest-name", data.guest_name);
      setText("invite-guest-name", data.guest_name);
    }
  } catch (e) {
    console.log("Không load được tên khách:", e);
  }
}

// Helper functions
function setText(id, value) {
  const el = document.getElementById(id);
  if (el && value) el.textContent = value;
}

function setAttr(id, attr, value) {
  const el = document.getElementById(id);
  if (el && value) el.setAttribute(attr, value);
}

function showExpired(msg) {
  document.getElementById("cover-screen").style.display = "none";
  document.getElementById("main-card").style.display = "none";
  document.getElementById("expired-screen").style.display = "flex";
  document.getElementById("expired-msg").textContent = msg;
}

// ===== KHỞI ĐỘNG =====
fetchWedding().then(renderWedding);
