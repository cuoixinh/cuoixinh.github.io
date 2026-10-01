// Tường mẫu thiệp ở màn mở đầu (.hero-wall): nhân mỗi dải thành 4 bộ ảnh — CSS trượt
// -50% (đúng 2 bộ) nên vòng lặp liền mạch, và nửa đó đủ phủ màn rộng tới ~3000px.
// Hero cuộn khỏi màn thì dừng tường (.is-paused) cho đỡ tốn pin.
(function () {
  const wall = document.querySelector(".hero-wall");
  if (!wall) return;

  wall.querySelectorAll(".hero-wall-row").forEach((row) => {
    const set = [...row.children];
    for (let i = 0; i < 3; i++) set.forEach((img) => row.appendChild(img.cloneNode()));
  });

  if (!("IntersectionObserver" in window)) return;
  new IntersectionObserver(([e]) => wall.classList.toggle("is-paused", !e.isIntersecting)).observe(
    document.getElementById("hero") || wall,
  );
})();
