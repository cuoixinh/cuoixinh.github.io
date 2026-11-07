// ============= TAB: Tạo Video Quảng Cáo =============
// Chọn mẫu + thời lượng → dev-server quay video 9:16 (scripts/promo-video.mjs, đường
// /__promo-video/*). Chỉ chạy khi admin mở qua `npm run dev`. Bản xem trước là chính
// trang sân khấu promo-video/stage.html chạy giờ thật (?play=1).

const PV_API = "/__promo-video";
let pvTemplates = [];
let pvInited = false;
let pvFocus = null; // mẫu đang xem trước
let pvJob = null; // { id, es }
let pvAudioId = null;
let pvPreviewTimer = null;

// Thiết lập của tab nhớ ở localStorage (qua F5 và lần mở sau): các ô ở PV_FIELDS, mẫu đã
// chọn, mẫu đang xem trước, nhạc nền (id tệp tạm trên dev-server — hết hạn thì lúc quay báo).
const PV_STORE_KEY = "pv_settings";
const PV_FIELDS = ["pv-duration", "pv-title", "pv-foot", "pv-show-name", "pv-music-btn", "pv-scroll", "pv-quality", "pv-fps"];
let pvSaved = null; // bản đã nạp lúc mở tab — dùng một lần cho lần vẽ lưới mẫu đầu tiên

function pvLoadSettings() {
  try {
    return JSON.parse(localStorage.getItem(PV_STORE_KEY)) || {};
  } catch (_) {
    return {};
  }
}

function pvSaveSettings() {
  if (pvSaved) return; // lưới mẫu chưa vẽ xong — lưu lúc này là xoá mất danh sách mẫu đã chọn
  const fields = {};
  PV_FIELDS.forEach((id) => {
    const el = document.getElementById(id);
    fields[id] = el.type === "checkbox" ? el.checked : el.value;
  });
  const audioName = document.getElementById("pv-audio-name").textContent;
  try {
    localStorage.setItem(
      PV_STORE_KEY,
      JSON.stringify({
        fields,
        themes: pvSelected(),
        focus: pvFocus,
        audio: pvAudioId ? { id: pvAudioId, name: audioName } : null,
      }),
    );
  } catch (_) {}
}

function pvRestoreSettings() {
  const st = pvLoadSettings();
  Object.entries(st.fields || {}).forEach(([id, v]) => {
    const el = PV_FIELDS.includes(id) && document.getElementById(id);
    if (!el) return;
    if (el.type === "checkbox") el.checked = !!v;
    else if ([...(el.options || [])].length && ![...el.options].some((o) => o.value === v)) return;
    else el.value = v;
  });
  if (st.audio?.id) {
    pvAudioId = st.audio.id;
    document.getElementById("pv-audio-name").textContent = st.audio.name || "Nhạc đã chọn";
    document.getElementById("pv-audio-clear").classList.remove("hidden");
  }
  pvSaved = st;
}

function initPromoVideoPanel() {
  if (!pvInited) {
    pvInited = true;
    const dur = document.getElementById("pv-duration");
    dur.addEventListener("input", () => {
      pvSyncDuration();
      pvSchedulePreview();
    });
    ["pv-title", "pv-foot"].forEach((id) =>
      document.getElementById(id).addEventListener("input", pvSchedulePreview),
    );
    ["pv-show-name", "pv-music-btn"].forEach((id) =>
      document.getElementById(id).addEventListener("change", pvSchedulePreview),
    );
    document.getElementById("pv-scroll").addEventListener("change", pvSchedulePreview);
    document.getElementById("pv-fps").addEventListener("change", pvSyncEstimate);
    document.getElementById("pv-quality").addEventListener("change", pvSyncEstimate);
    document.getElementById("pv-all").addEventListener("change", (e) => {
      document
        .querySelectorAll("input[name='pv-tpl']")
        .forEach((cb) => (cb.checked = e.target.checked));
      pvSyncSelection();
    });
    document.getElementById("pv-audio").addEventListener("change", pvUploadAudio);
    PV_FIELDS.forEach((id) => {
      const el = document.getElementById(id);
      el.addEventListener("input", pvSaveSettings);
      el.addEventListener("change", pvSaveSettings);
    });
    pvRestoreSettings();
    pvSyncDuration();
  }
  pvCheckServer();
  pvLoadTemplates();
}

