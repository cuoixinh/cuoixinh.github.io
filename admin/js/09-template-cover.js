// Nút "Tạo ảnh bìa" ở tab Templates: ghép ảnh chụp màn đầu của các mẫu
// (assets/images/templates/<tên>.jpg — màn bìa, mẫu không bìa thì là hero, do
// Scan Image IFrame chụp) thành một lưới xếp dọc từng cột (trên→dưới) rồi sang phải, cho tải về.
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
 * Chọn số hàng + bề ngang ô. Xếp theo CỘT; cột cuối chỉ còn MỘT mẫu thì ô đó
 * phủ hết các hàng và rộng theo cùng tỉ lệ (`span` ô). `gap` là px thật của ảnh
 * xuất ra, dùng cho cả khe giữa các ô lẫn lề ngoài.
 */
function coverLayout(n, aspect, size, rowsWanted, gap) {
  const fits = (rows) => {
    const rest = n % rows;
    const span = rows > 1 && rest === 1 ? rows : 0;
    // Số cột tính theo bề ngang một ô thường (ô phóng to chiếm `span` cột).
    const cols = span ? (n - 1) / rows + span : Math.ceil(n / rows);
    let tw = COVER_TILE_W;
    let W, H;
    if (size === "auto") {
      W = tw * cols + (cols + 1) * gap;
      H = tw * rows * aspect + (rows + 1) * gap;
    } else {
      [W, H] = size.split("x").map(Number);
      tw = Math.min(
        (W - (cols + 1) * gap) / cols,
        (H - (rows + 1) * gap) / (rows * aspect),
      );
    }
    return { rows, cols, rest, span, tw, W, H };
  };

  if (rowsWanted > 0) return fits(Math.min(rowsWanted, n));

  let best = null;
  for (let r = 1; r <= n; r++) {
    const l = fits(r);
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
  const gap = val("cover-gap");
  document.getElementById("cover-border-val").textContent = borderPct + "%";
  document.getElementById("cover-radius-val").textContent = radiusPct + "%";
  document.getElementById("cover-gap-val").textContent = gap + "px";

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
  const L = coverLayout(n, aspect, size, Math.floor(val("cover-rows")), gap);

  canvas.width = Math.round(L.W);
  canvas.height = Math.round(L.H);
  ctx.fillStyle = document.getElementById("cover-bg").value;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const tw = L.tw;
  const th = tw * aspect;
  const g = gap;
  const border = (tw * borderPct) / 100;
  const radius = (tw * radiusPct) / 100;
  const shadow = document.getElementById("cover-shadow").checked;

  // Cả lưới canh giữa khung. Cột cuối thiếu ô (mà không phóng to) thì canh giữa
  // theo chiều dọc.
  const gridW = L.cols * tw + (L.cols - 1) * g;
  const gridH = L.rows * th + (L.rows - 1) * g;
  const x0 = (L.W - gridW) / 2;
  const y0 = (L.H - gridH) / 2;
  const lastCol = Math.floor((n - 1) / L.rows);

  coverItems.forEach(({ img }, i) => {
    const col = Math.floor(i / L.rows);
    const row = i % L.rows;
    let x = x0 + col * (tw + g);
    let y = y0 + row * (th + g);
    let w = tw;
    let h = th;
    if (L.span && i === n - 1) {
      w = L.span * tw + (L.span - 1) * g;
      h = gridH;
    } else if (L.rest && col === lastCol) {
      y += ((L.rows - L.rest) * (th + g)) / 2;
    }

    // Tấm nền trắng = viền; bóng đổ đặt lên chính tấm này cho mềm.
    ctx.save();
    if (shadow) {
      ctx.shadowColor = "rgba(0, 0, 0, 0.18)";
      ctx.shadowBlur = tw * 0.08;
      ctx.shadowOffsetY = tw * 0.025;
    }
    ctx.fillStyle = "#ffffff";
    coverRoundRect(ctx, x, y, w, h, radius);
    ctx.fill();
    ctx.restore();

    // Ảnh lọt trong viền, bo góc trong = bo góc ngoài trừ bề dày viền.
    ctx.save();
    coverRoundRect(
      ctx,
      x + border,
      y + border,
      w - border * 2,
      h - border * 2,
      Math.max(0, radius - border),
    );
    ctx.clip();
    coverDrawImage(ctx, img, x + border, y + border, w - border * 2, h - border * 2);
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
