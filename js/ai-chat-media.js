// Ô chọn mẫu thiệp / ảnh / album / nhạc / bản đồ / QR NGAY TRONG khung chat XuXi
// (js/ai-assistant.js dựng khung, file này dựng ruột). Khoá loại ở KINDS phải khớp
// ASK_KINDS của supabase/functions/ai-chat/index.ts. Nạp TRƯỚC js/ai-assistant.js.
// Hai đích ghi: trang Thiết lập khai window.cxAiMediaSink (24-ai-apply.js) để đổ thẳng
// vào thiệp đang mở; trang chủ dùng homeSink — ảnh vào IndexedDB đúng khoá của 02-idb.js.

(function () {
  const KINDS = [
    { id: "theme", label: "Mẫu thiệp", icon: "layout-template", hint: "Chọn một mẫu — trước khi thanh toán đổi lại lúc nào cũng được." },
    { id: "photos", label: "Ảnh cưới", icon: "image", hint: "Ảnh bìa và ảnh chân dung chú rể, cô dâu." },
    { id: "gallery", label: "Album", icon: "images", hint: "Tối đa 10 ảnh cho album cưới, chọn nhiều ảnh một lúc được." },
    { id: "music", label: "Nhạc nền", icon: "music", hint: "Tìm bài trên YouTube, hoặc dán thẳng link bài hát." },
    { id: "map", label: "Bản đồ", icon: "map-pin", hint: "Ghim chỉ đường để khách mời tìm tới nơi làm lễ, tổ chức tiệc." },
    { id: "qr", label: "QR mừng cưới", icon: "qr-code", hint: "Ảnh mã QR tài khoản ngân hàng hai bên cho hộp mừng cưới." },
  ];
  const KIND = Object.fromEntries(KINDS.map((k) => [k.id, k]));

  const SIDES = [
    ["ceremony", "Lễ cưới"],
    ["vu_quy", "Lễ Vu Quy"],
    ["groom_party", "Tiệc nhà trai"],
    ["bride_party", "Tiệc nhà gái"],
  ];
  // [tên field ảnh trên form, khoá gửi server, nhãn]
  const PHOTO_SLOTS = [
    ["cover_image_url", "cover", "Ảnh bìa"],
    ["groom_image_url", "groom", "Chú rể"],
    ["bride_image_url", "bride", "Cô dâu"],
  ];
  const QR_SLOTS = [
    ["groom_qr_url", "groom", "Nhà trai"],
    ["bride_qr_url", "bride", "Nhà gái"],
  ];
  const GALLERY_MAX = 10; // khớp MAX_GALLERY_IMAGES của invitation-setup/js/10-images.js
  const MUSIC_DEFAULT_Q = "nhạc đám cưới hay nhất";

  const VISIT_KEY = "cx_aichat_visited"; // sessionStorage: ô đã đi qua trong luồng dẫn
  // sessionStorage: nhạc/bản đồ/mẫu chọn ở trang chủ + gương URL ảnh đã lên thiệp (saved)
  const HOME_KEY = "cx_aichat_media";
  // Phát trên window mỗi khi thiệp đổi ảnh/nhạc/bản đồ/mẫu — ô chọn và dải chip vẽ lại
  // theo nó. 10-images.js (_imagesChanged) cũng phát, vì ảnh ở trang Thiết lập còn đổi
  // từ form chứ không chỉ từ khung chat.
  const CHANGE = "cx-media-change";

  let ctx = { draftId: () => undefined, known: () => null };

  const emit = () => window.dispatchEvent(new CustomEvent(CHANGE));

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function icon(name, size) {
    const i = document.createElement("i");
    i.setAttribute("data-lucide", name);
    i.style.width = i.style.height = (size || 16) + "px";
    return i;
  }

  const paintIcons = (root) => window.lucide?.createIcons({ root });

  // <x-button> tự thay mình bằng <button> thật khi gắn vào DOM → bắt click bằng uỷ
  // nhiệm theo data-act ở khung ô chọn, đừng gắn listener lên thẻ này.
  function xbtn(label, act, variant) {
    const b = document.createElement("x-button");
    b.setAttribute("variant", variant || "fill");
    b.setAttribute("size", "sm");
    b.setAttribute("data-act", act);
    b.textContent = label;
    return b;
  }

  // Mọi thứ về bản đồ đi qua core/helpers/maps-helper.js (link nhúng cxMapEmbed, bảng chọn
  // openMapPicker) — trang Thiết lập nạp sẵn, trang chủ nạp lúc khách bấm lần đầu. Riêng bảng
  // chọn cần thêm Leaflet + core/utils.js; utils.js đi CHUNG promise với image-pick.js
  // (window.__cxUtilsReq) — nạp hai lần là `const` cấp cao nhất khai trùng.
  const LEAFLET_JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
  const LEAFLET_SRI = "sha384-cxOPjt7s7Iz04uaHJceBmS+qpjv2JkIHNVcuOrM+YHwZOmJGBXI00mdUXEq65HTH";
  const LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
  let helperReq = null;
  let pickerReq = null;

  function loadScript(src, integrity) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      if (integrity) {
        s.integrity = integrity;
        s.crossOrigin = "anonymous";
      }
      s.onload = resolve;
      s.onerror = () => reject(new Error("không tải được " + src));
      document.head.appendChild(s);
    });
  }

  const ver = () => (typeof CONFIG !== "undefined" && CONFIG.version ? "?v=" + CONFIG.version : "");

  // Chỉ maps-helper.js (nhẹ) — đủ cho cxMapEmbed. Hỏng (mạng) thì cho bấm lại: script chưa
  // chạy nên nạp lại không khai trùng gì.
  function ensureMapsHelper() {
    if (typeof window.cxMapEmbed === "function") return Promise.resolve();
    helperReq =
      helperReq ||
      loadScript("/core/helpers/maps-helper.js" + ver()).catch((e) => {
        helperReq = null;
        throw e;
      });
    return helperReq;
  }

  // <x-check> (ô "Trùng địa điểm") ở core/x-controls.js — trang Thiết lập nạp sẵn, trang
  // chủ thì chưa. Thẻ chèn trước khi định nghĩa xong vẫn tự nâng cấp khi file chạy.
  let xControlsReq = null;
  function ensureXControls() {
    if (customElements.get("x-check")) return Promise.resolve();
    xControlsReq =
      xControlsReq ||
      loadScript("/core/x-controls.js" + ver()).catch((e) => {
        xControlsReq = null;
        throw e;
      });
    return xControlsReq;
  }

  // Cả bảng chọn: maps-helper.js + Leaflet + core/utils.js (openBottomSheet, escapeHtml).
  function ensureMapPicker() {
    if (typeof window.openMapPicker === "function" && window.L && typeof openBottomSheet === "function")
      return Promise.resolve();
    if (pickerReq) return pickerReq;
    const jobs = [ensureMapsHelper()];
    if (!window.L) {
      if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
        const css = document.createElement("link");
        css.rel = "stylesheet";
        css.href = LEAFLET_CSS;
        document.head.appendChild(css);
      }
      jobs.push(loadScript(LEAFLET_JS, LEAFLET_SRI));
    }
    if (typeof openBottomSheet !== "function") {
      window.__cxUtilsReq = window.__cxUtilsReq || loadScript("/core/utils.js" + ver());
      jobs.push(window.__cxUtilsReq);
    }
    pickerReq = Promise.all(jobs).catch((e) => {
      pickerReq = null;
      if (typeof openBottomSheet !== "function") window.__cxUtilsReq = null;
      throw e;
    });
    return pickerReq;
  }

  function ytId(url) {
    const m = String(url || "").match(
      /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([\w-]{6,})/,
    );
    return m ? m[1] : null;
  }

  // ── Trang chủ: IndexedDB dưới mã nháp của cuộc chat ───────────────────────
  // DB/store/khoá/shape bản ghi CHÉP ĐÚNG invitation-setup/js/02-idb.js: mở thiệp là
  // _idbRestoreAll nhặt ảnh lên như ảnh khách tự chọn mà chưa lưu. Đổi bên đó thì đổi đây.

  const IDB_NAME = "cuoixinh_pending";
  const IDB_STORE = "uploads";
  let _db = null;

  function idb() {
    if (_db) return Promise.resolve(_db);
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(IDB_STORE))
          db.createObjectStore(IDB_STORE, { keyPath: "key" });
      };
      req.onsuccess = (e) => resolve((_db = e.target.result));
      req.onerror = (e) => reject(e.target.error);
    });
  }

  async function idbAll(id) {
    try {
      const db = await idb();
      const all = await new Promise((res, rej) => {
        const req = db.transaction(IDB_STORE, "readonly").objectStore(IDB_STORE).getAll();
        req.onsuccess = (e) => res(e.target.result || []);
        req.onerror = (e) => rej(e.target.error);
      });
      return all.filter((r) => r.weddingId === id);
    } catch {
      return [];
    }
  }

  async function idbWrite(fn) {
    const db = await idb();
    await new Promise((res, rej) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      fn(tx.objectStore(IDB_STORE));
      tx.oncomplete = res;
      tx.onerror = (e) => rej(e.target.error);
    });
  }

  const _urls = new Map(); // khoá IDB → objectURL (thu hồi khi ảnh bị thay)
  function fileUrl(key, file) {
    if (!_urls.has(key)) _urls.set(key, URL.createObjectURL(file));
    return _urls.get(key);
  }
  function dropUrl(key) {
    const u = _urls.get(key);
    if (u) URL.revokeObjectURL(u);
    _urls.delete(key);
  }

  function homeStore() {
    try {
      return JSON.parse(sessionStorage.getItem(HOME_KEY) || "{}") || {};
    } catch {
      return {};
    }
  }
  function homeSave(patch) {
    try {
      sessionStorage.setItem(HOME_KEY, JSON.stringify({ ...homeStore(), ...patch }));
    } catch {
      /* chặn cookie: chọn vẫn chạy trong phiên, chỉ không sống qua F5 */
    }
  }

  // ── Gương ẢNH ĐÃ LÊN THIỆP ────────────────────────────────────────────────
  // Ảnh chọn ở khung chat trang chủ là ảnh CHỜ trong IndexedDB; tới lúc khách lưu nháp
  // hay xuất bản thì trang Thiết lập upload rồi xoá bản ghi chờ — trang chủ soi IndexedDB
  // thấy trống trong khi thiệp vẫn đủ ảnh, ô chọn hiện lại thành trắng trơn. Nên mỗi lần
  // đọc trạng thái Ở TRANG THIẾT LẬP ta chép URL ảnh thật (chỉ http, bỏ blob: của ảnh còn
  // chờ) kèm mã thiệp vào HOME_KEY; trang chủ bù từ đây. Ảnh bù là ảnh của thiệp rồi nên
  // KHÔNG cho xoá ở khung chat (mountGallery không vẽ nút x cho item.saved).
  const isHttp = (u) => /^https?:/i.test(String(u || ""));

  // Trang Thiết lập: thiệp đang mở (WEDDING_ID) mới là chủ của ảnh, mã nháp của cuộc chat
  // có thể là thiệp khác (khách mở thiệp cũ rồi chat tiếp).
  const sinkWeddingId = () =>
    (typeof WEDDING_ID !== "undefined" && WEDDING_ID) || ctx.draftId();

  function rememberSaved(st) {
    const id = sinkWeddingId();
    if (!id) return;
    const images = {};
    Object.entries(st.images || {}).forEach(([f, u]) => {
      if (isHttp(u)) images[f] = u;
    });
    const gallery = (st.gallery || []).map((g) => g.url).filter(isHttp);
    const cur = homeStore().saved;
    const same =
      cur &&
      cur.id === id &&
      JSON.stringify([cur.images, cur.gallery]) === JSON.stringify([images, gallery]);
    if (!same) homeSave({ saved: { id, images, gallery } });
  }

  const savedFor = (id) => {
    const sv = homeStore().saved;
    return id && sv && sv.id === id ? sv : null;
  };

  // Mọi nơi đọc trạng thái đi qua đây: trang Thiết lập ghi gương, trang chủ đọc gương
  // (trong homeSink.state).
  async function readState() {
    const st = await sink().state();
    if (window.cxAiMediaSink) rememberSaved(st);
    return st;
  }

  // Bản xem trước khối Hộp mừng cưới trong bảng cắt QR — như _qrGiftInfo (10-images.js)
  // nhưng đọc thông tin XuXi đã thu thay vì form. Field khác QR → null.
  function giftInfo(field) {
    const side = QR_SLOTS.find(([f]) => f === field)?.[1];
    if (!side) return null;
    const f = ctx.known()?.fields || {};
    const name = String(f[`${side}_name`] || "");
    return {
      label: (side === "groom" ? "Chú Rể" : "Cô Dâu") + (name ? ` · ${name}` : ""),
      bankName: String(f[`${side}_bank_name`] || ""),
      bankNumber: String(f[`${side}_bank_number`] || ""),
      bankOwner: String(f[`${side}_bank_owner`] || ""),
    };
  }

  // Địa điểm đã có địa chỉ ở trang chủ — lấy từ thông tin XuXi đã thu.
  function homePlaces() {
    const f = ctx.known()?.fields || {};
    const vuQuy = f.vu_quy_enabled === true || f.vu_quy_enabled === "true";
    const places = {};
    SIDES.forEach(([s]) => {
      const v = String(f[s + "_location"] || "").trim();
      if (v && (s !== "vu_quy" || vuQuy)) places[s] = v;
    });
    return places;
  }

  const homeSink = {
    async state() {
      const id = ctx.draftId();
      const recs = id ? await idbAll(id) : [];
      const single = (f) => {
        const r = recs.find((x) => x.type === "single" && x.fieldName === f);
        return r ? fileUrl(r.key, r.file) : "";
      };
      const gallery = recs
        .filter((r) => r.type === "gallery")
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .map((r) => ({ url: fileUrl(r.key, r.file), key: r.key }));
      const st = homeStore();
      const f = ctx.known()?.fields || {};
      const places = homePlaces();
      const images = Object.fromEntries(
        [...PHOTO_SLOTS, ...QR_SLOTS].map(([field]) => [field, single(field)]),
      );
      // Ảnh đã lên thiệp: chỉ bù vào ô còn TRỐNG — bản ghi chờ trong IndexedDB là ảnh
      // khách vừa chọn, luôn mới hơn.
      const sv = savedFor(id);
      if (sv) {
        Object.entries(sv.images || {}).forEach(([f, u]) => {
          if (f in images && !images[f]) images[f] = u;
        });
        gallery.unshift(...(sv.gallery || []).map((u) => ({ url: u, saved: true })));
      }
      return {
        theme: st.theme || null,
        themeLocked: false,
        images,
        gallery,
        music: st.music || null,
        maps: st.maps || {},
        places,
        same: st.same || {},
        hasBank: !!(f.groom_bank_number || f.bride_bank_number),
      };
    },

    // Cùng đường với form (CXImagePick): bảng lấy nét / cắt QR / nén, rồi ghi bản ghi IDB
    // y như _storePickedImage + _idbSaveSingle của trang Thiết lập.
    async setImage(field, file) {
      const id = ctx.draftId();
      if (!id) return;
      const key = `${id}_s_${field}`;
      const cur = (await idbAll(id)).find((r) => r.key === key);
      const picked = await CXImagePick.single(field, file, {
        focal: cur?.focalPoint,
        giftInfo: giftInfo(field),
      });
      if (!picked) return;
      dropUrl(key);
      await idbWrite((s) => {
        s.put({
          key,
          type: "single",
          fieldName: field,
          weddingId: id,
          file: picked.file,
          focalPoint: picked.focal || cur?.focalPoint || { x: 50, y: 50 },
        });
        s.delete(`${id}_sf_${field}`); // bản ghi chỉ-lấy-nét của ảnh cũ
      });
      emit();
    },

    async addGallery(files) {
      const id = ctx.draftId();
      if (!id) return;
      // Trần tính cả ảnh đã lưu trong nháp lẫn ảnh đang chờ, như handleGalleryUpload.
      // Nháp còn trên máy thì đọc cache; nháp đã lên tài khoản (cache bị xoá) thì đọc gương.
      const saved =
        getCache(buildCacheKey("draft", id))?.gallery_images || savedFor(id)?.gallery;
      const have =
        (await idbAll(id)).filter((r) => r.type === "gallery").length +
        (Array.isArray(saved) ? saved.length : 0);
      await CXImagePick.gallery(
        files,
        GALLERY_MAX - have,
        (file, focal) => {
          const now = Date.now();
          return idbWrite((s) =>
            s.put({
              key: `${id}_g_${now}_${Math.random().toString(36).slice(2, 7)}`,
              type: "gallery",
              weddingId: id,
              file,
              focalPoint: focal,
              order: now,
            }),
          );
        },
        GALLERY_MAX,
      );
      emit();
    },

    async removeGallery(item) {
      dropUrl(item.key);
      await idbWrite((s) => s.delete(item.key));
      emit();
    },

    setMusic(url, title) {
      homeSave({ music: { url, title } });
      emit();
    },

    setMap(side, embed, name) {
      homeSave({ maps: { ...(homeStore().maps || {}), [side]: { embed, name } } });
      emit();
    },

    // Tiệc "trùng địa điểm" với lễ (xem partySource). Chưa bấm lần nào thì ô chọn tự
    // đoán theo địa chỉ (sameGuess), nên chỉ lưu khi khách tự đổi.
    setSame(side, on) {
      homeSave({ same: { ...(homeStore().same || {}), [side]: on } });
      emit();
    },

    setTheme(theme, name) {
      homeSave({ theme: { theme, name } });
      emit();
    },
  };

  const sink = () => window.cxAiMediaSink || homeSink;

  // ── Trạng thái ────────────────────────────────────────────────────────────

  const hasPhotos = (st, slots) => slots.filter(([f]) => st.images[f]);

  function isDone(kind, st) {
    if (kind === "theme") return !!st.theme;
    if (kind === "photos") return hasPhotos(st, PHOTO_SLOTS).length > 0;
    if (kind === "gallery") return st.gallery.length > 0;
    if (kind === "music") return !!st.music?.url;
    if (kind === "map") return Object.keys(st.maps).length > 0;
    if (kind === "qr") return hasPhotos(st, QR_SLOTS).length > 0;
    return false;
  }

  // Bản đồ cần địa chỉ, QR cần thông tin ngân hàng — thiếu thì luồng dẫn bỏ qua.
  function isEligible(kind, st) {
    if (kind === "map") return Object.keys(st.places).length > 0;
    if (kind === "qr") return st.hasBank;
    return true;
  }

  function visited() {
    try {
      return JSON.parse(sessionStorage.getItem(VISIT_KEY) || "[]");
    } catch {
      return [];
    }
  }

  function visit(kind) {
    const v = visited();
    if (v.includes(kind)) return;
    v.push(kind);
    try {
      sessionStorage.setItem(VISIT_KEY, JSON.stringify(v));
    } catch {
      /* chặn cookie: luồng dẫn có thể mời lại một ô, không hại gì */
    }
  }

  // Câu "Đã …" chèn vào hội thoại sau khi khách bấm Tiếp tục / Bỏ qua ở một ô —
  // model đọc được việc vừa làm (MEDIA_RULES mục 5).
  function noteFor(kind, st, done) {
    const k = KIND[kind];
    if (!done) return `(Bỏ qua ${k.label.toLowerCase()})`;
    const names = (slots) => hasPhotos(st, slots).map((s) => s[2].toLowerCase()).join(", ");
    if (kind === "theme") return `(Đã chọn mẫu ${st.theme.name || st.theme.theme})`;
    if (kind === "photos") return `(Đã thêm ảnh: ${names(PHOTO_SLOTS)})`;
    if (kind === "gallery") return `(Đã thêm ${st.gallery.length} ảnh vào album)`;
    if (kind === "music") return `(Đã chọn nhạc nền: ${st.music.title || "bài từ YouTube"})`;
    if (kind === "map")
      return `(Đã ghim bản đồ: ${SIDES.filter(([s]) => st.maps[s]).map((s) => s[1].toLowerCase()).join(", ")})`;
    return `(Đã thêm mã QR: ${names(QR_SLOTS)})`;
  }

  // ── Ruột từng ô chọn ──────────────────────────────────────────────────────
  // Mỗi loại: mount(body) dựng khung MỘT lần, trả update(st) để vẽ lại theo trạng
  // thái — giữ nguyên thứ khách đang gõ dở (ô tìm nhạc, ô tìm địa điểm).

  function tileGrid(slots, cols) {
    return (body) => {
      const grid = el("div", "aichat-tiles");
      grid.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
      const tiles = slots.map(([field, , label]) => {
        const tile = el("label", "aichat-tile");
        const img = el("img");
        img.alt = label;
        const add = el("span", "aichat-tile-add");
        add.appendChild(icon("plus", 20));
        const input = el("input");
        input.type = "file";
        input.accept = "image/*";
        input.hidden = true;
        input.addEventListener("change", async () => {
          const file = input.files[0];
          input.value = "";
          if (!file) return;
          tile.classList.add("is-busy");
          try {
            await sink().setImage(field, file);
          } finally {
            tile.classList.remove("is-busy");
          }
        });
        tile.append(img, add, el("span", "aichat-tile-cap", label), input);
        grid.appendChild(tile);
        return { tile, img, field };
      });
      body.appendChild(grid);
      return (st) =>
        tiles.forEach(({ tile, img, field }) => {
          const url = st.images[field];
          tile.classList.toggle("has-img", !!url);
          if (url && img.getAttribute("src") !== url) img.src = url;
        });
    };
  }

  function mountGallery(body) {
    const grid = el("div", "aichat-gal");
    const count = el("p", "aichat-kit-sub");
    const add = el("label", "aichat-tile aichat-gal-add");
    const plus = el("span", "aichat-tile-add");
    plus.appendChild(icon("plus", 20));
    const input = el("input");
    input.type = "file";
    input.accept = "image/*";
    input.multiple = true;
    input.hidden = true;
    input.addEventListener("change", async () => {
      const files = Array.from(input.files);
      input.value = "";
      if (!files.length) return;
      add.classList.add("is-busy");
      try {
        await sink().addGallery(files);
      } finally {
        add.classList.remove("is-busy");
      }
    });
    add.append(plus, input);
    body.append(grid, count);

    return (st) => {
      grid.innerHTML = "";
      st.gallery.forEach((item) => {
        const cell = el("div", "aichat-gal-item");
        const img = el("img");
        img.src = item.url;
        img.alt = "";
        cell.appendChild(img);
        // Ảnh đã lên thiệp (bù từ gương) không có bản ghi nào để xoá — muốn bỏ thì
        // vào trang Thiết lập.
        if (sink().removeGallery && !item.saved) {
          const x = el("button", "aichat-gal-x");
          x.type = "button";
          x.setAttribute("aria-label", "Bỏ ảnh này");
          x.appendChild(icon("x", 12));
          x.addEventListener("click", () => sink().removeGallery(item));
          cell.appendChild(x);
        }
        grid.appendChild(cell);
      });
      if (st.gallery.length < GALLERY_MAX) grid.appendChild(add);
      count.textContent = `${st.gallery.length}/${GALLERY_MAX} ảnh`;
      paintIcons(grid);
    };
  }

  function mountTheme(body) {
    const note = el("p", "aichat-kit-sub");
    note.hidden = true;
    const list = el("div", "aichat-themes");
    list.appendChild(el("p", "aichat-kit-sub", "Đang tải danh sách mẫu…"));
    body.append(note, list);
    let current = "";
    let locked = false;

    const mark = () =>
      list.querySelectorAll("[data-theme]").forEach((b) => {
        b.classList.toggle("is-on", b.dataset.theme === current);
        b.disabled = locked && b.dataset.theme !== current;
      });

    (window.templatesDAL?.list() || Promise.reject())
      .then((rows) => {
        list.innerHTML = "";
        rows.forEach((t) => {
          const b = el("button", "aichat-theme");
          b.type = "button";
          b.dataset.theme = t.theme;
          const img = el("img");
          img.loading = "lazy";
          img.alt = t.name;
          img.src = t.thumbnailUrl || `/assets/images/templates/${t.theme}.jpg`;
          const price = Number.isFinite(t.price)
            ? Number(t.price).toLocaleString("vi-VN") + "đ"
            : "Liên hệ";
          b.append(img, el("span", "aichat-theme-name", t.name), el("span", "aichat-theme-price", price));
          b.addEventListener("click", () => {
            if (locked || t.theme === current) return;
            sink().setTheme(t.theme, t.name);
          });
          list.appendChild(b);
        });
        mark();
        // Tự đặt scrollLeft: scrollIntoView cuộn lây cả khung chat lẫn trang phía sau.
        const on = list.querySelector(".is-on");
        if (on) list.scrollLeft = on.offsetLeft - (list.clientWidth - on.offsetWidth) / 2;
      })
      .catch(() => {
        list.innerHTML = "";
        list.appendChild(el("p", "aichat-kit-sub", "Chưa tải được danh sách mẫu, bạn thử lại sau nhé."));
      });

    return (st) => {
      current = st.theme?.theme || "";
      locked = !!st.themeLocked;
      note.hidden = !locked;
      note.textContent = "Thiệp đã thanh toán nên mẫu đã được chốt, không đổi được nữa.";
      mark();
    };
  }

  function mountMusic(body) {
    const cur = el("div", "aichat-yt-cur");
    cur.hidden = true;
    const form = el("form", "aichat-search");
    const input = el("input", "aichat-search-input");
    input.type = "search";
    input.placeholder = "Tên bài hát hoặc link YouTube…";
    input.setAttribute("aria-label", "Tìm nhạc nền");
    const go = el("button", "aichat-search-go");
    go.type = "submit";
    go.setAttribute("aria-label", "Tìm");
    go.appendChild(icon("search", 16));
    form.append(input, go);
    const list = el("div", "aichat-yt");
    body.append(cur, form, list);
    let currentUrl = "";

    const mark = () =>
      list.querySelectorAll("[data-url]").forEach((b) => b.classList.toggle("is-on", b.dataset.url === currentUrl));

    async function pickUrl(url, title) {
      if (!title) {
        try {
          const r = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
          title = r.ok ? (await r.json()).title || "" : "";
        } catch {
          title = "";
        }
      }
      sink().setMusic(url, title);
    }

    async function search(q) {
      list.innerHTML = "";
      list.appendChild(el("p", "aichat-kit-sub", "Đang tìm…"));
      try {
        const res = await fetch(
          `${CONFIG.supabase.edgeUrl}?resource=youtube-search&q=${encodeURIComponent(q)}`,
          { headers: { Authorization: `Bearer ${CONFIG.supabase.anonKey}` } },
        );
        const items = await res.json();
        list.innerHTML = "";
        if (!Array.isArray(items) || !items.length) {
          list.appendChild(el("p", "aichat-kit-sub", "Không tìm thấy bài nào, bạn thử tên khác nhé."));
          return;
        }
        items.forEach((it) => {
          const b = el("button", "aichat-yt-item");
          b.type = "button";
          b.dataset.url = it.url;
          const img = el("img");
          img.loading = "lazy";
          img.alt = "";
          if (/^https:\/\//.test(it.thumbnail || "")) img.src = it.thumbnail;
          const txt = el("span", "aichat-yt-txt");
          txt.append(
            el("span", "aichat-yt-title", it.title || ""),
            el("span", "aichat-yt-meta", [it.channel, it.duration].filter(Boolean).join(" · ")),
          );
          b.append(img, txt);
          b.addEventListener("click", () => pickUrl(it.url, it.title));
          list.appendChild(b);
        });
        mark();
      } catch {
        list.innerHTML = "";
        list.appendChild(el("p", "aichat-kit-sub", "Lỗi tìm kiếm, bạn thử lại nhé."));
      }
    }

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const q = input.value.trim();
      if (!q) return;
      const id = ytId(q);
      if (id) pickUrl(`https://www.youtube.com/watch?v=${id}`, "");
      else if (q.length >= 2) search(q);
    });
    search(MUSIC_DEFAULT_Q);

    return (st) => {
      currentUrl = st.music?.url || "";
      cur.hidden = !currentUrl;
      cur.textContent = "";
      if (currentUrl) {
        cur.append(icon("music", 14), el("span", "", "Đang chọn: " + (st.music.title || currentUrl)));
        paintIcons(cur);
      }
      mark();
    };
  }

  function mountMap(body) {
    const wrap = el("div", "aichat-places");
    body.appendChild(wrap);
    let sidesKey = null;
    let lastMaps = {};
    const rows = {};

    function buildRow(side, label, addr) {
      const row = el("div", "aichat-place");
      const head = el("div", "aichat-place-head");
      const status = el("span", "aichat-place-ok");
      status.append(icon("check", 12), el("span", "", "Đã ghim"));
      head.append(el("span", "aichat-place-label", label), status);
      const text = el("p", "aichat-place-addr", addr);
      const acts = el("div", "aichat-place-acts");
      acts.append(xbtn("Ghim theo địa chỉ này", "pin", "soft"), xbtn("Chọn vị trí khác", "other", "ghost"));

      // Cả hai nút đi qua maps-helper.js như form Thiết lập: "Ghim theo địa chỉ này" dựng
      // link bằng cxMapEmbed; "Chọn vị trí khác" mở ĐÚNG bảng chọn openMapPicker (kéo ghim,
      // gợi ý lúc gõ, sửa tên hiển thị) — chưa ghim thì tìm sẵn địa chỉ đã có.
      acts.addEventListener("click", async (e) => {
        const act = e.target.closest("[data-act]")?.dataset.act;
        if (act !== "pin" && act !== "other") return;
        try {
          await (act === "pin" ? ensureMapsHelper() : ensureMapPicker());
        } catch {
          window.showToast?.("Chưa mở được bản đồ, bạn thử lại giúp mình nhé.", "error");
          return;
        }
        if (act === "pin") return void sink().setMap(side, window.cxMapEmbed(addr), addr);
        const cur = lastMaps[side];
        window.openMapPicker(side, {
          embed: cur?.embed || "",
          name: cur?.name || "",
          query: cur ? "" : addr,
          onApply: (embed, name) => sink().setMap(side, embed, name),
        });
      });

      const frame = el("iframe", "aichat-place-frame");
      frame.hidden = true;
      frame.loading = "lazy";
      frame.title = "Bản đồ " + label;
      frame.referrerPolicy = "no-referrer-when-downgrade";

      // Tiệc: ô "Trùng địa điểm …" như form Thiết lập — bật thì dùng luôn bản đồ của lễ,
      // khỏi ghim lại. Nhãn nguồn điền lúc vẽ (vu quy có thể bật/tắt giữa chừng).
      // `key` riêng cho khung chat: x-check dựng id `${key}-btn`, trùng key của ô trên form
      // Thiết lập là hai phần tử cùng id.
      let same = null;
      if (PARTY_SIDES.includes(side)) {
        same = el("div", "aichat-place-same");
        const check = document.createElement("x-check");
        check.setAttribute("key", `aichat-${side}-same-${++sameSeq}`);
        check.addEventListener("change", () => sink().setSame?.(side, check.checked));
        same.appendChild(check);
        ensureXControls().catch(() => {});
      }

      row.append(head, ...(same ? [same] : []), text, acts, frame);
      paintIcons(row);
      return { row, status, frame, text, acts, same, addr };
    }

    return (st) => {
      const sides = SIDES.filter(([s]) => st.places[s]);
      const key = sides.map(([s]) => s + "=" + st.places[s]).join("|");
      if (key !== sidesKey) {
        sidesKey = key;
        wrap.innerHTML = "";
        Object.keys(rows).forEach((k) => delete rows[k]);
        if (!sides.length) {
          wrap.appendChild(
            el("p", "aichat-kit-sub", "Chưa có địa chỉ nhà trai / nhà gái — bạn nhắn cho XuXi địa chỉ trước nhé."),
          );
        }
        sides.forEach(([s, label]) => {
          rows[s] = buildRow(s, label, st.places[s]);
          wrap.appendChild(rows[s].row);
        });
      }
      lastMaps = st.maps || {};
      Object.entries(rows).forEach(([s, r]) => {
        const src = partySource(s, st);
        const linked = !!src && isSame(s, src, st);
        if (r.same) {
          r.same.hidden = !src;
          setCheck(r.same.firstChild, linked, "Trùng địa điểm " + sideLabel(src).toLowerCase());
        }
        r.acts.hidden = linked;
        // Trùng địa điểm: chép bản đồ của lễ sang tiệc mỗi khi lễ đổi. So trước khi ghi
        // để không lặp vô tận (setMap phát lại sự kiện đổi → vẽ lại lần nữa).
        const srcMap = linked ? st.maps[src] : null;
        if (srcMap && st.maps[s]?.embed !== srcMap.embed) sink().setMap(s, srcMap.embed, srcMap.name);
        const m = linked ? srcMap : st.maps[s];
        // Đã ghim thì hiện tên nơi đã ghim (có thể khác địa chỉ khách khai), như form Thiết lập.
        r.text.textContent = m?.name || (linked ? st.places[src] : r.addr);
        r.status.hidden = !m;
        r.frame.hidden = !m;
        if (m && r.frame.getAttribute("src") !== m.embed) r.frame.src = m.embed;
      });
    };
  }

  // Nguồn "trùng địa điểm" của tiệc — cùng luật togglePartySameLoc (16-ceremony.js): nhà
  // trai theo lễ cưới; nhà gái theo vu quy khi có, không thì lễ cưới.
  const PARTY_SIDES = ["groom_party", "bride_party"];
  function partySource(side, st) {
    if (side === "groom_party") return st.places.ceremony ? "ceremony" : "";
    if (side === "bride_party") return st.places.vu_quy ? "vu_quy" : st.places.ceremony ? "ceremony" : "";
    return "";
  }

  const sideLabel = (s) => SIDES.find(([k]) => k === s)?.[1] || "";

  // Ô "Trùng địa điểm" của từng tiệc đúng như khung chat đang hiện. Chỉ tiệc có nguồn VÀ
  // (khách đã bấm hoặc tiệc đã có địa chỉ) — còn lại để form tự đặt mặc định.
  function partySame(st) {
    const out = {};
    PARTY_SIDES.forEach((s) => {
      const src = partySource(s, st);
      if (src && (typeof st.same?.[s] === "boolean" || st.places[s])) out[s] = isSame(s, src, st);
    });
    return out;
  }

  let sameSeq = 0;

  // Đặt trạng thái + nhãn cho một <x-check>. Chưa nâng cấp (x-controls.js đang nạp) thì
  // ghi vào attribute — connectedCallback dựng nút từ đó; đã nâng cấp thì ghi thẳng.
  function setCheck(x, on, label) {
    // Giữ attribute khớp luôn: x-check dựng lại nút từ attribute mỗi lần gắn vào DOM.
    x.setAttribute("label", label);
    x.toggleAttribute("checked", on);
    const btn = x.querySelector("button");
    if (!btn) return;
    btn.lastElementChild.textContent = label;
    if (x.checked !== on) x.checked = on;
  }

  // Khách đã chọn thì theo khách; chưa thì đoán: hai địa chỉ trùng chữ là cùng một nơi.
  const normAddr = (v) =>
    String(v || "").toLowerCase().replace(/[\s,.]+/g, " ").trim();
  function isSame(side, src, st) {
    const v = st.same?.[side];
    return typeof v === "boolean" ? v : normAddr(st.places[side]) === normAddr(st.places[src]);
  }

  const MOUNT = {
    theme: mountTheme,
    photos: tileGrid(PHOTO_SLOTS, 3),
    gallery: mountGallery,
    music: mountMusic,
    map: mountMap,
    qr: tileGrid(QR_SLOTS, 2),
  };

  // Theo dõi CHANGE cho tới khi phần tử rời DOM (Làm mới xoá sạch khung chat).
  function watch(node, fn) {
    const h = () => {
      if (!node.isConnected) return window.removeEventListener(CHANGE, h);
      fn();
    };
    window.addEventListener(CHANGE, h);
  }

  // Một ô chọn hoàn chỉnh. opts.onNext(kind, done): có thì vẽ nút Tiếp tục / Bỏ qua
  // (ô của luồng dẫn); không có là ô khách tự mở, không cần nút.
  function widget(kind, opts = {}) {
    const k = KIND[kind];
    const box = el("div", "aichat-kit");
    const head = el("div", "aichat-kit-head");
    head.append(icon(k.icon, 16), el("span", "aichat-kit-title", k.label));
    const body = el("div", "aichat-kit-body");
    box.append(head, el("p", "aichat-kit-hint", k.hint), body);

    let foot = null;
    let last = null;
    if (opts.onNext) {
      foot = el("div", "aichat-kit-foot");
      box.appendChild(foot);
      foot.addEventListener("click", (e) => {
        if (!e.target.closest("[data-act]") || !last || box.classList.contains("is-past")) return;
        box.classList.add("is-past");
        opts.onNext(kind, isDone(kind, last), last);
      });
    }

    const update = MOUNT[kind](body);
    const refresh = async () => {
      const st = await readState();
      last = st;
      update(st);
      if (foot) {
        const done = isDone(kind, st);
        if (foot.dataset.done !== String(done)) {
          foot.dataset.done = String(done);
          foot.innerHTML = "";
          foot.appendChild(done ? xbtn("Tiếp tục", "next") : xbtn("Bỏ qua", "skip", "ghost"));
        }
      }
    };
    paintIcons(box);
    refresh();
    watch(box, refresh);
    return box;
  }

  // Dải chip sáu mục, đánh dấu ✓ mục đã có. Dùng ở thẻ thiệp và ở nút "+" của ô nhập.
  function chips(onOpen) {
    const row = el("div", "aichat-kchips");
    const btns = KINDS.map((k) => {
      const b = el("button", "aichat-kchip");
      b.type = "button";
      b.append(icon(k.icon, 14), el("span", "", k.label));
      b.addEventListener("click", () => onOpen(k.id));
      row.appendChild(b);
      return [k.id, b];
    });
    const refresh = async () => {
      const st = await readState();
      btns.forEach(([id, b]) => b.classList.toggle("is-done", isDone(id, st)));
    };
    paintIcons(row);
    refresh();
    watch(row, refresh);
    return row;
  }

  async function summary() {
    const st = await readState();
    return {
      theme: st.theme?.name || st.theme?.theme || "",
      photos: hasPhotos(st, PHOTO_SLOTS).map((s) => s[1]),
      gallery: st.gallery.length,
      music: st.music?.url ? st.music.title || "bài từ YouTube" : "",
      maps: SIDES.filter(([s]) => st.maps[s]).map((s) => s[0]),
      qr: hasPhotos(st, QR_SLOTS).map((s) => s[1]),
      places: Object.keys(st.places),
    };
  }

  // Độ dài chuyện tình mẫu đang chọn khai ở CX_THEME.loveStory — server viết mốc dài ngắn
  // theo đó. Chưa chọn mẫu / không khai / đọc lỗi → "" (server dùng mặc định).
  async function storyLen() {
    const st = await readState().catch(() => null);
    const theme = st?.theme?.theme;
    if (!theme || !window.cxReadThemeDecl) return "";
    const v = (await window.cxReadThemeDecl(theme))?.loveStory;
    return typeof v === "string" ? v : "";
  }

  // Ô kế tiếp của luồng dẫn: mục đủ điều kiện mà khách chưa đi qua.
  async function next() {
    const st = await readState();
    const v = visited();
    return KINDS.map((k) => k.id).find((id) => !v.includes(id) && isEligible(id, st)) || null;
  }

  window.CXChatMedia = {
    kinds: KINDS,
    isKind: (id) => !!KIND[id],
    label: (id) => KIND[id]?.label || "",
    init(c) {
      ctx = { ...ctx, ...c };
    },
    widget,
    chips,
    summary,
    storyLen,
    // Trạng thái đầy đủ (URL ảnh xem được) + theo dõi thay đổi — bảng tóm tắt thiệp
    // ở js/ai-assistant.js vẽ ảnh từ đây.
    state: readState,
    watch,
    sides: SIDES,
    next,
    visit,
    noteFor,
    // Trang chủ: phần không phải ảnh đi kèm thiệp sang trang Thiết lập (ảnh đã nằm
    // sẵn trong IndexedDB). Trang Thiết lập đã đổ thẳng vào form nên trả null.
    partySame,
    handoff() {
      if (window.cxAiMediaSink) return null;
      const st = homeStore();
      homeSave({ handedTo: ctx.draftId() }); // reset() nhận ra nháp đã được mở
      return {
        theme: st.theme || null,
        music: st.music || null,
        maps: st.maps || {},
        same: partySame({ same: st.same || {}, places: homePlaces() }),
      };
    },
    // Làm mới cuộc chat: quên luồng dẫn; ở trang chủ bỏ luôn ảnh của nháp CHƯA được mở.
    // Đã mở thì ảnh thuộc về thiệp đó — kể cả khi nháp đã lên tài khoản (bản local bị
    // xoá) mà còn ảnh đẩy hỏng nằm chờ lần lưu sau — xoá là mất ảnh của khách.
    async reset(draftId) {
      const handed = !!draftId && homeStore().handedTo === draftId;
      try {
        sessionStorage.removeItem(VISIT_KEY);
        if (!window.cxAiMediaSink) sessionStorage.removeItem(HOME_KEY);
      } catch {
        /* chặn cookie: không có gì để dọn */
      }
      if (window.cxAiMediaSink || !draftId || handed) return;
      if (typeof getCache === "function" && getCache(buildCacheKey("draft", draftId))) return;
      const recs = await idbAll(draftId);
      recs.forEach((r) => dropUrl(r.key));
      if (recs.length) await idbWrite((s) => recs.forEach((r) => s.delete(r.key))).catch(() => {});
    },
  };
})();