async function pvCheckServer() {
  const warn = document.getElementById("pv-server-warn");
  try {
    const r = await fetch(`${PV_API}/status`);
    if (!r.ok) throw new Error();
    const s = await r.json();
    if (!s.ffmpeg) {
      warn.textContent =
        "Không tìm thấy ffmpeg. Chạy `npm install` ở thư mục gốc dự án (gói ffmpeg-static) rồi khởi động lại `npm run dev`.";
      warn.classList.remove("hidden");
    } else warn.classList.add("hidden");
  } catch (_) {
    warn.textContent =
      "Chức năng này cần mở admin qua `npm run dev` (http://localhost:5500/admin/). Live Server hay python -m http.server không có bộ quay video.";
    warn.classList.remove("hidden");
  }
}

async function pvLoadTemplates() {
  const box = document.getElementById("pv-templates");
  try {
    const res = await fetch(`${EDGE_URL}?resource=templates`, { headers: adminHeaders() });
    if (!res.ok) throw new Error((await res.json()).error || "Lỗi tải mẫu");
    const rows = await res.json();
    pvTemplates = (rows || [])
      .filter((t) => t.template_name)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  } catch (e) {
    box.innerHTML = `<div class="col-span-full text-center text-sm text-red-500 py-8">${escapeHtml(e.message)}</div>`;
    return;
  }
  const first = pvSaved;
  pvSaved = null;
  const keep = new Set(first ? first.themes || [] : pvSelected());
  box.innerHTML = pvTemplates
    .map(
      (t) => `
    <label class="group relative block rounded-xl border border-gray-200 overflow-hidden cursor-pointer hover:border-rose-300 has-[:checked]:border-rose-400 has-[:checked]:ring-2 has-[:checked]:ring-rose-200">
      <img src="../assets/images/templates/${escapeHtml(t.template_name)}.jpg" alt="" loading="lazy"
        class="w-full aspect-[391/722] object-cover object-top bg-gray-100" />
      <input type="checkbox" name="pv-tpl" value="${escapeHtml(t.template_name)}" ${keep.has(t.template_name) ? "checked" : ""}
        class="absolute top-2 left-2 w-4 h-4 accent-rose-500" />
      <x-button variant="overlay" size="xs" icon-only icon="eye" aria-label="Xem trước" title="Xem trước"
        class="absolute top-1 right-1" data-pv-preview="${escapeHtml(t.template_name)}"></x-button>
      <div class="px-2 py-1.5 text-xs font-medium text-gray-700 truncate">${escapeHtml(t.display_name || t.template_name)}</div>
    </label>`,
    )
    .join("");
  window.lucide?.createIcons({ root: box });
  box.querySelectorAll("input[name='pv-tpl']").forEach((cb) =>
    cb.addEventListener("change", () => {
      pvSyncSelection();
      if (cb.checked) pvPreview(cb.value);
    }),
  );
  box.querySelectorAll("[data-pv-preview]").forEach((btn) =>
    btn.addEventListener("click", (e) => {
      e.preventDefault(); // nút nằm trong <label> — đừng tick/bỏ tick ô chọn
      pvPreview(btn.dataset.pvPreview);
    }),
  );
  pvSyncSelection();
  if (first?.focus && pvTemplates.some((t) => t.template_name === first.focus)) pvPreview(first.focus);
  pvSaveSettings();
}

function pvSelected() {
  return [...document.querySelectorAll("input[name='pv-tpl']:checked")].map((cb) => cb.value);
}

