// ============= TESTIMONIALS =============

// Lời khách hiện theo trang, mỗi trang TESTIMONIALS_PER_PAGE thẻ; "Tiếp" thay
// danh sách bằng trang sau rồi cuộn về thẻ đầu của trang đó. avatar = 2 chữ cái đầu.
const TESTIMONIALS_PER_PAGE = 5;

const TESTIMONIALS_DATA = [
  {
    avatar: "KC",
    name: "Anh Khoa & Minh Châu",
    date: "Tháng 3, 2026",
    rating: 5,
    text: "Mình lo thiệp online sẽ không đẹp bằng thiệp giấy, ai dè còn xịn hơn 😂 Mấy đứa bạn hỏi làm ở đâu hết á, share link cho cả nhóm luôn rồi.",
  },
  {
    avatar: "TL",
    name: "Tiến Dũng & Lan Anh",
    date: "Tháng 4, 2026",
    rating: 5,
    text: "Thật ra mình không rành mấy vụ này lắm nhưng tự mày mò làm xong trong 1 buổi chiều. Giá ok nha m.n, trả 1 lần xài tẹt ga.",
  },
  {
    avatar: "MH",
    name: "Mạnh Hùng & Thu Hà",
    date: "Tháng 5, 2026",
    rating: 5,
    text: "Đổi mẫu 2 lần vì không chịu được 😅 mà không tốn thêm gì. Hỏi bên support là rep liền, không phải chờ kiểu gửi mail rồi để đó.",
  },
  {
    avatar: "QN",
    name: "Quốc Bảo & Ngọc Trâm",
    date: "Tháng 5, 2026",
    rating: 5,
    text: "Phần xác nhận tham dự cứu mình luôn. Trước giờ toàn phải nhắn hỏi từng người, giờ mở danh sách ra là biết bao nhiêu khách, đặt bàn đỡ đau đầu hẳn.",
  },
  {
    avatar: "ĐV",
    name: "Đức Thịnh & Hải Vy",
    date: "Tháng 6, 2026",
    rating: 4,
    text: "Mẫu đẹp, chỉnh chữ trực tiếp trên thiệp tiện ghê. Trừ 1 sao vì mình muốn thêm vài kiểu nhạc nền up từ điện thoại nữa, chứ tổng thể rất hài lòng.",
  },
  {
    avatar: "HP",
    name: "Hoàng Nam & Bích Phương",
    date: "Tháng 6, 2026",
    rating: 5,
    text: "Ông bà nội ở quê cũng tự mở link xem được, còn bấm chỉ đường tới nhà hàng nữa 🥹 Gửi qua Zalo hiện ảnh bìa xinh xỉu.",
  },
  {
    avatar: "TM",
    name: "Thành Long & Thảo My",
    date: "Tháng 7, 2026",
    rating: 5,
    text: "Mã QR mừng cưới gắn sẵn trong thiệp, bạn bè ở xa không về được vẫn gửi quà được. Đọc lời chúc của mọi người mà muốn khóc luôn á.",
  },
  {
    avatar: "VK",
    name: "Văn Kiên & Diệu Linh",
    date: "Tháng 8, 2026",
    rating: 5,
    text: "Mình gửi thiệp riêng cho từng người, link có sẵn tên khách nên ai mở ra cũng thấy được mời đích danh. Nhiều người khen tinh tế lắm.",
  },
  {
    avatar: "PA",
    name: "Minh Phúc & Kiều Anh",
    date: "Tháng 8, 2026",
    rating: 4,
    text: "Lúc đầu hơi lạ tay ở phần chỉnh giao diện, xem lại một lúc là quen. Thiệp lên điện thoại mượt, ảnh nét, đáng tiền.",
  },
  {
    avatar: "GT",
    name: "Gia Huy & Thanh Tâm",
    date: "Tháng 9, 2026",
    rating: 5,
    text: "Nhờ XuXi viết giúp chuyện tình yêu, đọc lên dễ thương mà không sến. Tiết kiệm được khối thời gian, cả hai đứa đều ưng.",
  },
];

let _testimonialsPage = 0;

// Luôn đủ 5 ngôi: `rating` ngôi đầu tô đặc, phần còn lại chỉ có viền.
function starsHTML(rating) {
  return Array.from({ length: 5 }, (_, i) =>
    `<span class="testimonial-star${i < rating ? " is-on" : ""}"><i data-lucide="star" style="width:12px;height:12px"></i></span>`,
  ).join("");
}

function _testimonialCardHTML(t, i) {
  return `
    <div class="testimonial-card reveal reveal-delay-${Math.min(i, 3) + 1}">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
        <div class="testimonial-avatar">${t.avatar}</div>
        <div>
          <p style="font-weight:600;font-size:14px;color:rgb(var(--text-heading-rgb));line-height:1.3;">${t.name}</p>
          <p style="font-size:12px;opacity:0.5;margin-top:2px;">${t.date}</p>
        </div>
      </div>
      <div class="testimonial-stars" role="img" aria-label="${t.rating}/5 sao">
        ${starsHTML(t.rating)}
      </div>
      <p style="font-size:14px;line-height:1.65;opacity:0.7;">"${t.text}"</p>
    </div>`;
}

function _testimonialsPagerHTML(page, pages) {
  if (pages <= 1) return "";
  return `
    <div class="testimonial-pager">
      <x-button variant="outline" tone="neutral" size="sm" icon="chevron-left" data-tpage="${page - 1}"${page === 0 ? " disabled" : ""}>Trước</x-button>
      <span class="testimonial-pager-num">${page + 1} / ${pages}</span>
      <x-button variant="outline" tone="brand" size="sm" data-tpage="${page + 1}"${page === pages - 1 ? " disabled" : ""}>
        Tiếp <i data-lucide="chevron-right" style="width:14px;height:14px"></i>
      </x-button>
    </div>`;
}

// `scroll` = đổi trang do khách bấm: cuộn về thẻ đầu trang mới, hiện thẻ ngay
// (không chờ hiệu ứng reveal vì thẻ đã nằm trong khung nhìn).
function renderTestimonials(page = 0, scroll = false) {
  const el = document.getElementById("testimonialsList");
  if (!el) return;
  const items = TESTIMONIALS_DATA.filter((t) => t.text.trim());
  const pages = Math.ceil(items.length / TESTIMONIALS_PER_PAGE);
  _testimonialsPage = Math.max(0, Math.min(page, pages - 1));
  const start = _testimonialsPage * TESTIMONIALS_PER_PAGE;
  el.innerHTML =
    items.slice(start, start + TESTIMONIALS_PER_PAGE).map(_testimonialCardHTML).join("") +
    _testimonialsPagerHTML(_testimonialsPage, pages);
  window.lucide?.createIcons({ root: el });
  if (scroll) {
    el.querySelectorAll(".reveal").forEach((c) => c.classList.add("revealed"));
    el.querySelector(".testimonial-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
  } else {
    setupRevealObserver();
  }
  if (!el.dataset.pagerBound) {
    el.dataset.pagerBound = "1";
    el.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-tpage]");
      if (btn && !btn.disabled) renderTestimonials(+btn.dataset.tpage, true);
    });
  }
}
