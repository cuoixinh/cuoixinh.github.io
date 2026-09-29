// Nút "Tạo ảnh bìa" ở tab Templates: ghép ảnh chụp màn đầu của các mẫu
// (assets/images/templates/<tên>.jpg — màn bìa, mẫu không bìa thì là hero, do
// Scan Image IFrame chụp) thành một lưới trái→phải, trên→dưới rồi cho tải về.
// Danh sách mẫu lấy từ window.adminTemplates (02-templates.js) lúc chạy.

// Bề ngang một ô ở khổ "Tự do" — gần bề ngang ảnh chụp (390px × 2) cho khỏi vỡ.
const COVER_TILE_W = 600;
// Khổ "Tự do" tự chọn số cột để cả ảnh gần tỉ lệ này (ngang/dọc).
const COVER_FREE_RATIO = 16 / 9;

let coverItems = []; // [{ name, img }] đúng thứ tự ghép

function openCoverMaker() {
  const m = document.getElementById("modal-cover");
  m.classList.remove("hidden");
  m.classList.add("flex");
  loadCoverImages();
}

function closeCoverMaker() {
  const m = document.getElementById("modal-cover");
  m.classList.add("hidden");
  m.classList.remove("flex");
}

// Có tick ở bảng thì chỉ lấy mẫu đã tick, không thì lấy hết; xếp theo sort_order.
function coverTemplates() {
  const ticked = new Set(
    [...document.querySelectorAll("input[name='tpl-scan']:checked")].map(
      (cb) => cb.value,
    ),
  );
  return (window.adminTemplates || [])
    .filter((t) => !ticked.size || ticked.has(t.template_name))
    .map((t, i) => ({ t, i }))
    .sort((a, b) => (a.t.sort_order ?? 0) - (b.t.sort_order ?? 0) || a.i - b.i)
    .map(({ t }) => t);
}

function coverLoadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function loadCoverImages() {
  const status = document.getElementById("cover-status");
  const list = coverTemplates();
  coverItems = [];

  if (!list.length) {
    status.textContent =
      "Chưa có mẫu nào trong danh sách — đợi bảng Templates tải xong rồi thử lại.";
    renderCover();
    return;
  }

  status.textContent = `Đang tải ảnh của ${list.length} mẫu…`;
  // ?t= để lấy đúng bản vừa scan, không phải bản trình duyệt đã cache.
  const stamp = Date.now();
  const imgs = await Promise.all(
    list.map((t) =>
      coverLoadImage(
        `../assets/images/templates/${encodeURIComponent(t.template_name)}.jpg?t=${stamp}`,
      ),
    ),
  );

  const missing = [];
  list.forEach((t, i) => {
    if (imgs[i]) coverItems.push({ name: t.template_name, img: imgs[i] });
    else missing.push(t.template_name);
  });

  status.textContent =
    `Đã ghép ${coverItems.length}/${list.length} mẫu.` +
    (missing.length
      ? ` Thiếu ảnh chụp: ${missing.join(", ")} — tick chúng rồi bấm Scan Image IFrame.`
      : "");
  renderCover();
}

/**
 * Chọn số cột + bề ngang ô. Mọi khoảng (lề, khe) tính theo tỉ lệ `gap` của bề
 * ngang ô nên cùng một bộ số trông giống nhau ở mọi khổ ảnh.
 */
function coverLayout(n, aspect, size, colsWanted, gap) {
  const fits = (cols) => {
    const rows = Math.ceil(n / cols);
    if (size === "auto") {
      const w = COVER_TILE_W * (cols + (cols + 1) * gap);
      const h = COVER_TILE_W * (rows * aspect + (rows + 1) * gap);
      return { cols, rows, tw: COVER_TILE_W, W: w, H: h };
    }
    const [W, H] = size.split("x").map(Number);
    const tw = Math.min(
      W / (cols + (cols + 1) * gap),
      H / (rows * aspect + (rows + 1) * gap),
    );
    return { cols, rows, tw, W, H };
  };

  if (colsWanted > 0) return fits(Math.min(colsWanted, n));

  let best = null;
  for (let c = 1; c <= n; c++) {
    const l = fits(c);
    // Khổ cố định: ô to nhất. Khổ tự do: cả ảnh gần COVER_FREE_RATIO nhất.
    const score =
      size === "auto" ? -Math.abs(Math.log(l.W / l.H / COVER_FREE_RATIO)) : l.tw;
    if (!best || score > best.score) best = { ...l, score };
  }
  return best;
}

