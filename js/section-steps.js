// Sơ đồ "4 bước" ở #steps: mỗi bước một hàng, so le trái/phải, nối với nhau
// bằng chấm + đường chéo. Hình dạng ở styles/tailwind-src.css (khối "SƠ ĐỒ
// 4 BƯỚC"); ở đây chỉ có nội dung + màu (token --info-N-rgb ở _colors.css).
// Bước CUỐI không có đường nối — thêm/bớt bước thì giữ nguyên luật đó.

const STEPS_DATA = [
  { icon: "palette",   color: 4, title: "Chọn mẫu thiệp",       desc: "Xem trước trực tiếp. Đổi mẫu thoải mái cho tới khi thanh toán." },
  { icon: "square-pen", color: 8, title: "Điền thông tin",      desc: "Tên, ảnh, ngày cưới, câu chuyện tình yêu, nhạc nền..." },
  { icon: "eye",       color: 2, title: "Xem trước & chia sẻ",  desc: "Xem thiệp thật, gửi link cho người thân thử trước." },
  { icon: "lock",      color: 6, title: "Thanh toán một lần",   desc: "Ưng ý mới cần thanh toán. Một lần — dùng trọn đời." },
];

// Đường chéo vẽ một chiều (góc trên-phải xuống góc dưới-trái), hàng bên phải
// lật ngang bằng CSS nên markup mọi hàng giống hệt nhau.
const _STEP_LINK =
  '<svg class="stp-link" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">' +
  '<line x1="100" y1="0" x2="0" y2="100" vector-effect="non-scaling-stroke"/></svg>';

function renderSteps() {
  const el = document.getElementById("stepsList");
  if (!el) return;
  const last = STEPS_DATA.length - 1;
  el.innerHTML = STEPS_DATA.map((s, i) => `
<div class="stp-item ${i % 2 ? "stp-r" : "stp-l"} reveal reveal-delay-${(i % 3) + 1}" style="--stp-c: var(--info-${s.color}-rgb)">
  <div class="stp-card">
    <span class="stp-ico"><i data-lucide="${s.icon}"></i></span>
    <div class="stp-txt">
      <p class="stp-title">${s.title}</p>
      <p class="stp-desc">${s.desc}</p>
    </div>
    <span class="stp-tab">Bước<em>${i + 1}</em></span>
    <span class="stp-num"><b>${String(i + 1).padStart(2, "0")}</b></span>
  </div>
  <span class="stp-dot"></span>${i === last ? "" : _STEP_LINK}
</div>`).join("");
  window.lucide?.createIcons({ root: el });
  setupRevealObserver();
}
