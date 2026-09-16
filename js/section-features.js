// Sơ đồ tính năng ở #inside: hai cột thẻ, vòng icon chen vào mép trong mỗi thẻ.
// Mảng chia ĐÔI theo thứ tự — nửa đầu sang cột trái, nửa sau sang cột phải; giữ
// số CHẴN, lẻ là hai cột so le. Màu lấy theo VỊ TRÍ trong mảng (--info-N-rgb ở
// styles/_colors.css), nên thêm mục phải thêm một token màu.
// Hình dạng thẻ + vòng icon + nhãn số ở styles/tailwind-src.css ("SƠ ĐỒ TÍNH NĂNG").

const FEATURES_DATA = [
  { icon: "contact",  title: "Thiệp riêng từng khách",  desc: "Mỗi người một link, có tên khách ngay trên thiệp." },
  { icon: "heart",    title: "Câu chuyện tình yêu",     desc: "Hành trình từ lần đầu gặp đến ngày cầu hôn, kèm ảnh." },
  { icon: "images",   title: "Album ảnh cưới",          desc: "Tối đa 10 ảnh, trình chiếu ngay trong thiệp." },
  { icon: "calendar", title: "Lịch trình ngày cưới",    desc: "Lễ vu quy, thành hôn, tiệc hai nhà — đủ từng mốc giờ." },
  { icon: "music",    title: "Nhạc nền lãng mạn",       desc: "Chọn bài hát yêu thích từ YouTube làm nền cho thiệp." },
  { icon: "qr-code",  title: "Hộp mừng cưới",           desc: "QR ngân hàng để khách gửi lì xì trực tuyến." },
  { icon: "map-pin",  title: "Bản đồ chỉ đường",        desc: "Google Maps dẫn thẳng tới địa điểm tiệc." },
  { icon: "users",    title: "Xác nhận & lời chúc",     desc: "Khách bấm tham dự và để lại lời chúc ngay trên thiệp." },
];

function _featureItemHTML(f, i) {
  const no = String(i + 1).padStart(2, "0");
  return `<div class="fxr-item reveal reveal-delay-${(i % 3) + 1}" style="--fxr-c: var(--info-${i + 1}-rgb)">
  <div class="fxr-card">
    <p class="fxr-title">${f.title}</p>
    <p class="fxr-desc">${f.desc}</p>
    <span class="fxr-step">${no}</span>
  </div>
  <span class="fxr-bubble"><i data-lucide="${f.icon}"></i></span>
</div>`;
}

function renderFeatures() {
  const left = document.getElementById("featuresLeft");
  const right = document.getElementById("featuresRight");
  if (!left || !right) return;

  const half = Math.ceil(FEATURES_DATA.length / 2);
  left.innerHTML = FEATURES_DATA.slice(0, half).map(_featureItemHTML).join("");
  right.innerHTML = FEATURES_DATA.slice(half)
    .map((f, i) => _featureItemHTML(f, i + half))
    .join("");

  window.lucide?.createIcons({ root: left });
  window.lucide?.createIcons({ root: right });
  setupRevealObserver();
}
