// Màn mở đầu trang chủ (#hero): ảnh NỀN (khối đầu) và điểm nhìn của BA Ô ẢNH
// trang trí (khối cuối file). Cả hai đều là file tĩnh do tab "Ảnh nền" của trang
// quản trị ghi ra, danh sách/điểm nhìn đọc từ manifest.json của từng thư mục.
//
// --- Ảnh nền ---
//
// Ảnh là file WebP tĩnh trong assets/background/started/, do admin tải lên.
// GitHub Pages không cho liệt kê thư mục qua HTTP nên danh sách chỉ đọc được từ
// manifest.json.
//
// Chọn nền: lấy BỘ mới nhất (updated_at), rồi mới chọn biến thể hợp khổ màn
// hình. Chọn theo bộ nên không bao giờ desktop một nền, mobile một nền. Bộ mới
// nhất mà thiếu đúng biến thể cần thì lùi về biến thể còn lại CỦA CHÍNH NÓ,
// không nhảy sang bộ cũ.
//
// Điểm nhìn (focal point) — khai trong manifest ở khoá `focal` của mỗi bộ, đơn
// vị % của ẢNH, hai dạng đều nhận: dùng chung `{x,y}` hoặc theo biến thể
// `{desktop:{x,y}, mobile:{x,y}}`. Hero chỉ để lộ nửa TRÊN của lớp nền (mask ở
// .hero-bg) nên ảnh `cover` hay cắt mất mặt cô dâu chú rể; focal nói rõ chỗ
// phải giữ lại. Không khai thì giữ nguyên `center top` của CSS.
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

  // Điểm nhìn của biến thể đang dùng, trả về giá trị background-position hoặc
  // rỗng (giữ mặc định của CSS). Chỉ nhận số trong 0–100, khai sai thì bỏ qua.
  function focalPos(key) {
    const f = current.focal;
    if (!f) return "";
    const p = typeof f.x === "number" || typeof f.y === "number" ? f : f[key];
    const ok = (n) => typeof n === "number" && n >= 0 && n <= 100;
    if (!p || !ok(p.x) || !ok(p.y)) return "";
    return `${p.x}% ${p.y}%`;
  }

  function applyVariant() {
    if (!current) return;
    const wantDesktop = window.matchMedia(DESKTOP_MQ).matches;
    const key = wantDesktop ? "desktop" : "mobile";
    const other = wantDesktop ? "mobile" : "desktop";
    const useKey = current.variants[key] ? key : other;
    const file = current.variants[useKey];
    if (!file) return;

    layer.style.setProperty("--hero-bg-url", `url("${BASE_URL}/${file}")`);
    // Đặt thẳng lên style của lớp để khỏi phải build lại CSS; rỗng thì gỡ ra
    // cho quy tắc `center top` trong .hero-bg trở lại.
    layer.style.backgroundPosition = focalPos(useKey);
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

// Điểm nhìn của BA Ô ẢNH trong màn mở đầu (.hero-pick img). Ba file có tên cố
// định nên src viết thẳng trong index.html; chỉ điểm nhìn là dữ liệu, khai ở
// manifest.json cùng thư mục dưới dạng [{ file, focal:{x,y} }] theo ĐÚNG thứ tự
// ba ô. Không khai / thiếu file → giữ `object-position` mặc định của CSS.
(function () {
  const MANIFEST_URL = "/assets/background/thumbnail_started/manifest.json";

  const imgs = document.querySelectorAll(".hero-picks .hero-pick img");
  if (!imgs.length) return;

  fetch(MANIFEST_URL, { cache: "no-cache" })
    .then((r) => (r.ok ? r.json() : null))
    .then((m) => {
      const list = m?.picks;
      if (!Array.isArray(list)) return;
      imgs.forEach((img, i) => {
        const f = list[i]?.focal;
        const ok = (n) => typeof n === "number" && n >= 0 && n <= 100;
        if (f && ok(f.x) && ok(f.y)) img.style.objectPosition = `${f.x}% ${f.y}%`;
      });
    })
    .catch(() => {
      /* chưa có manifest — giữ neo mặc định của .hero-pick img */
    });
})();
