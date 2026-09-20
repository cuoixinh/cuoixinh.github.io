// Nạp từng "màn" (tab) của trang quản trị từ partials/ rồi mới chèn script theo
// tab — cùng cách với invitation-setup/loader.js. Script chỉ chạy SAU khi toàn bộ
// partial đã chèn xong nên không cần DOMContentLoaded.
(function () {
  // [id thẻ mount, đường dẫn partial]
  const PARTIALS = [
    ["mount-dashboard", "partials/dashboard-panel.html"],
    ["mount-weddings", "partials/weddings-panel.html"],
    ["mount-templates", "partials/templates-panel.html"],
    ["mount-sample-images", "partials/sample-images-panel.html"],
    ["mount-asset-images", "partials/asset-images-panel.html"],
    ["mount-background", "partials/background-panel.html"],
    ["mount-promo", "partials/promo-panel.html"],
    ["mount-fonts", "partials/fonts-panel.html"],
  ];

  // Thứ tự có phụ thuộc: config (CONFIG global) → core dùng chung (ADMIN_TOKEN,
  // switchTab) → helper xử lý ảnh + utils (focal point & crop
  // ảnh) → logic riêng từng tab.
  // core/config.js KHÔNG nằm ở đây: nó được nạp riêng ở bước mồi trong boot() để
  // lấy CONFIG.version, thêm vào đây nữa là nạp hai lần.
  const SCRIPTS = [
    "../core/x-button.js",
    // <i data-icon="xuxi"> — logo AI ở các nút "nhờ AI" của Bảng điều khiển,
    // Mẫu thiệp và Dữ liệu mẫu.
    "../core/helpers/icon.js",
    "../core/auth.js", // nguồn duy nhất cho phiên đăng nhập (ai-dal đính JWT)
    "js/00-core.js",
    "../core/helpers/alert.js",
    // Nén/đo ảnh (thuần canvas) cho tab "Dữ liệu mẫu" và "Ảnh mẫu". Ảnh admin
    // ghi thẳng xuống ổ đĩa nên KHÔNG cần image-bl.js (tầng storage Supabase).
    "../core/helpers/image-helper.js",
    "../core/utils.js",
    // Picker chọn địa điểm cho 4 ô Google Maps ở tab "Dữ liệu mẫu" — đúng
    // picker của trang thiết lập thiệp. Phải đứng SAU utils.js (dùng
    // openBottomSheet/escapeHtml) và cần Leaflet đã có ở index.html.
    "../core/helpers/maps-helper.js",
    // Dùng cho tab "Dữ liệu mẫu": aiDAL (nhờ AI sinh nội dung) và
    // formatLunarDate (tự tính ngày âm từ ngày dương) — cả hai đều thuần
    // logic, không bind DOM của trang nào.
    "../core/helpers/device-id.js",
    "../core/dal/ai-dal.js",
    // templates-dal.js cache danh sách mẫu ở localStorage → cần cache-util.js
    // đứng TRƯỚC nó (buildCacheKey/getCache/setCache).
    "../core/cache-util.js",
    "../core/dal/templates-dal.js",
    "../invitation-setup/js/09-lunar.js",
    "js/01-weddings.js",
    // Ô nhập của modal "Thêm Template" (<x-input>) và các ô nhiều dòng
    // (<x-textarea>). Phải đứng TRƯỚC 02: 02-templates.js gắn
    // listener vào #template-name ngay lúc nạp, id đó chỉ nằm ở <input> con
    // sau khi <x-input> đã upgrade.
    "../core/x-input.js",
    "../core/x-controls.js",
    "js/02-templates.js",
    "js/03-sample-images.js",
    "js/04-sample-data.js",
    // Ô "Nhạc nền" của tab "Dữ liệu mẫu" dùng LẠI logic YouTube của trang thiết
    // lập thiệp. Phải đứng SAU 04: nó gọi _onDomReady và _scheduleAutoSave — bản
    // dành riêng cho admin khai báo trong 04-sample-data.js.
    "../invitation-setup/js/11-youtube.js",
    // Phải đứng SAU 03: dùng lại siIdbGet/siIdbPut + hằng SI_IDB_STORE của nó
    // để cất handle thư mục gốc (khác key, xem AX_IDB_KEY).
    "js/05-asset-images.js",
    // Phải đứng SAU 03: dùng lại siIdbGet/siIdbPut + SI_IDB_STORE, và dùng CHUNG
    // handle thư mục assets/ với tab "Ảnh mẫu" (cùng key "assets-root").
    "js/06-background.js",
    "js/07-promo.js",
    "js/08-fonts.js",
  ];

  function injectPartial(mountId, html) {
    const host = document.getElementById(mountId);
    if (!host) throw new Error("thiếu thẻ mount #" + mountId);
    host.insertAdjacentHTML("beforebegin", html);
    host.remove();
  }

  function loadScripts(srcs) {
    // async = false: tải song song nhưng THỰC THI đúng thứ tự mảng.
    return new Promise((resolve, reject) => {
      let remaining = srcs.length;
      if (!remaining) return resolve();
      srcs.forEach((src) => {
        const s = document.createElement("script");
        s.src = src;
        s.async = false;
        s.onload = () => --remaining === 0 && resolve();
        s.onerror = () => reject(new Error("không tải được " + src));
        document.body.appendChild(s);
      });
    });
  }

  function fetchText(url) {
    return fetch(url).then((r) => {
      if (!r.ok) throw new Error(url + " → HTTP " + r.status);
      return r.text();
    });
  }

  // ── Môi trường ─────────────────────────────────────────────────────────────
  // `core/config.js` chỉ chứa giá trị production; bản staging của WEB do build
  // nối `core/config.<env>.js` vào cuối nó (deploy-public.mjs --env=staging).
  // Trang admin không đi qua build đó nên tự nối lúc chạy: nạp file override
  // NGAY SAU config.js và TRƯỚC mọi script khác, nên phần còn lại của trang vẫn
  // thấy đúng MỘT `CONFIG` y như trên web. Đây là chỗ duy nhất trong mã rẽ nhánh
  // theo môi trường — chấp nhận được vì `admin/` chỉ chạy local, không nằm trong
  // bản publish; đừng bê cách này sang trang nào ra web.
  //
  // Thêm môi trường mới: tạo `core/config.<id>.js`, khai `EXCLUDE` ở
  // scripts/deploy-public.mjs, rồi thêm một mục vào đây.
  const ENV_KEY = "admin_env";
  const ENVS = [
    { id: "production", label: "Production", dot: "bg-red-500" },
    { id: "staging", label: "Staging", dot: "bg-amber-500" },
  ];

  const envById = (id) => ENVS.find((e) => e.id === id);

  // Lần đầu mở trang trên máy này thì CHẶN cho tới khi chọn: mặc định thẳng vào
  // production là mời người dùng sửa nhầm dữ liệu thật của khách.
  function askEnv() {
    return new Promise((resolve) => {
      const box = document.createElement("div");
      box.className =
        "fixed inset-0 z-[999] flex items-center justify-center bg-gray-900/60 p-4";
      box.innerHTML =
        '<div class="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">' +
        '<p class="mb-1 text-base font-semibold text-gray-800">Chọn môi trường</p>' +
        '<p class="mb-4 text-sm text-gray-500">Trang quản trị sẽ đọc và ghi dữ liệu của môi trường này. Đổi lại bất cứ lúc nào ở góc trên bên phải.</p>' +
        '<div class="flex flex-col gap-2">' +
        ENVS.map(
          (e) =>
            '<button type="button" data-env="' +
            e.id +
            '" class="flex items-center gap-2 rounded-xl px-4 py-3 text-left text-sm font-medium text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50">' +
            '<span class="h-2.5 w-2.5 rounded-full ' +
            e.dot +
            '"></span>' +
            e.label +
            "</button>",
        ).join("") +
        "</div></div>";
      box.addEventListener("click", (ev) => {
        const id = ev.target.closest("[data-env]")?.dataset.env;
        if (!id) return;
        box.remove();
        resolve(id);
      });
      document.body.appendChild(box);
    });
  }

  async function pickEnv() {
    let id = localStorage.getItem(ENV_KEY);
    if (!envById(id)) {
      id = await askEnv();
      localStorage.setItem(ENV_KEY, id);
    }
    return id;
  }

  // Dải segmented ở header (.cx-seg — chỉ cần đặt --n/--i + .is-on, xem
  // styles/_common.css). Đổi môi trường là TẢI LẠI trang: các script đã đọc
  // CONFIG rồi, vá nóng chỉ tạo ra nửa trang trỏ bên này nửa trỏ bên kia.
  function renderEnvSwitch(current) {
    const host = document.getElementById("mount-env");
    if (!host) return;
    host.className = "cx-seg shrink-0";
    host.style.setProperty("--n", ENVS.length);
    host.style.setProperty(
      "--i",
      Math.max(
        0,
        ENVS.findIndex((e) => e.id === current),
      ),
    );
    host.innerHTML = ENVS.map(
      (e) =>
        '<button type="button" data-env="' +
        e.id +
        '" class="cx-seg-btn' +
        (e.id === current ? " is-on" : "") +
        '"><span class="h-2 w-2 rounded-full ' +
        e.dot +
        '"></span>' +
        e.label +
        "</button>",
    ).join("");
    host.addEventListener("click", (ev) => {
      const id = ev.target.closest("[data-env]")?.dataset.env;
      if (!id || id === current) return;
      localStorage.setItem(ENV_KEY, id);
      location.reload();
    });
  }

  // Đóng dấu phiên bản (CONFIG.version, xem core/config.js) để đổi số ở đó là
  // ép lấy bản mới của cả bộ partial + script. Chỉ gọi được SAU bước mồi.
  // CONFIG khai bằng `const` ở core/config.js → là binding lexical toàn cục, KHÔNG
  // phải window.CONFIG. Phải đọc bằng tên trần, và bọc typeof phòng khi bước mồi
  // hỏng (thiếu nó thì trả URL trần, trang vẫn chạy chứ không chết cả loader).
  function withVersion(url) {
    const v = typeof CONFIG !== "undefined" ? CONFIG.version : "";
    if (!v) return url;
    return url + (url.includes("?") ? "&" : "?") + "v=" + encodeURIComponent(v);
  }

  async function boot() {
    // Bước mồi: config.js nạp TRẦN (không ?v=) và phải xong trước mọi thứ khác —
    // nó là nơi giữ số phiên bản dùng để đóng dấu phần còn lại.
    await loadScripts(["../core/config.js"]);

    // Chọn môi trường rồi nối file override — phải xong TRƯỚC khi nạp SCRIPTS,
    // xem phần "Môi trường" ở trên.
    const env = await pickEnv();
    if (env !== "production") {
      try {
        await loadScripts([withVersion("../core/config." + env + ".js")]);
      } catch {
        // Thiếu file override thì trang sẽ lặng lẽ chạy trên production — bỏ
        // lựa chọn để lần sau hỏi lại, và dừng hẳn thay vì đoán.
        localStorage.removeItem(ENV_KEY);
        throw new Error("không nạp được cấu hình môi trường " + env);
      }
    }
    renderEnvSwitch(env);

    const htmls = await Promise.all(
      PARTIALS.map(([, url]) => fetchText(withVersion(url))),
    );
    PARTIALS.forEach(([mountId], i) => injectPartial(mountId, htmls[i]));

    await loadScripts(SCRIPTS.map(withVersion));

    // Partial vừa chèn xong mới có [data-lucide] để quét; lucide nạp ở <head>
    // của index.html nên chắc chắn đã sẵn sàng ở đây.
    if (window.lucide) window.lucide.createIcons();

    // Khôi phục tab từ URL hash CHỈ SAU KHI mọi script theo tab đã nạp xong —
    // xem restoreTabFromHash() trong 00-core.js.
    restoreTabFromHash();
  }

  boot().catch((err) => {
    console.error("[loader] nạp trang thất bại:", err);
    document.body.insertAdjacentHTML(
      "afterbegin",
      '<div style="padding:16px;font:14px/1.5 Inter,sans-serif;color:rgb(var(--notice-text-rgb));background:rgb(var(--notice-bg-rgb));border-bottom:1px solid rgb(var(--notice-border-rgb))">' +
        "Không tải được giao diện. Vui lòng tải lại trang." +
        "</div>",
    );
  });
})();
