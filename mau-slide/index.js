// Trang "Mẫu Slide": danh sách mẫu slide, mỗi mẫu một video YouTube khung ngang + nút "Gửi Messenger".
// Video nạp kiểu "mặt tiền": chỉ có ảnh bìa, bấm Phát mới chèn trình phát (~1 MB mã mỗi cái), cùng
// lúc một video phát. Mẫu chưa có mã video thì hiện ảnh chụp mẫu kèm nhãn "Video sắp có".
// `?mau=<id>` trên URL (link trong lời nhắn) cuộn tới đúng mẫu đó.

// Cùng link "Nhắn tin qua Messenger" ở chân trang chủ — đổi page thì đổi cả hai.
const MS_MESSENGER = "https://m.me/61591515875537";

const _msEsc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
// Mã video 11 ký tự của YouTube — chặn chuỗi lạ lọt vào URL nhúng.
const _msYt = (id) => (/^[\w-]{11}$/.test(String(id || "")) ? id : "");
const _msVer = typeof CX_VERSION === "string" ? CX_VERSION : "";
const _msTpls = () => window.CX_SLIDE_TEMPLATES || [];

function _msItem(t, i) {
  const yt = _msYt(t.youtube);
  // Ảnh bìa: hqdefault luôn có (maxres chỉ có khi video gốc ≥ 720p); ảnh chụp mẫu cache 3 ngày nên kèm ?v=.
  const poster = yt ? `https://i.ytimg.com/vi/${yt}/hqdefault.jpg` : `${t.thumb}?v=${encodeURIComponent(_msVer)}`;
  const media = yt
    ? `<x-button variant="bare" class="ms-play" data-yt="${yt}" aria-label="Phát video mẫu ${_msEsc(t.name)}">
         <span class="ms-play-ic"><i data-lucide="play"></i></span>
       </x-button>`
    : `<span class="ms-soon">Video sắp có</span>`;
  return `<article class="ms-item" id="mau-${_msEsc(t.id)}">
      <div class="ms-video">
        <img class="ms-poster" src="${_msEsc(poster)}" alt="Mẫu slide ${_msEsc(t.name)}" ${i ? 'loading="lazy"' : 'fetchpriority="high"'} />
        ${media}
      </div>
      <div class="ms-cap">
        <div class="ms-text">
          <h2 class="ms-name">${_msEsc(t.name)}</h2>
          <p class="ms-desc">${_msEsc(t.desc)}</p>
        </div>
        <x-button variant="bare" class="ms-msg ms-send" data-id="${_msEsc(t.id)}">
          <i data-icon="messenger" data-size="18"></i>Gửi Messenger
        </x-button>
      </div>
    </article>`;
}

function _msRender() {
  const list = document.getElementById("ms-list");
  list.innerHTML = _msTpls().map(_msItem).join("");
  window.lucide?.createIcons({ root: list });
  window.cxRenderIcons?.(list);
  const want = new URLSearchParams(location.search).get("mau");
  if (want) document.getElementById(`mau-${want}`)?.scrollIntoView({ block: "center" });
}

// Bấm Phát: thay ảnh bìa bằng trình phát (youtube-nocookie, tự phát); video đang phát ở mẫu
// khác trả về ảnh bìa để không có hai video cùng kêu.
let _msPlaying = null;
function _msPlay(btn) {
  const box = btn.closest(".ms-video");
  if (_msPlaying && _msPlaying !== box) {
    _msPlaying.querySelector("iframe")?.remove();
    _msPlaying.classList.remove("is-on");
  }
  const f = document.createElement("iframe");
  f.className = "ms-frame";
  f.src = `https://www.youtube-nocookie.com/embed/${btn.dataset.yt}?autoplay=1&rel=0&playsinline=1`;
  f.title = btn.getAttribute("aria-label") || "Video mẫu slide";
  f.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
  f.allowFullscreen = true;
  box.appendChild(f);
  box.classList.add("is-on");
  _msPlaying = box;
}

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
  _msText = `Chào Cưới Xinh, mình muốn làm slide cưới theo mẫu "${t.name}".\n${link}`;
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
  const play = e.target.closest(".ms-play");
  if (play) return _msPlay(play);
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
