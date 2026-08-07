// Nền thiệp cưới cho màn mở đầu trang chủ (#hero).
//
// Ảnh là file SVG tĩnh trong assets/background/started/, do tab "Ảnh nền" của
// trang quản trị sinh ra. GitHub Pages không cho liệt kê thư mục qua HTTP nên
// danh sách chỉ đọc được từ manifest.json.
//
// Chọn nền: lấy BỘ mới nhất (updated_at), rồi mới chọn biến thể hợp khổ màn
// hình. Chọn theo bộ nên không bao giờ desktop một nền, mobile một nền. Bộ mới
// nhất mà thiếu đúng biến thể cần thì lùi về biến thể còn lại CỦA CHÍNH NÓ,
// không nhảy sang bộ cũ.
//
// Không có manifest / thư mục rỗng / lỗi mạng → im lặng bỏ qua, hero giữ nguyên
// gradient sẵn có (xem .hero-bg trong styles/tailwind-src.css).

(function () {
  const MANIFEST_URL = "/assets/background/started/manifest.json";
  const BASE_URL = "/assets/background/started";
  const DESKTOP_MQ = "(min-width: 768px)"; // khớp breakpoint md của Tailwind

  const layer = document.getElementById("hero-bg");
  if (!layer) return;

  let current = null; // bộ đang dùng: { name, variants }

  function applyVariant() {
    if (!current) return;
    const wantDesktop = window.matchMedia(DESKTOP_MQ).matches;
    const file =
      current.variants[wantDesktop ? "desktop" : "mobile"] ||
      current.variants[wantDesktop ? "mobile" : "desktop"];
    if (!file) return;

    layer.style.setProperty("--hero-bg-url", `url("${BASE_URL}/${file}")`);
    layer.classList.add("is-on");
  }

  fetch(MANIFEST_URL, { cache: "no-cache" })
    .then((r) => (r.ok ? r.json() : null))
    .then((m) => {
      const list = m?.backgrounds;
      if (!Array.isArray(list) || !list.length) return;

      // Admin đã ghi sẵn theo thứ tự mới nhất trước; vẫn sắp lại phòng khi
      // manifest bị sửa tay.
      current = [...list].sort(
        (a, b) => new Date(b.updated_at) - new Date(a.updated_at),
      )[0];
      if (!current?.variants) return;

      applyVariant();
      // Xoay ngang máy / kéo cửa sổ qua breakpoint thì đổi biến thể.
      window.matchMedia(DESKTOP_MQ).addEventListener("change", applyVariant);
    })
    .catch(() => {
      /* chưa có nền — giữ gradient mặc định của hero */
    });
})();
