// Đặt cờ .cx-hero-ai-on trên <html> khi cụm nút của màn mở đầu (có "Tạo thiệp
// với AI") còn trên màn — CSS giấu bong bóng XuXi lúc đó (styles/tailwind-src.css).
// Theo dõi khung .hero-cta chứ không phải nút: <x-button> tự thay mình bằng
// <button> khi nạp, bám vào nó là theo dõi một phần tử đã bị gỡ khỏi trang.
(function () {
  const box = document.querySelector(".hero-cta");
  if (!box || !("IntersectionObserver" in window)) return;
  new IntersectionObserver(([e]) => {
    document.documentElement.classList.toggle("cx-hero-ai-on", e.isIntersecting);
  }).observe(box);
})();
