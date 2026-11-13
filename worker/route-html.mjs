/**
 * Dựng trang thiệp ngay tại link `/<slug>` (rewrite, không chuyển hướng): lấy
 * index.html của mẫu, đổi đường dẫn tương đối thành tuyệt đối, chèn slug + noindex.
 * Dùng chung cho worker/index.js (HTMLRewriter) và scripts/dev-server.mjs (regex) —
 * sửa luật ở đây là cả hai bên theo; sửa cách áp ở một bên thì sửa cả bên kia.
 */

// Tên thư mục mẫu do khách sửa được qua API → chỉ nhận dạng slug thư mục.
export const THEME_NAME = /^[a-z0-9][a-z0-9-]*$/;

// Mã lỗi khoá thiệp của wedding-admin (403 kèm theme + tên): vẫn dựng trang thiệp để
// nó hiện màn khoá, không đá về trang chủ. Trình duyệt đọc bản sao CONFIG.lockCodes
// (router.html, wedding-helper.js) — LINT-32 gác hai danh sách khớp nhau.
export const LOCK_CODES = ["TRIAL_EXPIRED", "PLAN_EXPIRED", "VIEW_LIMIT"];

// Path có route riêng trong router.html — không phải slug thiệp.
export const ROUTE_PATHS = new Set(["manage", "account", "customer"]);

/** Slug của một clean URL (đúng một đoạn, không dấu chấm), không phải thì "". */
export function slugSegment(pathname) {
  const seg = String(pathname).replace(/^\/+|\/+$/g, "");
  return seg && !seg.includes("/") && !seg.includes(".") && !ROUTE_PATHS.has(seg)
    ? seg
    : "";
}

// Mẫu thiếu `theme` thì rơi về đây — khớp router.html.
export const DEFAULT_THEME = "basic-gold";

// Thuộc tính chứa URL trong markup mẫu. KHÔNG dùng <base href> thay cho việc này:
// nó làm link `#...` trỏ về thư mục mẫu, bấm là rời thiệp.
export const REWRITE_ATTRS = ["src", "href", "srcset", "poster"];

export const themeDir = (theme) => `/public/themes/${theme}/`;

// Phép tính bộ màu (cả "Độ đậm" + bảng màu nút nhạc) lấy THẲNG từ runtime của thiệp để
// màu dựng sẵn khớp từng giá trị với màu applyThemeSetting áp sau đó. File đó chỉ chạy
// lệnh có kiểm `typeof window`, nên nạp ở worker/Node được; nó gán globalThis.cxPaletteRule.
import "../core/helpers/theme-setting-helper.js";

/** URL tương đối (theo thư mục mẫu) → tuyệt đối; URL tuyệt đối, `#…`, rỗng giữ nguyên. */
export function absolutize(value, dir) {
  const v = String(value ?? "").trim();
  if (!v || v.startsWith("#") || v.startsWith("/") || /^[a-z][a-z0-9+.-]*:/i.test(v))
    return value;
  const u = new URL(v, `http://x${dir}`);
  return u.pathname + u.search + u.hash;
}

export function rewriteAttr(name, value, dir) {
  if (name !== "srcset") return absolutize(value, dir);
  return String(value)
    .split(",")
    .map((part) => {
      const [u, ...rest] = part.trim().split(/\s+/);
      return [absolutize(u, dir), ...rest].join(" ");
    })
    .join(", ");
}

function themeSetting(w) {
  let ts = w && w.theme_setting;
  if (typeof ts === "string") {
    try {
      ts = JSON.parse(ts);
    } catch (_) {
      ts = null;
    }
  }
  return ts && typeof ts === "object" ? ts : null;
}

/** Chủ thiệp bật "xem lớn trên máy tính" (`theme_setting.desktop_wide`) — khi đó theme-boot.js không dựng khung máy. */
export function desktopWide(w) {
  return !!themeSetting(w)?.desktop_wide;
}

/**
 * Màu của bộ đã chọn (`theme_setting.palette`) dựng sẵn thành `<style>` — đứng sau theme.css
 * nên khung hình đầu đã đúng màu; applyThemeSetting gỡ nó khi tự áp. Quy tắc chỉ chứa tên
 * token + bộ ba số nên chèn thẳng vào HTML an toàn. Không có bộ màu → "".
 */
export function paletteStyle(w) {
  const p = themeSetting(w)?.palette;
  const css = p && typeof p === "object" ? globalThis.cxPaletteRule(p) : "";
  return css ? `<style id="cx-palette-boot">${css}</style>` : "";
}

/** Khối chèn cuối <head>: noindex viết sẵn phía server + slug/mẫu/cờ xem lớn cho JS (`window.__CX_ROUTE`) + màu bộ đã chọn. */
export function routeHead(slug, theme, wide = false, palette = "") {
  const json = JSON.stringify(wide ? { slug, theme, wide: true } : { slug, theme }).replace(/</g, "\\u003c");
  return `
    <meta name="robots" content="noindex,nofollow" />
    <script>window.__CX_ROUTE=${json}</script>${palette}
`;
}
