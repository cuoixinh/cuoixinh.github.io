// Trang "Mẫu Slide": danh sách mẫu slide, mỗi mẫu một video YouTube khung ngang + nút "Gửi Messenger".
// Trình phát YouTube nạp SẴN (iframe lazy, dưới lớp ảnh bìa + nút Phát chỉ để nhìn) để cú bấm đầu
// tiên rơi thẳng vào trình phát → phát ngay CÓ TIẾNG: điện thoại chặn video nhúng tự phát có tiếng,
// chèn iframe sau cú bấm là khách phải bấm lần hai. Cùng lúc một video phát. Chỉ liệt kê mẫu ĐÃ có
// mã video (`youtube` ở tao-slide/templates.js).
// `?mau=<id>` trên URL (link trong lời nhắn) cuộn tới đúng mẫu đó.

// Cùng link "Nhắn tin qua Messenger" ở chân trang chủ — đổi page thì đổi cả hai.
const MS_MESSENGER = "https://m.me/61591515875537";

const _msEsc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
// Mã video 11 ký tự của YouTube — chặn chuỗi lạ lọt vào URL nhúng.
const _msYt = (id) => (/^[\w-]{11}$/.test(String(id || "")) ? id : "");
const _msTpls = () => (window.CX_SLIDE_TEMPLATES || []).filter((t) => _msYt(t.youtube));

function _msItem(t, i) {
  const yt = _msYt(t.youtube);
  // Ảnh bìa nét (maxres, chỉ có khi video gốc ≥ 720p) — thiếu thì _msPosterFix lùi về hqdefault.
  return `<article class="ms-item" id="mau-${_msEsc(t.id)}">
      <div class="ms-video">
        <iframe class="ms-frame" src="${_msEmbed(yt)}" title="Video ${_msEsc(t.name)}" loading="lazy"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>
        <img class="ms-poster" src="https://i.ytimg.com/vi/${yt}/maxresdefault.jpg" data-yt="${yt}" alt="" ${i ? 'fetchpriority="high"' : 'loading="lazy"'} />
        <span class="ms-play" aria-hidden="true"><span class="ms-play-ic"><i data-lucide="play"></i></span></span>
      </div>
      <div class="ms-cap">
        <div class="ms-text">
          <h2 class="ms-name">${_msEsc(t.name)}</h2>
          <p class="ms-desc">${_msEsc(t.desc)}</p>
        </div>
        <x-button variant="bare" class="ms-msg ms-send" data-id="${_msEsc(t.id)}">
          <i data-icon="messenger" data-size="14"></i>Gửi Messenger
        </x-button>
      </div>
    </article>`;
}

function _msRender() {
  const list = document.getElementById("ms-list");
  const tpls = _msTpls();
  list.innerHTML = tpls.length
    ? tpls.map(_msItem).join("")
    : `<p class="ms-empty">Video mẫu đang được cập nhật. Bạn có thể nhắn Cưới Xinh qua Messenger để xem trước.</p>`;
  list.querySelectorAll("img.ms-poster").forEach(_msPosterFix);
  window.lucide?.createIcons({ root: list });
  window.cxRenderIcons?.(list);
  const want = new URLSearchParams(location.search).get("mau");
  if (want) document.getElementById(`mau-${want}`)?.scrollIntoView({ block: "center" });
}

// Video không có bản maxres: YouTube trả ảnh xám 120×90 (hoặc lỗi) — đổi sang hqdefault (luôn có;
// viền đen trên dưới của nó bị object-fit: cover cắt mất).
function _msPosterFix(img) {
  const low = () => {
    if (!img.src.includes("hqdefault")) img.src = `https://i.ytimg.com/vi/${img.dataset.yt}/hqdefault.jpg`;
  };
  img.addEventListener("error", low, { once: true });
  img.addEventListener("load", () => img.naturalWidth <= 120 && low());
}

// ── Trình phát: ảnh bìa + nút Phát nằm TRÊN iframe nhưng không bắt chuột (pointer-events: none),
// cú bấm xuyên xuống trình phát YouTube. Video bắt đầu chạy thì gỡ lớp bìa (.is-on) và dừng video
// đang phát ở mẫu khác — biết qua IFrame API (enablejsapi), dự phòng bằng sự kiện blur của cửa sổ
// (bấm vào iframe là trang mất focus) khi API chưa/không nạp được.
const _msEmbed = (yt) =>
  `https://www.youtube-nocookie.com/embed/${yt}?enablejsapi=1&rel=0&playsinline=1&origin=${encodeURIComponent(location.origin)}`;
