/**
 * share-social.js — Module chia sẻ link qua mạng xã hội (dùng chung)
 *
 * Dựng popup động, không cần HTML tĩnh. Dùng ở bất kỳ trang nào có nạp file này.
 *
 * Cách dùng:
 *   ShareSocial.open({
 *     link: "https://motdoi.com.vn/thiep/abc",   // bắt buộc — link cần chia sẻ
 *     title: "Chia sẻ thiệp cưới",               // tuỳ chọn — tiêu đề popup
 *     subtitle: "Anh Minh",                       // tuỳ chọn — dòng phụ (tên khách/cặp đôi)
 *     message: "Trân trọng kính mời…",            // tuỳ chọn — lời nhắn kèm khi share
 *   });
 *
 * Phụ thuộc mềm: showToast (core/helpers/alert.js) và lucide — có thì dùng, không có vẫn chạy.
 */
(function (global) {
  "use strict";

  const DEFAULT_MESSAGE = "Trân trọng kính mời bạn đến chung vui cùng đám cưới của chúng mình 💌";

  // Danh sách kênh chia sẻ. `url(ctx)` trả về web URL, hoặc dùng `handler(ctx)` để xử lý riêng.
  const CHANNELS = [
    {
      key: "facebook", label: "Facebook", bg: "bg-[#1877F2]",
      svg: `<svg viewBox="0 0 24 24" style="width:22px;height:22px;fill:white"><path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07z"/></svg>`,
      url: ({ enc }) => `https://www.facebook.com/sharer/sharer.php?u=${enc}`,
    },
    {
      key: "messenger", label: "Messenger", bg: "bg-gradient-to-br from-[#00B2FF] to-[#006AFF]",
      svg: `<svg viewBox="0 0 24 24" style="width:22px;height:22px;fill:white"><path d="M12 0C5.373 0 0 4.975 0 11.111c0 3.497 1.745 6.616 4.472 8.652V24l4.086-2.242c1.09.301 2.246.464 3.442.464 6.627 0 12-4.975 12-11.111S18.627 0 12 0zm1.193 14.963L10.1 11.625l-6.112 3.338 6.724-7.143 3.093 3.338 6.112-3.338-6.724 7.143z"/></svg>`,
      handler: ({ link }) => shareViaMessenger(link),
    },
    {
      key: "zalo", label: "Zalo", bg: "bg-[#0068FF]",
      svg: `<span style="color:white;font-weight:800;font-size:13px;letter-spacing:-0.5px">Zalo</span>`,
      url: ({ enc }) => `https://sp.zalo.me/plugins/share?href=${enc}`,
    },
    {
      key: "whatsapp", label: "WhatsApp", bg: "bg-[#25D366]",
      svg: `<svg viewBox="0 0 24 24" style="width:22px;height:22px;fill:white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.464 3.488"/></svg>`,
      url: ({ msgEnc }) => `https://api.whatsapp.com/send?text=${msgEnc}`,
    },
    {
      key: "twitter", label: "X (Twitter)", bg: "bg-black",
      svg: `<svg viewBox="0 0 24 24" style="width:19px;height:19px;fill:white"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`,
      url: ({ msgEnc }) => `https://twitter.com/intent/tweet?text=${msgEnc}`,
    },
  ];

  // ─── Helpers ────────────────────────────────────────────────────────────────

  function _toast(msg, type) {
    if (typeof global.showToast === "function") global.showToast(msg, type);
  }

  function _refreshIcons() {
    if (global.lucide && typeof global.lucide.createIcons === "function") global.lucide.createIcons();
  }

  function copyLink(link) {
    if (!link) return;
    navigator.clipboard.writeText(link)
      .then(() => _toast("✅ Đã copy link"))
      .catch(() => _toast("❌ Không copy được link"));
  }

  function shareViaMessenger(link) {
    const app = `fb-messenger://share/?link=${encodeURIComponent(link)}`;
    const web = `https://www.facebook.com/dialog/send?link=${encodeURIComponent(link)}&app_id=966242223397117&redirect_uri=${encodeURIComponent(global.location.href)}`;
    const a = document.createElement("a");
    a.href = app;
    a.click();
    // Fallback web nếu không mở được app
    setTimeout(() => global.open(web, "_blank"), 1000);
  }

  async function shareViaSystem(ctx) {
    if (navigator.share) {
      try {
        await navigator.share({ title: ctx.title, text: ctx.message, url: ctx.link });
      } catch (_) { /* user huỷ */ }
    } else {
      copyLink(ctx.link);
      _toast("📋 Đã copy link — dán để chia sẻ nhé");
    }
  }

  // ─── Modal (dựng 1 lần, tái sử dụng) ─────────────────────────────────────────

  let _modal = null;
  let _ctx = null; // { link, message, title }

  function _ensureModal() {
    if (_modal) return _modal;
    _modal = document.createElement("div");
    _modal.id = "share-social-modal";
    _modal.className = "fixed inset-0 z-[99999] bg-black/50 hidden items-center justify-center p-4";
    _modal.innerHTML = `
      <div class="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden">
        <div class="flex items-start justify-between px-5 pt-4 pb-3 border-b border-gray-100">
          <div class="flex items-center gap-2 min-w-0">
            <i data-lucide="share-2" class="w-4 h-4 text-rose-500 shrink-0"></i>
            <div class="min-w-0">
              <h3 data-ss="title" class="text-sm font-semibold text-gray-800">Chia sẻ thiệp cưới</h3>
              <p data-ss="subtitle" class="text-xs text-gray-400 truncate"></p>
            </div>
          </div>
          <button type="button" data-ss="close"
            class="w-7 h-7 rounded-full flex items-center justify-center hover:bg-gray-100 text-gray-400 shrink-0">
            <i data-lucide="x" class="w-4 h-4"></i>
          </button>
        </div>
        <div class="px-5 py-4 space-y-4">
          <div data-ss="channels" class="grid grid-cols-5 gap-2"></div>
          <div class="flex items-center gap-2 bg-gray-50 rounded-lg border border-gray-200 pl-3 pr-1.5 py-1.5">
            <span data-ss="link" class="flex-1 text-xs font-mono text-gray-500 truncate"></span>
            <button type="button" data-ss="copy"
              class="shrink-0 h-7 px-2.5 rounded-md text-xs font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 transition-colors flex items-center gap-1">
              <i data-lucide="copy" style="width:13px;height:13px"></i> Sao chép
            </button>
          </div>
          <button type="button" data-ss="system"
            class="w-full h-9 rounded-lg text-xs font-medium text-gray-700 border border-gray-200 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2">
            <i data-lucide="message-circle" style="width:14px;height:14px"></i> Chia sẻ qua ứng dụng khác
          </button>
        </div>
      </div>`;
    document.body.appendChild(_modal);

    _modal.addEventListener("click", (e) => {
      if (e.target === _modal || e.target.closest("[data-ss=close]")) close();
    });
    _modal.querySelector("[data-ss=copy]").addEventListener("click", () => _ctx && copyLink(_ctx.link));
    _modal.querySelector("[data-ss=system]").addEventListener("click", () => _ctx && shareViaSystem(_ctx));

    // Event delegation cho các kênh
    _modal.querySelector("[data-ss=channels]").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-channel]");
      if (!btn || !_ctx) return;
      const ch = CHANNELS.find(c => c.key === btn.dataset.channel);
      if (!ch) return;
      if (typeof ch.handler === "function") { ch.handler(_ctx); return; }
      const url = ch.url(_ctx);
      if (url) global.open(url, "_blank", "noopener,noreferrer");
    });

    return _modal;
  }

  function open(opts) {
    const link = opts && opts.link;
    if (!link) { _toast("⚠️ Không có link để chia sẻ"); return; }

    const message = (opts.message || DEFAULT_MESSAGE) + " " + link;
    _ctx = {
      link,
      message,
      title: opts.title || "Chia sẻ thiệp cưới",
      enc: encodeURIComponent(link),
      msgEnc: encodeURIComponent(message),
    };

    const modal = _ensureModal();
    modal.querySelector("[data-ss=title]").textContent = opts.title || "Chia sẻ thiệp cưới";
    const subEl = modal.querySelector("[data-ss=subtitle]");
    subEl.textContent = opts.subtitle || "";
    subEl.classList.toggle("hidden", !opts.subtitle);
    modal.querySelector("[data-ss=link]").textContent = link;

    modal.querySelector("[data-ss=channels]").innerHTML = CHANNELS.map(c => `
      <button type="button" data-channel="${c.key}" class="flex flex-col items-center gap-1.5 group">
        <span class="w-11 h-11 rounded-full ${c.bg} flex items-center justify-center group-hover:scale-105 transition-transform">${c.svg}</span>
        <span class="text-[10px] text-gray-500 text-center leading-tight">${c.label}</span>
      </button>`).join("");

    modal.classList.remove("hidden");
    modal.classList.add("flex");
    _refreshIcons();
  }

  function close() {
    if (!_modal) return;
    _modal.classList.add("hidden");
    _modal.classList.remove("flex");
  }

  global.ShareSocial = { open, close, copyLink, shareViaMessenger, shareViaSystem };
})(window);
