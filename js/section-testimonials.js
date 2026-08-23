// ============= TESTIMONIALS =============

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
];

function renderTestimonials() {
  const el = document.getElementById("testimonialsList");
  if (!el) return;
  el.innerHTML = TESTIMONIALS_DATA.map((t, i) => `
    <div class="testimonial-card reveal reveal-delay-${i + 1}">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
        <div class="testimonial-avatar">${t.avatar}</div>
        <div>
          <p style="font-weight:600;font-size:14px;color:rgb(var(--text-heading-rgb));line-height:1.3;">${t.name}</p>
          <p style="font-size:12px;opacity:0.5;margin-top:2px;">${t.date}</p>
        </div>
      </div>
      <div style="display:flex;gap:2px;margin-bottom:12px;">
        ${`<span style="color:rgb(var(--accent-amber-rgb));fill:currentColor"><i data-lucide="star" style="width:11px;height:11px"></i></span>`.repeat(t.rating)}
      </div>
      <p style="font-size:14px;line-height:1.65;opacity:0.7;">"${t.text}"</p>
    </div>
  `).join("");
  window.lucide?.createIcons({ root: el });
  setupRevealObserver();
}

