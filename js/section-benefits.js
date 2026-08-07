// --- Benefits grid (#benefits) ---

const BENEFITS_DATA = [
  { icon: "fa-user-check",    iconCls: "border-pink-100 bg-pink-50 text-pink-500",       title: "Cá nhân hóa tên từng khách mời",          desc: "Mỗi khách nhận link thiệp riêng với tên gọi cá nhân — tạo cảm giác trân trọng và đặc biệt.", featured: true  },
  { icon: "fa-credit-card",   iconCls: "border-amber-100 bg-amber-50 text-amber-500",    title: "Thanh toán một lần — dùng trọn đời",       desc: "Không phí hàng tháng, không giới hạn thời gian. Một lần thanh toán, sở hữu thiệp mãi mãi.", featured: true  },
  { icon: "fa-bolt",          iconCls: "border-blue-100 bg-blue-50 text-blue-500",       title: "Tự tạo thiệp nhanh, không cần kỹ thuật",   desc: "Điền thông tin, chọn ảnh, chọn mẫu — hoàn thành thiệp đẹp chỉ trong vài phút.",             featured: false },
  { icon: "fa-share-nodes",   iconCls: "border-sky-100 bg-sky-50 text-sky-500",          title: "Chia sẻ link không giới hạn lượt xem",     desc: "Gửi qua Zalo, Facebook, SMS... thiệp luôn mở được, không hết hạn, không giới hạn khách.",   featured: false },
  { icon: "fa-arrows-rotate", iconCls: "border-emerald-100 bg-emerald-50 text-emerald-500", title: "Đổi mẫu & nội dung miễn phí mọi lúc",  desc: "Thay đổi mẫu thiệp và nội dung hoàn toàn miễn phí cả trước và sau khi thanh toán.",          featured: false },
  { icon: "fa-images",        iconCls: "border-violet-100 bg-violet-50 text-violet-500", title: "Album ảnh & nhạc nền lãng mạn",            desc: "Tải ảnh cưới, chọn nhạc nền yêu thích — thiệp trở thành kỷ niệm sống động cho cả hai.",     featured: false },
  { icon: "fa-circle-check",  iconCls: "border-orange-100 bg-orange-50 text-orange-500", title: "RSVP xác nhận tham dự trực tuyến",         desc: "Khách bấm xác nhận tham dự ngay trên thiệp. Bạn theo dõi số lượng dễ dàng, không cần gọi điện.", featured: false },
  { icon: "fa-headset",       iconCls: "border-rose-100 bg-rose-50 text-rose-500",       title: "Hỗ trợ tư vấn tận tình qua Messenger",    desc: "Đội ngũ phản hồi nhanh, hỗ trợ từ A đến Z — từ chọn mẫu đến chia sẻ thiệp cho khách.",     featured: false },
];

function startBenefitsAutoScroll(el) {
  if (window.innerWidth >= 640) return;
  const cards = el.children;
  if (!cards.length) return;

  let idx = 0;
  let visible = false;
  let touched = false;
  let timer = null;

  function scrollTo(i) {
    idx = (i + cards.length) % cards.length;
    cards[idx].scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
  }

  function start() {
    if (timer) return;
    timer = setInterval(() => { if (visible && !touched) scrollTo(idx + 1); }, 2000);
  }

  function stop() {
    clearInterval(timer);
    timer = null;
  }

  // Chỉ chạy khi section đang hiển thị trong viewport
  new IntersectionObserver((entries) => {
    visible = entries[0].isIntersecting;
    visible ? start() : stop();
  }, { threshold: 0.3 }).observe(el);

  // Pause on touch, resume after 3s
  el.addEventListener("touchstart", () => { touched = true; }, { passive: true });
  el.addEventListener("touchend", () => {
    setTimeout(() => { touched = false; }, 3000);
  }, { passive: true });
}

function renderBenefits() {
  const el = document.getElementById("benefitsGrid");
  if (!el) return;
  el.innerHTML = BENEFITS_DATA.map((b, i) => {
    const featuredBadge = b.featured
      ? `<div class="absolute top-4 right-4 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide" style="background:rgb(var(--brand-primary-rgb)/0.18);color:rgb(var(--brand-accent-rgb));">NỔI BẬT</div>`
      : "";
    const shadow = b.featured
      ? "hover:shadow-[0_20px_48px_-28px_rgb(var(--shadow-card-rgb)/0.45)] shadow-sm"
      : "hover:shadow-[0_20px_48px_-28px_rgb(var(--shadow-card-rgb)/0.30)]";
    const rel = b.featured ? " relative" : "";
    const delay = ` reveal-delay-${(i % 3) + 1}`;
    return `<div class="group reveal${delay}${rel} min-w-[82%] snap-start sm:min-w-0 rounded-[10px] border p-5 sm:p-6 transition-all duration-300 hover:-translate-y-1 ${shadow}" style="border-color:rgb(var(--brand-primary-rgb)/0.35);background:rgb(var(--white-rgb)/0.9);">
  ${featuredBadge}
  <div class="mb-4 flex h-10 w-10 items-center justify-center rounded-[8px] border ${b.iconCls} transition-transform duration-300 group-hover:-rotate-3 group-hover:scale-105">
    <i class="fas ${b.icon}" style="font-size:1rem;"></i>
  </div>
  <h3 class="font-semibold text-[15px] mb-1.5 text-[rgb(var(--text-heading-rgb))]">${b.title}</h3>
  <p class="text-sm leading-relaxed opacity-60">${b.desc}</p>
</div>`;
  }).join("");
  setupRevealObserver();
  startBenefitsAutoScroll(el);
}