function pvSyncSelection() {
  const n = pvSelected().length;
  const all = document.querySelectorAll("input[name='pv-tpl']").length;
  document.getElementById("pv-count").textContent = n ? `(đã chọn ${n})` : "";
  const allCb = document.getElementById("pv-all");
  allCb.checked = all > 0 && n === all;
  allCb.indeterminate = n > 0 && n < all;
  document.getElementById("pv-start").disabled = !n || !!pvJob;
  pvSyncEstimate();
  pvSaveSettings();
}

function pvSyncDuration() {
  const v = document.getElementById("pv-duration").value;
  document.getElementById("pv-duration-label").textContent = `${v} giây`;
  pvSyncEstimate();
}

// Ước chừng thời gian chụp + mã hoá mỗi khung 1080×1920 (tuỳ máy): bản cao chụp PNG
// và mã hoá kỹ nên chậm hơn bản nháp.
function pvSyncEstimate() {
  const n = pvSelected().length;
  const el = document.getElementById("pv-estimate");
  if (!n) return (el.textContent = "");
  const frames = Number(document.getElementById("pv-duration").value) * Number(document.getElementById("pv-fps").value);
  const perFrame = document.getElementById("pv-quality").value === "draft" ? 0.3 : 0.5;
  const min = Math.max(1, Math.round((n * (frames * perFrame + 10)) / 60));
  el.textContent = `${n} video · ước chừng ${min} phút`;
}

function pvOpts() {
  const showName = document.getElementById("pv-show-name").checked;
  const subs = {};
  pvTemplates.forEach((t) => (subs[t.template_name] = showName ? t.display_name || "" : ""));
  return {
    duration: Number(document.getElementById("pv-duration").value),
    fps: Number(document.getElementById("pv-fps").value),
    quality: document.getElementById("pv-quality").value,
    title: document.getElementById("pv-title").value.trim(),
    foot: document.getElementById("pv-foot").value.trim(),
    music: document.getElementById("pv-music-btn").checked,
    scroll: document.getElementById("pv-scroll").value,
    subs,
  };
}

function pvSchedulePreview() {
  clearTimeout(pvPreviewTimer);
  if (pvFocus) pvPreviewTimer = setTimeout(() => pvPreview(pvFocus), 500);
}

function pvPreview(theme) {
  pvFocus = theme;
  const o = pvOpts();
  const q = new URLSearchParams({
    theme,
    dur: String(o.duration),
    title: o.title,
    sub: o.subs[theme] ?? "",
    foot: o.foot,
    music: o.music ? "1" : "0",
    scroll: o.scroll,
    play: "1",
  });
  document.getElementById("pv-preview").src = `promo-video/stage.html?${q}`;
  document.getElementById("pv-preview-empty").classList.add("hidden");
  pvSaveSettings();
}

async function pvUploadAudio(e) {
  const file = e.target.files?.[0];
  e.target.value = "";
  if (!file) return;
  const label = document.getElementById("pv-audio-name");
  label.textContent = "Đang tải lên…";
  try {
    const r = await fetch(`${PV_API}/audio`, { method: "POST", body: file });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || "Không tải được nhạc");
    pvAudioId = d.id;
    label.textContent = file.name;
    document.getElementById("pv-audio-clear").classList.remove("hidden");
    pvSaveSettings();
  } catch (err) {
    pvClearAudio();
    showToast(err.message, "error");
  }
}

function pvClearAudio() {
  pvAudioId = null;
  document.getElementById("pv-audio-name").textContent = "Không có — video câm";
  document.getElementById("pv-audio-clear").classList.add("hidden");
  pvSaveSettings();
}

function pvSetBusy(busy) {
  document.getElementById("pv-cancel").classList.toggle("hidden", !busy);
  document.getElementById("pv-start").disabled = busy || !pvSelected().length;
}

