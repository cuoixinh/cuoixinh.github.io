// Lưới tính năng ở #inside (bento): thẻ `demo` là thẻ RỘNG 2 cột kèm khung minh hoạ.
// Thứ tự đã xếp để lưới 4 cột mỗi hàng = 1 thẻ rộng + 2 thẻ thường — thêm/bớt mục
// phải giữ nhịp đó, không thì hàng cuối hở. Màu lấy theo VỊ TRÍ (--info-N-rgb ở
// styles/_colors.css), thêm mục phải thêm token. Hình thẻ: .ftr-* ở styles/tailwind-src.css.

// Số mục phải khớp link "+12 tính năng" ở màn mở đầu (index.html, .hero-feats-more).
const FEATURES_DATA = [
  { icon: "contact",       title: "Thiệp riêng cho từng khách", desc: "Mỗi người một link, có tên khách ngay trên thiệp.", demo: "guest" },
  { icon: "send",          title: "Gửi qua Zalo, Messenger", desc: "Link gửi đi hiện sẵn ảnh và tên hai bạn." },
  { icon: "moon",          title: "Ngày âm lịch tự động",    desc: "Chọn ngày dương, thiệp tự ghi kèm ngày âm." },
  { icon: "palette",       title: "Đổi màu, sửa chữ",        desc: "Đổi bộ màu cả thiệp, bấm thẳng vào dòng chữ để chỉnh." },
  { icon: "heart",         title: "Câu chuyện tình yêu",     desc: "Hành trình từ lần đầu gặp đến ngày cầu hôn, kèm ảnh." },
  { icon: "wand-sparkles", title: "Tạo nhanh với AI",        desc: "Kể đôi dòng về hai bạn, trợ lý XuXi dựng sẵn thiệp.", demo: "ai" },
  { icon: "users",         title: "Xác nhận & lời chúc",     desc: "Khách bấm tham dự và để lại lời chúc ngay trên thiệp.", demo: "rsvp" },
  { icon: "images",        title: "Album ảnh cưới",          desc: "Tối đa 10 ảnh, trình chiếu ngay trong thiệp." },
  { icon: "calendar",      title: "Lịch trình ngày cưới",    desc: "Lễ vu quy, thành hôn, tiệc hai nhà — đủ từng mốc giờ." },
  { icon: "map-pin",       title: "Bản đồ chỉ đường",        desc: "Google Maps dẫn thẳng tới nơi làm lễ và đãi tiệc." },
  { icon: "music",         title: "Nhạc nền lãng mạn",       desc: "Chọn bài hát yêu thích từ YouTube làm nền cho thiệp." },
  { icon: "qr-code",       title: "Hộp mừng cưới",           desc: "QR ngân hàng để khách gửi lì xì trực tuyến.", demo: "gift" },
];

// Khung minh hoạ của thẻ rộng — mảnh giao diện giả lập, chỉ để nhìn (aria-hidden).
const FEATURE_DEMOS = {
  guest: `
    <span class="ftr-chip"><i data-lucide="link"></i><span class="truncate">cuoixinh.com/khoi-my</span></span>
    <p class="ftr-note">Trân trọng kính mời</p>
    <p class="font-playfair text-base font-semibold">Anh Tuấn &amp; người thương</p>`,
  ai: `
    <p class="ftr-bubble is-me">Bọn mình quen nhau ở Đà Lạt, yêu 5 năm…</p>
    <p class="ftr-bubble">XuXi đã viết xong lời mời và chuyện tình yêu cho hai bạn.</p>`,
  rsvp: `
    <span class="ftr-chip"><i data-lucide="circle-check"></i>Sẽ tham dự · 2 người</span>
    <p class="ftr-bubble">“Chúc hai bạn trăm năm hạnh phúc, sớm có tin vui!”</p>`,
  gift: `
    <div class="flex items-center gap-3">
      <span class="ftr-qr"><i data-lucide="qr-code"></i></span>
      <div class="min-w-0">
        <p class="font-semibold">Quét để mừng cưới</p>
        <p class="ftr-note">Chuyển khoản thẳng tới cô dâu, chú rể</p>
      </div>
    </div>`,
};

function _featureCardHTML(f, i) {
  const demo = f.demo ? `<div class="ftr-demo" aria-hidden="true">${FEATURE_DEMOS[f.demo]}</div>` : "";
  return `<article class="ftr-card reveal reveal-delay-${(i % 3) + 1}${f.demo ? " is-wide" : ""}" style="--ftr-c: var(--info-${i + 1}-rgb)">
  <div class="ftr-body">
    <span class="ftr-ico"><i data-lucide="${f.icon}"></i></span>
    <h3 class="ftr-title">${f.title}</h3>
    <p class="ftr-desc">${f.desc}</p>
  </div>
  ${demo}
</article>`;
}

function renderFeatures() {
  const grid = document.getElementById("featuresGrid");
  if (!grid) return;
  grid.innerHTML = FEATURES_DATA.map(_featureCardHTML).join("");
  window.lucide?.createIcons({ root: grid });
  setupRevealObserver();
}
