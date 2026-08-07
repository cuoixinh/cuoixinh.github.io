// --- Steps list (#steps) ---

const STEPS_DATA = [
  { n: 1, icon: "fa-palette",        title: "Chọn mẫu thiệp",      desc: "Xem demo trực tiếp. Đổi mẫu thoải mái, miễn phí.",          last: false },
  { n: 2, icon: "fa-pen-to-square",  title: "Điền thông tin",       desc: "Tên, ảnh, ngày cưới, câu chuyện tình yêu, nhạc nền...",    last: false },
  { n: 3, icon: "fa-eye",            title: "Xem trước & chia sẻ", desc: "Xem thiệp thật, gửi link cho người thân thử trước.",       last: false },
  { n: 4, icon: "fa-lock",           title: "Thanh toán một lần",   desc: "Ưng ý mới cần thanh toán. Một lần — dùng trọn đời.",       last: true  },
];

function renderSteps() {
  const el = document.getElementById("stepsList");
  if (!el) return;
  el.innerHTML = STEPS_DATA.map((s) => `
<div class="step-card reveal reveal-delay-${s.n}${s.last ? "" : " relative"} text-center px-2">
  ${s.last ? "" : '<div class="hidden md:block step-connector"></div>'}
  <div class="relative w-16 h-16 mx-auto mb-5">
    <span class="absolute -top-1 -right-2 text-5xl font-black leading-none select-none pointer-events-none" style="color:rgb(var(--brand-primary-rgb)/0.22);">${s.n}</span>
    <div class="w-16 h-16 rounded-2xl flex items-center justify-center" style="background:linear-gradient(135deg,rgb(var(--preview-line-rgb)),rgb(var(--preview-line-strong-rgb)));box-shadow:0 4px 18px rgb(var(--landing-step-glow-rgb)/0.18);">
      <i class="fas ${s.icon} text-xl" style="color:rgb(var(--landing-step-icon-rgb));"></i>
    </div>
  </div>
  <div class="inline-flex items-center mb-3 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-widest uppercase" style="background:rgb(var(--brand-primary-rgb)/0.18);color:var(--brand-accent);">Bước ${s.n}</div>
  <h3 class="font-playfair font-semibold mb-2 text-[rgb(var(--text-heading-rgb))]">${s.title}</h3>
  <p class="text-sm opacity-60 leading-relaxed">${s.desc}</p>
</div>`).join("");
  setupRevealObserver();
}

