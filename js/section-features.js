// --- Features list (#inside right column) ---

const FEATURES_DATA = [
  { icon: "contact",     title: "Thiệp riêng từng khách mời",       desc: "Mỗi người nhận một link thiệp với tên cá nhân hóa riêng — tạo cảm giác trân trọng." },
  { icon: "heart",        title: "Câu chuyện tình yêu",               desc: "Kể lại hành trình từ lần đầu gặp, hẹn hò đến ngày cầu hôn — với ảnh và lời kể." },
  { icon: "calendar", title: "Lịch trình ngày cưới chi tiết",     desc: "Tiệc cưới nhà trai, tiệc nhà gái, lễ vu quy và lễ thành hôn — đầy đủ từng sự kiện." },
  { icon: "images",       title: "Album ảnh cưới",                    desc: "Đăng tối đa 10 ảnh, hiển thị đẹp ngay trong thiệp với hiệu ứng trình chiếu." },
  { icon: "music",        title: "Nhạc nền lãng mạn",                 desc: "Chọn bài hát yêu thích từ YouTube làm nhạc nền cho thiệp của bạn." },
  { icon: "qr-code",       title: "QR mừng cưới & bản đồ",             desc: "QR ngân hàng nhận lì xì trực tuyến và Google Maps chỉ đường đến địa điểm tiệc." },
];

function renderFeatures() {
  const el = document.getElementById("featuresList");
  if (!el) return;
  el.innerHTML = FEATURES_DATA.map(
    (f, i) => `<div class="feature-row reveal reveal-delay-${(i % 3) + 1}">
  <div class="feature-icon" style="color:rgb(var(--brand-primary-rgb));">${cxIcon(f.icon, 15)}</div>
  <div>
    <p class="font-semibold text-sm mb-0.5 text-[rgb(var(--text-heading-rgb))]">${f.title}</p>
    <p class="text-sm opacity-60 leading-relaxed">${f.desc}</p>
  </div>
</div>`,
  ).join("");
  setupRevealObserver();
}

