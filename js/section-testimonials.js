// Lời khách hàng (#testimonials): dải thẻ cuộn ngang (scroll-snap) + nút Trước/Tiếp và
// số vị trí. Không tự chạy. avatar = 2 chữ cái đầu. Hình thẻ: .tst-* ở tailwind-src.css.

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

// Luôn đủ 5 ngôi: `rating` ngôi đầu tô đặc, phần còn lại chỉ có viền.
function starsHTML(rating) {
  return Array.from({ length: 5 }, (_, i) =>
    `<span class="tst-star${i < rating ? " is-on" : ""}"><i data-lucide="star" style="width:14px;height:14px"></i></span>`,
  ).join("");
}

function _testimonialCardHTML(t, i, all) {
  return `
    <li class="tst-card" aria-roledescription="lời khen" aria-label="${i + 1} / ${all.length}">
      <div class="tst-head">
        <span class="tst-quote" aria-hidden="true"><i data-lucide="quote"></i></span>
        <div class="tst-stars" role="img" aria-label="${t.rating}/5 sao">${starsHTML(t.rating)}</div>
      </div>
      <p class="tst-text">${t.text}</p>
      <div class="tst-who">
        <div class="tst-avatar" aria-hidden="true">${t.avatar}</div>
        <div>
          <p class="tst-name">${t.name}</p>
          <p class="tst-date">${t.date}</p>
        </div>
      </div>
    </li>`;
}

// Thẻ đang đứng đầu khung = bội số gần nhất của (bề ngang thẻ + khe).
function _testimonialStep(track) {
  const card = track.querySelector(".tst-card");
  return card ? card.offsetWidth + parseFloat(getComputedStyle(track).columnGap || 0) : 1;
}

function _syncTestimonialNav(track, total) {
  const idx = Math.round(track.scrollLeft / _testimonialStep(track));
  const atEnd = track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;
  const pos = document.getElementById("testimonialsPos");
  if (pos) pos.textContent = `${atEnd ? total : Math.min(idx + 1, total)} / ${total}`;
  const prev = document.getElementById("testimonialsPrev");
  const next = document.getElementById("testimonialsNext");
  if (prev) prev.disabled = track.scrollLeft <= 4;
  if (next) next.disabled = atEnd;
}

function renderTestimonials() {
  const track = document.getElementById("testimonialsList");
  if (!track) return;
  const items = TESTIMONIALS_DATA.filter((t) => t.text.trim());
  track.innerHTML = items.map(_testimonialCardHTML).join("");
  window.lucide?.createIcons({ root: track });

  const avg = items.reduce((s, t) => s + t.rating, 0) / (items.length || 1);
  const num = document.getElementById("testimonialsAvg");
  const meta = document.getElementById("testimonialsCount");
  if (num) num.textContent = avg.toFixed(1).replace(".", ",");
  if (meta) meta.textContent = `từ ${items.length} cặp đôi đã dùng`;

  const smooth = matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
  const go = (dir) => track.scrollBy({ left: dir * _testimonialStep(track), behavior: smooth });
  document.getElementById("testimonialsPrev")?.addEventListener("click", () => go(-1));
  document.getElementById("testimonialsNext")?.addEventListener("click", () => go(1));
  track.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      go(e.key === "ArrowLeft" ? -1 : 1);
    }
  });
  let raf = 0;
  const sync = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => _syncTestimonialNav(track, items.length));
  };
  track.addEventListener("scroll", sync, { passive: true });
  window.addEventListener("resize", sync);
  sync();
}