function coverRoundRect(ctx, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

// Vẽ ảnh kiểu object-fit: cover vào khung (x, y, w, h).
function coverDrawImage(ctx, img, x, y, w, h) {
  const s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const sw = w / s;
  const sh = h / s;
  ctx.drawImage(
    img,
    (img.naturalWidth - sw) / 2,
    (img.naturalHeight - sh) / 2,
    sw,
    sh,
    x,
    y,
    w,
    h,
  );
}

function renderCover() {
  const canvas = document.getElementById("cover-canvas");
  const ctx = canvas.getContext("2d");
  const val = (id) => parseFloat(document.getElementById(id).value) || 0;

  const borderPct = val("cover-border");
  const radiusPct = val("cover-radius");
  const gapPct = val("cover-gap");
  document.getElementById("cover-border-val").textContent = borderPct + "%";
  document.getElementById("cover-radius-val").textContent = radiusPct + "%";
  document.getElementById("cover-gap-val").textContent = gapPct + "%";

  const size = document.getElementById("cover-size").value;
  const n = coverItems.length;
  if (!n) {
    canvas.width = 320;
    canvas.height = 180;
    ctx.fillStyle = document.getElementById("cover-bg").value;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    return;
  }

  const first = coverItems[0].img;
  const aspect = first.naturalHeight / first.naturalWidth || 16 / 9;
  const gap = gapPct / 100;
  const L = coverLayout(n, aspect, size, Math.floor(val("cover-cols")), gap);

  canvas.width = Math.round(L.W);
  canvas.height = Math.round(L.H);
  ctx.fillStyle = document.getElementById("cover-bg").value;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const tw = L.tw;
  const th = tw * aspect;
  const g = tw * gap;
  const border = (tw * borderPct) / 100;
  const radius = (tw * radiusPct) / 100;
  const shadow = document.getElementById("cover-shadow").checked;

  // Cả lưới canh giữa khung; hàng cuối thiếu ô thì canh giữa theo số ô của nó.
  const gridH = L.rows * th + (L.rows - 1) * g;
  const y0 = (L.H - gridH) / 2;

  coverItems.forEach(({ img }, i) => {
    const row = Math.floor(i / L.cols);
    const inRow = Math.min(L.cols, n - row * L.cols);
    const rowW = inRow * tw + (inRow - 1) * g;
    const x = (L.W - rowW) / 2 + (i % L.cols) * (tw + g);
    const y = y0 + row * (th + g);

    // Tấm nền trắng = viền; bóng đổ đặt lên chính tấm này cho mềm.
    ctx.save();
    if (shadow) {
      ctx.shadowColor = "rgba(0, 0, 0, 0.18)";
      ctx.shadowBlur = tw * 0.08;
      ctx.shadowOffsetY = tw * 0.025;
    }
    ctx.fillStyle = "#ffffff";
    coverRoundRect(ctx, x, y, tw, th, radius);
    ctx.fill();
    ctx.restore();

    // Ảnh lọt trong viền, bo góc trong = bo góc ngoài trừ bề dày viền.
    ctx.save();
    coverRoundRect(
      ctx,
      x + border,
      y + border,
      tw - border * 2,
      th - border * 2,
      Math.max(0, radius - border),
    );
    ctx.clip();
    coverDrawImage(ctx, img, x + border, y + border, tw - border * 2, th - border * 2);
    ctx.restore();
  });
}

function downloadCover(fmt) {
  if (!coverItems.length) {
    showToast("Chưa có ảnh nào để ghép", "error");
    return;
  }
  const canvas = document.getElementById("cover-canvas");
  const type = fmt === "png" ? "image/png" : "image/jpeg";
  canvas.toBlob(
    (blob) => {
      if (!blob) return showToast("Không xuất được ảnh", "error");
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `cuoixinh-cover-${canvas.width}x${canvas.height}.${fmt}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    },
    type,
    0.92,
  );
}
