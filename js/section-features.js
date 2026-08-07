// --- Features list (#inside right column) ---

const FEATURES_DATA = [
  { icon: "fa-user-tag",     title: "Thiệp riêng từng khách mời",       desc: "Mỗi người nhận một link thiệp với tên cá nhân hóa riêng — tạo cảm giác trân trọng." },
  { icon: "fa-heart",        title: "Câu chuyện tình yêu",               desc: "Kể lại hành trình từ lần đầu gặp, hẹn hò đến ngày cầu hôn — với ảnh và lời kể." },
  { icon: "fa-calendar-alt", title: "Lịch trình ngày cưới chi tiết",     desc: "Tiệc cưới nhà trai, tiệc nhà gái, lễ vu quy và lễ thành hôn — đầy đủ từng sự kiện." },
  { icon: "fa-images",       title: "Album ảnh cưới",                    desc: "Đăng tối đa 10 ảnh, hiển thị đẹp ngay trong thiệp với hiệu ứng trình chiếu." },
  { icon: "fa-music",        title: "Nhạc nền lãng mạn",                 desc: "Chọn bài hát yêu thích từ YouTube làm nhạc nền cho thiệp của bạn." },
  { icon: "fa-qrcode",       title: "QR mừng cưới & bản đồ",             desc: "QR ngân hàng nhận lì xì trực tuyến và Google Maps chỉ đường đến địa điểm tiệc." },
];

function renderFeatures() {
  const el = document.getElementById("featuresList");
  if (!el) return;
  el.innerHTML = FEATURES_DATA.map(
    (f, i) => `<div class="feature-row reveal reveal-delay-${(i % 3) + 1}">
  <div class="feature-icon"><i class="fas ${f.icon} text-sm" style="color:rgb(var(--brand-primary-rgb));"></i></div>
  <div>
    <p class="font-semibold text-sm mb-0.5 text-[rgb(var(--text-heading-rgb))]">${f.title}</p>
    <p class="text-sm opacity-60 leading-relaxed">${f.desc}</p>
  </div>
</div>`,
  ).join("");
  setupRevealObserver();
}

