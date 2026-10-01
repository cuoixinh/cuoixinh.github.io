// ============= TESTIMONIALS =============

// Mục nào `text` còn rỗng thì không hiện — điền lời khách THẬT (kèm tên khách đã
// đồng ý hiển thị) vào hai chỗ trống cuối là thẻ tự lên. avatar = 2 chữ cái đầu.
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
    avatar: "",
    name: "",
    date: "",
    rating: 4,
    text: "",
  },
  {
    avatar: "",
    name: "",
    date: "",
    rating: 5,
    text: "",
  },
];

// Luôn đủ 5 ngôi: `rating` ngôi đầu tô đặc, phần còn lại chỉ có viền.
function starsHTML(rating) {
  return Array.from({ length: 5 }, (_, i) =>
    `<span class="testimonial-star${i < rating ? " is-on" : ""}"><i data-lucide="star" style="width:12px;height:12px"></i></span>`,
  ).join("");
}

function renderTestimonials() {
  const el = document.getElementById("testimonialsList");
  if (!el) return;
  el.innerHTML = TESTIMONIALS_DATA.filter((t) => t.text.trim()).map((t, i) => `
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
    </div>
  `).join("");
  window.lucide?.createIcons({ root: el });
  setupRevealObserver();
}