const _msPlayers = [];
const _msOn = (frame) => frame?.closest(".ms-video")?.classList.add("is-on");

function _msBindPlayers() {
  document.querySelectorAll("iframe.ms-frame").forEach((frame) => {
    const p = new YT.Player(frame, {
      events: {
        onStateChange: (e) => {
          if (e.data !== YT.PlayerState.PLAYING && e.data !== YT.PlayerState.BUFFERING) return;
          _msOn(frame);
          _msPlayers.forEach((o) => o !== p && o.pauseVideo?.());
        },
      },
    });
    _msPlayers.push(p);
  });
}

function _msLoadApi() {
  if (!document.querySelector("iframe.ms-frame")) return;
  const prev = window.onYouTubeIframeAPIReady;
  window.onYouTubeIframeAPIReady = () => {
    prev?.();
    _msBindPlayers();
  };
  const s = document.createElement("script");
  s.src = "https://www.youtube.com/iframe_api";
  s.async = true;
  document.head.appendChild(s);
}

window.addEventListener("blur", () => {
  const f = document.activeElement;
  if (f?.classList?.contains("ms-frame")) _msOn(f);
});

async function _msCopy(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    // Trình duyệt trong Zalo/Facebook hay chặn clipboard API — lùi về cách chép cũ.
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.cssText = "position:fixed;opacity:0;top:0;left:0";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch (e2) {}
    ta.remove();
    return ok;
  }
}

// ── Hộp "Gửi Messenger": link m.me không điền sẵn được lời nhắn, nên chép sẵn lời nhắn (tên
// mẫu + link tới đúng mẫu) rồi mở hộp cho khách xem, bấm "Mở Messenger" sang khung chat và dán.
const _msDlg = document.getElementById("ms-dlg");
let _msText = "";

function _msNote(ok) {
  document.getElementById("ms-dlg-note").textContent = ok
    ? "Lời nhắn dưới đây đã được chép. Bấm “Mở Messenger”, rồi dán vào khung chat để gửi cho Cưới Xinh."
    : "Hãy chép lời nhắn dưới đây, bấm “Mở Messenger”, rồi dán vào khung chat để gửi cho Cưới Xinh.";
}

async function _msCopyNow() {
  const ok = await _msCopy(_msText);
  if (ok) window.showToast?.("Đã copy nội dung", "success", "copy");
  _msNote(ok);
  return ok;
}

function _msAsk(id) {
  const t = _msTpls().find((x) => x.id === id);
  if (!t) return;
  const link = `${location.origin}/mau-slide/?mau=${encodeURIComponent(t.id)}`;
  _msText = `Chào Cưới Xinh, mình muốn làm slide cưới theo ${t.name}.\n${link}`;
  document.getElementById("ms-dlg-msg").textContent = _msText;
  document.getElementById("ms-dlg-go").href = MS_MESSENGER;
  _msNote(true);
  _msDlg.showModal();
  _msToastIn(true);
  _msCopyNow();
}

// <dialog> mở dạng modal nằm ở lớp trên cùng, che cả toast của trang — lúc mở dời khối toast
// (#cx-toast, do alert.js dựng ở <body>) vào trong hộp, đóng thì trả về.
function _msToastIn(on) {
  const t = document.getElementById("cx-toast");
  if (t) (on ? _msDlg : document.body).appendChild(t);
}
_msDlg.addEventListener("close", () => _msToastIn(false));

document.getElementById("ms-list").addEventListener("click", (e) => {
  const send = e.target.closest(".ms-send");
  if (send) _msAsk(send.dataset.id);
});

// Uỷ quyền trên chính <dialog>: các <x-button> trong hộp tự thay mình bằng <button> mới lúc DOM
// sẵn sàng, gắn listener thẳng vào chúng là mất.
const _msClose = () => _msDlg.close();
_msDlg.addEventListener("click", (e) => {
  if (e.target === _msDlg) return _msClose(); // bấm vùng nền mờ ngoài hộp
  if (e.target.closest("#ms-dlg-x, #ms-dlg-later")) return _msClose();
  if (e.target.closest("#ms-dlg-copy")) return _msCopyNow();
  // Mở Messenger: để link tự mở tab/ứng dụng, đóng hộp ngay sau đó.
  if (e.target.closest("#ms-dlg-go")) setTimeout(_msClose, 0);
});

_msRender();
_msLoadApi();
