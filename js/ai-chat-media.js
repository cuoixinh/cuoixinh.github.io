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
    { id: "map", label: "Bản đồ", icon: "map-pin", hint: "Ghim chỉ đường để khách mời tìm tới nơi làm lễ, đãi tiệc." },
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
  const HOME_KEY = "cx_aichat_media"; // sessionStorage: nhạc/bản đồ/mẫu chọn ở trang chủ
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

  const mapEmbed = (q) =>
    "https://maps.google.com/maps?q=" + encodeURIComponent(q) + "&output=embed&hl=vi";

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
      const vuQuy = f.vu_quy_enabled === true || f.vu_quy_enabled === "true";
      const places = {};
      SIDES.forEach(([s]) => {
        const v = String(f[s + "_location"] || "").trim();
        if (v && (s !== "vu_quy" || vuQuy)) places[s] = v;
      });
      return {
        theme: st.theme || null,
        themeLocked: false,
        images: Object.fromEntries(
          [...PHOTO_SLOTS, ...QR_SLOTS].map(([field]) => [field, single(field)]),
        ),
        gallery,
        music: st.music || null,
        maps: st.maps || {},
        places,
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
      const saved = getCache(buildCacheKey("draft", id))?.gallery_images;
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
        if (sink().removeGallery) {
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

      const form = el("form", "aichat-search");
      form.hidden = true;
      const input = el("input", "aichat-search-input");
      input.type = "search";
      input.value = addr;
      input.setAttribute("aria-label", "Tìm địa điểm cho " + label);
      const go = el("button", "aichat-search-go");
      go.type = "submit";
      go.setAttribute("aria-label", "Tìm");
      go.appendChild(icon("search", 16));
      form.append(input, go);
      const res = el("div", "aichat-place-res");

      acts.addEventListener("click", (e) => {
        const act = e.target.closest("[data-act]")?.dataset.act;
        if (act === "pin") sink().setMap(side, mapEmbed(addr), addr);
        if (act !== "other") return;
        form.hidden = !form.hidden;
        if (!form.hidden) input.focus();
      });
      // Nominatim (OpenStreetMap) — cùng nguồn với bảng chọn bản đồ ở trang Thiết lập.
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const q = input.value.trim();
        if (!q) return;
        res.innerHTML = "";
        res.appendChild(el("p", "aichat-kit-sub", "Đang tìm…"));
        let found = [];
        try {
          const r = await fetch(
            `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=4&accept-language=vi`,
          );
          found = await r.json();
        } catch {
          found = [];
        }
        res.innerHTML = "";
        const choose = (embed, name) => {
          sink().setMap(side, embed, name);
          res.innerHTML = "";
          form.hidden = true;
        };
        (Array.isArray(found) ? found : []).forEach((f) => {
          const b = el("button", "aichat-place-opt");
          b.type = "button";
          b.append(icon("map-pin", 12), el("span", "", f.display_name));
          b.addEventListener("click", () =>
            choose(
              `https://maps.google.com/maps?q=${parseFloat(f.lat)},${parseFloat(f.lon)}&output=embed&hl=vi`,
              f.display_name,
            ),
          );
          res.appendChild(b);
        });
        // Nominatim hay hụt địa chỉ Việt Nam chi tiết — luôn chừa đường ghim theo chữ.
        const byText = el("button", "aichat-place-opt");
        byText.type = "button";
        byText.append(icon("type", 12), el("span", "", `Ghim theo chữ: "${q}"`));
        byText.addEventListener("click", () => choose(mapEmbed(q), q));
        res.appendChild(byText);
        paintIcons(res);
      });

      const frame = el("iframe", "aichat-place-frame");
      frame.hidden = true;
      frame.loading = "lazy";
      frame.title = "Bản đồ " + label;
      frame.referrerPolicy = "no-referrer-when-downgrade";

      row.append(head, text, acts, form, res, frame);
      paintIcons(row);
      return { row, status, frame };
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
            el("p", "aichat-kit-sub", "Chưa có địa chỉ nơi làm lễ / đãi tiệc — bạn nhắn cho XuXi địa chỉ trước nhé."),
          );
        }
        sides.forEach(([s, label]) => {
          rows[s] = buildRow(s, label, st.places[s]);
          wrap.appendChild(rows[s].row);
        });
      }
      Object.entries(rows).forEach(([s, r]) => {
        const m = st.maps[s];
        r.status.hidden = !m;
        r.frame.hidden = !m;
        if (m && r.frame.getAttribute("src") !== m.embed) r.frame.src = m.embed;
      });
    };
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
      const st = await sink().state();
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
      const st = await sink().state();
      btns.forEach(([id, b]) => b.classList.toggle("is-done", isDone(id, st)));
    };
    paintIcons(row);
    refresh();
    watch(row, refresh);
    return row;
  }

  async function summary() {
    const st = await sink().state();
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

  // Ô kế tiếp của luồng dẫn: mục đủ điều kiện mà khách chưa đi qua.
  async function next() {
    const st = await sink().state();
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
    next,
    visit,
    noteFor,
    // Trang chủ: phần không phải ảnh đi kèm thiệp sang trang Thiết lập (ảnh đã nằm
    // sẵn trong IndexedDB). Trang Thiết lập đã đổ thẳng vào form nên trả null.
    handoff() {
      if (window.cxAiMediaSink) return null;
      const st = homeStore();
      return { theme: st.theme || null, music: st.music || null, maps: st.maps || {} };
    },
    // Làm mới cuộc chat: quên luồng dẫn; ở trang chủ bỏ luôn ảnh của nháp CHƯA được mở
    // (đã mở thì ảnh thuộc về thiệp đó rồi, xoá là mất ảnh của khách).
    async reset(draftId) {
      try {
        sessionStorage.removeItem(VISIT_KEY);
        if (!window.cxAiMediaSink) sessionStorage.removeItem(HOME_KEY);
      } catch {
        /* chặn cookie: không có gì để dọn */
      }
      if (window.cxAiMediaSink || !draftId) return;
      if (typeof getCache === "function" && getCache(buildCacheKey("draft", draftId))) return;
      const recs = await idbAll(draftId);
      recs.forEach((r) => dropUrl(r.key));
      if (recs.length) await idbWrite((s) => recs.forEach((r) => s.delete(r.key))).catch(() => {});
    },
  };
})();
