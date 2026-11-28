// Trang "Mẫu Slide": mỗi mẫu slide một thẻ video YouTube khung ngang + nút "Gửi Messenger".
// Video nạp theo kiểu "mặt tiền": thẻ chỉ có ảnh bìa, bấm Phát mới chèn trình phát YouTube
// (mỗi trình phát ~1 MB mã) — cùng lúc chỉ một video phát. Mẫu chưa có mã video thì hiện
// ảnh chụp mẫu kèm nhãn "Video sắp có".

// Cùng link "Nhắn tin qua Messenger" ở chân trang chủ — đổi page thì đổi cả hai.
const MS_MESSENGER = "https://m.me/61591515875537";

const _msEsc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
// Mã video 11 ký tự của YouTube — chặn chuỗi lạ lọt vào URL nhúng.
const _msYt = (id) => (/^[\w-]{11}$/.test(String(id || "")) ? id : "");
const _msVer = typeof CX_VERSION === "string" ? CX_VERSION : "";

function _msCard(t, i) {
  const yt = _msYt(t.youtube);
  // Ảnh bìa: hqdefault luôn có (maxres chỉ có khi video gốc ≥ 720p); ảnh chụp mẫu cache 3 ngày nên kèm ?v=.
  const poster = yt ? `https://i.ytimg.com/vi/${yt}/hqdefault.jpg` : `${t.thumb}?v=${encodeURIComponent(_msVer)}`;
  const media = yt
    ? `<x-button variant="bare" class="ms-play" data-yt="${yt}" aria-label="Phát video mẫu ${_msEsc(t.name)}">
         <span class="ms-play-ic"><i data-lucide="play"></i></span>
       </x-button>`
    : `<span class="ms-soon"><i data-lucide="clock"></i>Video sắp có</span>`;
  return `<article class="ms-card">
      <div class="ms-video">
        <img class="ms-poster" src="${_msEsc(poster)}" alt="Mẫu slide ${_msEsc(t.name)}" ${i ? 'loading="lazy"' : 'fetchpriority="high"'} />
        ${media}
      </div>
      <div class="ms-body">
        <div class="ms-text">
          <h2 class="ms-name">${_msEsc(t.name)}</h2>
          <p class="ms-desc">${_msEsc(t.desc)}</p>
        </div>
        <a class="ms-msg" href="${MS_MESSENGER}" target="_blank" rel="noopener" data-name="${_msEsc(t.name)}">
          <i data-icon="messenger" data-size="18"></i>Gửi Messenger
        </a>
      </div>
    </article>`;
}

function _msRender() {
  const list = document.getElementById("ms-list");
  const tpls = window.CX_SLIDE_TEMPLATES || [];
  list.innerHTML = tpls.map(_msCard).join("");
  window.lucide?.createIcons({ root: list });
  window.cxRenderIcons?.(list);
}

// Bấm Phát: thay ảnh bìa bằng trình phát (youtube-nocookie, tự phát); thẻ đang phát trước đó
// trả về ảnh bìa để không có hai video cùng kêu.
let _msPlaying = null;
function _msPlay(btn) {
  const box = btn.closest(".ms-video");
  if (_msPlaying && _msPlaying.box !== box) {
    _msPlaying.box.querySelector("iframe")?.remove();
    _msPlaying.box.classList.remove("is-on");
  }
  const id = btn.dataset.yt;
  const f = document.createElement("iframe");
  f.className = "ms-frame";
  f.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&playsinline=1`;
  f.title = btn.getAttribute("aria-label") || "Video mẫu slide";
  f.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
  f.allowFullscreen = true;
  box.appendChild(f);
  box.classList.add("is-on");
  _msPlaying = { box };
}

// Gửi Messenger: chép sẵn lời nhắn có tên mẫu rồi để link mở Messenger như thường — link m.me
// không điền sẵn được lời nhắn, khách chỉ việc dán.
async function _msCopy(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
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

document.getElementById("ms-list").addEventListener("click", (e) => {
  const play = e.target.closest(".ms-play");
  if (play) return _msPlay(play);
  const msg = e.target.closest(".ms-msg");
  if (!msg) return;
  const text = `Chào Cưới Xinh, mình muốn làm slide cưới theo mẫu "${msg.dataset.name}".`;
  _msCopy(text).then((ok) => {
    if (ok) window.showToast?.("Đã chép lời nhắn, dán vào khung chat Messenger nhé", "success", "copy");
  });
});

_msRender();