async function pvStart() {
  const themes = pvSelected();
  if (!themes.length || pvJob) return;
  const body = { ...pvOpts(), themes, audio: pvAudioId };
  let id;
  try {
    const r = await fetch(`${PV_API}/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || "Không bắt đầu được");
    id = d.id;
  } catch (e) {
    showAlert(
      "Không bắt đầu được",
      e instanceof TypeError ? "Không gọi được bộ quay — admin phải mở qua `npm run dev`." : e.message,
    );
    return;
  }

  const names = Object.fromEntries(pvTemplates.map((t) => [t.template_name, t.display_name || t.template_name]));
  const list = document.getElementById("pv-results");
  list.innerHTML = themes
    .map(
      (t) => `
    <div class="space-y-2" data-pv-row="${escapeHtml(t)}">
      <div class="relative aspect-[9/16] rounded-xl bg-gray-100 overflow-hidden flex items-center justify-center">
        <span class="pv-row-state text-xs text-gray-400 px-3 text-center">Đang chờ…</span>
      </div>
      <div class="text-xs font-medium text-gray-700 truncate">${escapeHtml(names[t] || t)}</div>
      <div class="h-1.5 rounded-full bg-gray-100 overflow-hidden"><div class="pv-row-bar h-full w-0 bg-rose-400 transition-all"></div></div>
    </div>`,
    )
    .join("");
  document.getElementById("pv-results-card").classList.remove("hidden");
  const status = document.getElementById("pv-results-status");
  status.textContent = "Đang quay…";

  const es = new EventSource(`${PV_API}/events?id=${encodeURIComponent(id)}`);
  pvJob = { id, es };
  pvSetBusy(true);
  let ok = 0;
  const row = (t) => list.querySelector(`[data-pv-row="${CSS.escape(t)}"]`);

  es.onmessage = (ev) => {
    const d = JSON.parse(ev.data);
    const r = d.theme ? row(d.theme) : null;
    if (d.type === "log") status.textContent = d.message;
    else if (d.type === "start" && r) {
      r.querySelector(".pv-row-state").textContent = "Đang chuẩn bị thiệp…";
      status.textContent = `Đang quay ${names[d.theme] || d.theme}…`;
    } else if (d.type === "progress" && r) {
      const pct = Math.round((d.frame / d.total) * 100);
      r.querySelector(".pv-row-bar").style.width = pct + "%";
      r.querySelector(".pv-row-state").textContent = `${pct}%`;
    } else if (d.type === "done" && r) {
      ok++;
      r.querySelector(".pv-row-bar").style.width = "100%";
      const box = r.firstElementChild;
      box.innerHTML = `<video src="${d.url}" controls playsinline preload="metadata" class="w-full h-full object-cover bg-black"></video>`;
      const a = document.createElement("a");
      a.href = d.url;
      a.download = d.file.split("/").pop();
      a.className = "inline-flex items-center gap-1 text-xs font-medium text-rose-600 hover:underline";
      a.innerHTML = '<i data-lucide="download" style="width:14px;height:14px"></i> Tải về';
      r.appendChild(a);
      window.lucide?.createIcons({ root: r });
    } else if (d.type === "error") {
      if (r) {
        r.querySelector(".pv-row-state").textContent = d.message;
        r.querySelector(".pv-row-state").className = "pv-row-state text-xs text-red-500 px-3 text-center";
      } else status.textContent = "❌ " + d.message;
    } else if (d.type === "end") {
      if (!status.textContent.startsWith("❌"))
        status.textContent = `Xong ${ok}/${themes.length} video — lưu ở .promo-videos/`;
      pvFinish();
    }
  };
  es.onerror = () => {
    status.textContent = "❌ Mất kết nối với bộ quay (npm run dev đã tắt?)";
    pvFinish();
  };
}

function pvFinish() {
  pvJob?.es.close();
  pvJob = null;
  pvSetBusy(false);
}

async function pvCancel() {
  if (!pvJob) return;
  await fetch(`${PV_API}/cancel?id=${encodeURIComponent(pvJob.id)}`, { method: "POST" }).catch(() => {});
}
