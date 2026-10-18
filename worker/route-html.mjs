/**
 * Dựng trang thiệp ngay tại link `/<slug>` (rewrite, không chuyển hướng): lấy
 * index.html của mẫu, đổi đường dẫn tương đối thành tuyệt đối, chèn slug + noindex.
 * Dùng chung cho worker/index.js (HTMLRewriter) và scripts/dev-server.mjs (regex) —
 * sửa luật ở đây là cả hai bên theo; sửa cách áp ở một bên thì sửa cả bên kia.
 */

// Tên thư mục mẫu do khách sửa được qua API → chỉ nhận dạng slug thư mục.
export const THEME_NAME = /^[a-z0-9][a-z0-9-]*$/;

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

/** Chủ thiệp bật "xem lớn trên máy tính" (`theme_setting.desktop_wide`) — khi đó theme-boot.js không dựng khung máy. */
export function desktopWide(w) {
  let ts = w && w.theme_setting;
  if (typeof ts === "string") {
    try {
      ts = JSON.parse(ts);
    } catch (_) {
      ts = null;
    }
  }
  return !!(ts && ts.desktop_wide);
}

/** Khối chèn cuối <head>: noindex viết sẵn phía server + slug/mẫu/cờ xem lớn cho JS (`window.__CX_ROUTE`). */
export function routeHead(slug, theme, wide = false) {
  const json = JSON.stringify(wide ? { slug, theme, wide: true } : { slug, theme }).replace(/</g, "\\u003c");
  return `
    <meta name="robots" content="noindex,nofollow" />
    <script>window.__CX_ROUTE=${json}</script>
`;
}
