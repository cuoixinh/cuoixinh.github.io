// Nạp dữ liệu thiệp rồi dựng, cộng phần cá nhân hoá theo khách mời của link.
// MỘT đường dựng cho cả thiệp thật (?slug=) lẫn bản xem (?preview=true, dữ liệu từ
// cxPreviewWedding ở public/themes/preview-data.js) — thêm bước dựng thì thêm ở đây.
async function loadWeddingData(weddingSlug, renderCallback) {
  if (!weddingSlug && !isPreviewMode()) {
    window.location.href = "/";
    return;
  }

  try {
    let wedding;
    if (weddingSlug) {
      wedding = await weddingBL.getWeddingBySlug(weddingSlug);
      if (!weddingBL.isActive(wedding)) {
        if (!isPreviewMode()) {
          window.location.href = "/";
        }
        return;
      }
      // Gói Miễn phí chỉ mở một bên (free_side, server tính): link bên kia chuyển về
      // bên đã chọn, giữ nguyên các tham số khác (tên khách mời…). Trang tải lại vì
      // mẫu thiệp đọc isGroomSide() ngay lúc nạp index.js.
      if (wedding.free_side && (wedding.free_side === "groom") !== isGroomSide()) {
        const u = new URL(window.location.href);
        u.searchParams.set("isGroom", String(wedding.free_side === "groom"));
        window.location.replace(u.toString());
        return;
      }
      // Chỉ gói Free có lượt xem: đếm song song với lúc dựng, hết lượt thì khoá ngay —
      // bản GET đang cache ở worker có thể còn chưa biết.
      if (wedding.free_side) {
        weddingBL.countView(weddingSlug).then((locked) => {
          if (locked) showLockedInvitation({ ...wedding, code: "VIEW_LIMIT" });
        });
      }
    } else {
      if (typeof cxPreviewWedding !== "function") return;
      wedding = await cxPreviewWedding();
    }

    // Dữ liệu xem trước có ngay tức thì — chờ parse xong để <x-button> kịp thay
    // mình bằng <button> thật, không thì render gắn vào thẻ cũ sắp bị gỡ.
    if (document.readyState === "loading") {
      await new Promise((r) =>
        document.addEventListener("DOMContentLoaded", r, { once: true }),
      );
    }

    // Áp dụng tuỳ chỉnh font/màu chữ (nếu có) trước khi render
    if (typeof applyThemeSetting === "function") {
      applyThemeSetting(wedding.theme_setting);
    }

    renderCallback(wedding);

    // Áp NỘI DUNG text đã sửa (phải sau render vì đổi textContent, không phải CSS)
    if (typeof applyTextOverrides === "function") {
      applyTextOverrides(wedding.theme_setting);
    }
    // Render các khối văn bản người dùng tự thêm
    if (typeof applyCustomBlocks === "function") {
      applyCustomBlocks(wedding.theme_setting);
    }
    // Hộp quà che phần mã QR (theme_setting.gift_box) — trước thành phần vì nó
    // giấu bớt phần thân thiệp, thành phần đặt theo % chiều cao.
    if (typeof applyGiftBox === "function") {
      applyGiftBox(wedding.theme_setting);
    }
    // Công cụ thả lên thiệp (trình phát nhạc…) — sau renderWedding vì nó cần
    // biết thiệp có nhạc nền chưa (setupMusic đặt cờ __cxMusicOn).
    if (typeof applyElements === "function") {
      applyElements(wedding.theme_setting);
    }
    // Lời chúc khách mời — sau cùng vì nó tự chèn một mục vào cuối thân thiệp,
    // và thanh ghim đáy phải nằm trên mọi thứ vừa dựng ở trên. Bản xem dựng bằng
    // dữ liệu mẫu, initWishes tự chặn nút Gửi.
    if (typeof initWishes === "function") {
      initWishes(wedding);
    }
  } catch (error) {
    // Hết hạn dùng thử: edge function trả 403 TRIAL_EXPIRED. Đây KHÔNG phải lỗi —
    // hiện màn khoá thay vì đá về trang chủ, nếu không khách mời (và cả chủ thiệp)
    // không hiểu vì sao link chết.
    // Hết hạn gói (PLAN_EXPIRED) và gói Free hết lượt xem (VIEW_LIMIT) cũng khoá y vậy,
    // chỉ khác câu chữ.
    if (error && CONFIG.lockCodes.includes(error.code)) {
      showLockedInvitation(error.info);
      return;
    }
    console.error("Lỗi load wedding data:", error);
    if (!isPreviewMode()) {
      window.location.href = "/";
    }
  }
}

// Màn "thiệp tạm khoá" phủ kín trang. Viết bằng inline style + biến --cx-* dùng
// chung: trang thiệp chỉ nạp styles/themes.css nên không có utility Tailwind, mà
// màn này phải hiện được trên MỌI theme.
function showLockedInvitation(info) {
  if (document.getElementById("cx-locked")) return;

  const names = [info && info.groom_name, info && info.bride_name]
    .filter(Boolean)
    .join(" & ");
  const esc = (s) =>
    String(s).replace(
      /[&<>"]/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
    );

  const box = document.createElement("div");
  box.id = "cx-locked";
  box.style.cssText =
    "position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;" +
    "justify-content:center;padding:24px;background:rgb(var(--cx-surface-rgb, 255 253 250));" +
    "color:rgb(var(--cx-body-rgb, 107 85 96));font-family:inherit;text-align:center";
  box.innerHTML =
    '<div style="max-width:360px">' +
    '<div style="width:64px;height:64px;margin:0 auto 20px;border-radius:999px;' +
    "display:flex;align-items:center;justify-content:center;" +
    'background:rgb(var(--cx-accent-rgb, 184 66 95) / 0.12)">' +
    '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" ' +
    'stroke="rgb(var(--cx-accent-rgb, 184 66 95))" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
    '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>' +
    "</div>" +
    '<h1 style="margin:0 0 8px;font-size:22px;line-height:1.3;font-weight:600;' +
    'color:rgb(var(--cx-heading-rgb, 74 44 53))">Thiệp đang tạm khoá</h1>' +
    (names
      ? '<p style="margin:0 0 12px;font-size:15px;' +
        'color:rgb(var(--cx-heading-rgb, 74 44 53))">' +
        esc(names) +
        "</p>"
      : "") +
    '<p style="margin:0;font-size:14px;line-height:1.6">' +
    (info && info.code === "PLAN_EXPIRED"
      ? "Thiệp đã hết thời hạn hiển thị nên tạm thời chưa mở cho khách mời. " +
        "Chủ thiệp cần nâng gói để mở lại."
      : info && info.code === "VIEW_LIMIT"
        ? "Thiệp đã hết lượt xem của gói Free nên tạm thời chưa mở cho khách mời. " +
          "Chủ thiệp cần nâng gói để mở lại."
        : "Thiệp đã hết hạn sử dụng nên tạm thời chưa mở cho khách mời. " +
          "Chủ thiệp cần kích hoạt để mở lại.") +
    "</p>" +
    // Lối ra duy nhất của màn phủ kín: không có nút này khách mời chỉ còn cách
    // đóng tab (nút Back đưa về chính link thiệp → lại màn khoá).
    '<a href="/" style="display:inline-flex;align-items:center;justify-content:center;' +
    "margin-top:24px;padding:10px 24px;border-radius:999px;font-size:14px;font-weight:600;" +
    "text-decoration:none;background:rgb(var(--cx-accent-rgb, 184 66 95));" +
    'color:rgb(var(--cx-on-accent-rgb, 255 255 255))">' +
    "Về trang chủ</a>" +
    "</div>";

  document.body.appendChild(box);
  document.body.style.overflow = "hidden";
}

// Dòng thay lời mời ở link chung (không biết khách là ai): báo tin, không mời đích danh.
const CX_VISITOR_LINE = "Chúng mình sắp cưới rồi!";

// Bỏ qua màn bìa: chỉ các khung của trang Thiết lập (Xem trực tiếp `source=live`,
// tab Giao diện `edit=1`) — ở đó khách đang chỉnh thân thiệp. Bản xem thử mẫu và
// ảnh chụp mẫu (scripts/capture.js) giữ nguyên bìa như thiệp thật.
function _cxSkipCover() {
  if (!isPreviewMode()) return false;
  const q = new URLSearchParams(window.location.search);
  return q.get("source") === "live" || q.get("edit") === "1";
}

function setupPersonalizedGreeting(
  weddingSlug,
  isGroom,
  openInvitationCallback,
) {
  if (_cxSkipCover()) {
    openInvitationCallback();
    return;
  }

  const urlParams = new URLSearchParams(window.location.search);
  const encryptedName = urlParams.get("name");
  const encryptedRelationship = urlParams.get("relationship");
  // Link chung (khách vãn lai) vẫn giữ màn bìa nhưng KHÔNG mời: dòng [data-cx-invite]
  // đổi thành lời cảm ơn; cờ .cx-guest-generic trên <html> để _common.css ẩn dòng tên
  // + [data-cx-invite-to], mẫu muốn tạo kiểu thêm cũng nhắm theo cờ này.
  const coverGuestName = document.getElementById("cover-guest-name");
  const generic = () => {
    document.documentElement.classList.add("cx-guest-generic");
    document.querySelectorAll("[data-cx-invite]").forEach((el) => {
      el.textContent = CX_VISITOR_LINE;
    });
    // Chỉ mẫu CÓ màn bìa; mẫu chỉ có hero giữ khối lời mời ẩn như cũ.
    document.querySelector("#cover-screen #cover-guest-wrap")?.classList.remove("hidden");
  };

  // Bản xem thử giả lập màn khách mời bằng ?name=<tên>&rel=<xưng hô> (hoặc ?guest=;
  // chữ thường, không mã hoá) — chỉ đổ chữ, không đặt CX_GUEST nên không ghi gì lên DB.
  // Thiệp thật (không preview) vẫn chỉ nhận name/relationship đã mã hoá ở dưới.
  const demoGuest = isPreviewMode() && (urlParams.get("name") || urlParams.get("guest"));
  if (demoGuest) {
    if (coverGuestName) coverGuestName.textContent = demoGuest;
    const rel = urlParams.get("rel") || "";
    document.querySelectorAll("[data-cx-invite]").forEach((el) => {
      el.dataset.cxInvite ||= el.textContent.trim();
      el.textContent = `${el.dataset.cxInvite} ${rel}`.trim();
    });
    // Khối tên khách của nhiều mẫu ẩn sẵn, chỉ bật cho khách thật (CX_GUEST) —
    // bật luôn ở đây để bản giả lập hiện đúng như link riêng.
    const wrap = document.getElementById("cover-guest-wrap");
    wrap?.classList.remove("hidden");
    wrap?.classList.add("flex");
    return;
  }

  if (isPreviewMode() || !encryptedName || !encryptedRelationship) {
    generic();
    return;
  }

  try {
    const name = decryptData(encryptedName);
    const relationship = decryptData(encryptedRelationship);

    if (!name || !relationship) {
      generic();
      return;
    }

    // Khách của link này — confirmAttend() cần đúng cặp tên + xưng hô để tìm ra
    // hàng tương ứng trong bảng khách mời.
    window.CX_GUEST = { slug: weddingSlug, name, relationship };

    if (coverGuestName) coverGuestName.textContent = name;
    // Xưng hô lấy từ link (Anh, Chị, Bạn…) nối vào lời mời riêng của từng mẫu
    // ("Trân trọng kính mời" / "Kính gửi") — không viết cứng chữ nào vào markup.
    document.querySelectorAll("[data-cx-invite]").forEach((el) => {
      el.dataset.cxInvite ||= el.textContent.trim();
      el.textContent = `${el.dataset.cxInvite} ${relationship}`;
    });

    const rsvpSection = document.getElementById("rsvp-section");
    if (rsvpSection) {
      rsvpSection.style.display = "flex";
    }
    _markViewed(window.CX_GUEST);
  } catch (error) {
    generic();
  }
}

function openInvitation(callback) {
  const cover = document.getElementById("cover-screen");
  const main = document.getElementById("main-card");

  if (!cover || !main) return;

  if (_cxSkipCover()) {
    cover.style.display = "none";
    main.style.display = "";
    main.style.opacity = "1";
    window.scrollTo({ top: 0 });
    if (callback) callback();
    return;
  }

  cover.classList.add("closing");
  setTimeout(() => {
    cover.style.display = "none";
    main.style.display = "";
    main.style.opacity = "0";
    main.style.transition = "opacity 0.5s ease";
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        main.style.opacity = "1";
        if (callback) callback();
      });
    });
    window.scrollTo({ top: 0 });
  }, 600);
}

// Xác nhận tham dự — DÙNG CHUNG cho mọi mẫu thiệp: theme chỉ cần có
// #btn-attend / #btn-decline / #attend-msg rồi gọi confirmAttend(true|false).
// Kết quả ghi vào bảng khách mời (cột confirmed) khi khách vào bằng link cá nhân
// hoá; link chung không ứng với khách nào nên chỉ hiện lời cảm ơn. Bản xem thử
// chạy đủ luồng giao diện nhưng _saveRsvp không gọi API.
async function confirmAttend(attending, message) {
  const btnAttend = document.getElementById("btn-attend");
  const btnDecline = document.getElementById("btn-decline");
  const msg = document.getElementById("attend-msg");

  if (!btnAttend || !btnDecline || !msg) return;

  // Remove idle pulse
  btnAttend.classList.remove("btn-idle", "btn-selected");
  btnDecline.classList.remove("btn-idle", "btn-selected");
  btnAttend.style.cssText = "";
  btnDecline.style.cssText = "";

  if (attending) {
    btnAttend.style.background = "rgb(var(--cx-accent-rgb)/0.2)";
    btnAttend.style.borderColor = "rgb(var(--cx-accent-rgb))";
    btnAttend.classList.add("btn-selected");
    msg.textContent = "Cảm ơn bạn! Chúng tôi rất mong được gặp bạn 🌸";
  } else {
    btnDecline.style.background = "rgb(var(--cx-body-rgb)/0.1)";
    btnDecline.style.borderColor = "rgb(var(--cx-body-rgb))";
    btnDecline.classList.add("btn-selected");
    msg.textContent = "Cảm ơn bạn đã phản hồi. Chúc bạn nhiều sức khỏe!";
  }

  _rsvpShow(msg, true);

  if (await _saveRsvp(attending, message, msg)) _hideRsvpButtons();
}

// Ẩn/hiện phần tử của mục xác nhận. Phải kèm inline display: theme.css nạp SAU
// themes.css nên `.xx-btn { display: inline-flex }` của mẫu đè mất `.hidden`.
function _rsvpShow(el, on) {
  if (!el) return;
  el.classList.toggle("hidden", !on);
  if (on) el.style.removeProperty("display");
  else el.style.display = "none";
}

// Đã trả lời thì giấu cặp nút, chỉ để lại #attend-msg + nút "Đổi ý". Hàng bọc chỉ
// chứa hai nút thì giấu cả hàng cho khỏi hở một khoảng trống.
function _hideRsvpButtons() {
  const a = document.getElementById("btn-attend");
  const d = document.getElementById("btn-decline");
  if (!a || !d) return;
  const row = a.parentElement;
  if (row && row === d.parentElement && row.children.length === 2) {
    _rsvpShow(row, false);
  } else {
    _rsvpShow(a, false);
    _rsvpShow(d, false);
  }
  _showRsvpChange();
}

// Nút "Đổi ý" ngay dưới #attend-msg (helper tự chèn, mẫu không phải khai markup).
// Trả lời lại thì server ghi đè lần trước nên chỉ cần mở lại hai nút.
function _showRsvpChange() {
  const msg = document.getElementById("attend-msg");
  if (!msg) return;
  const old = document.getElementById("btn-rsvp-change");
  if (old) {
    _rsvpShow(old, true);
    return;
  }
  const b = document.createElement("x-button");
  b.setAttribute("variant", "bare");
  b.setAttribute("id", "btn-rsvp-change");
  b.setAttribute("class", "cx-t");
  b.setAttribute("onclick", "changeRsvp()");
  // Inline + token --cx-*: ăn theo bộ màu của mẫu mà không phải build CSS.
  b.setAttribute(
    "style",
    // Cao 44px = vùng chạm tối thiểu trên điện thoại; nhẹ hơn hai nút chính
    // (viền mảnh, nền trong) vì đây là hành động phụ.
    "align-self:center;margin:12px auto 0;min-height:44px;padding:0 20px;gap:8px;" +
      "font-size:13px;letter-spacing:.4px;line-height:1;" +
      "color:rgb(var(--cx-accent-rgb));" +
      "background:rgb(var(--cx-accent-rgb)/.05);" +
      "border:1px solid rgb(var(--cx-accent-rgb)/.3);" +
      "transition:background-color .2s ease,transform .15s ease",
  );
  b.innerHTML =
    '<i data-lucide="rotate-ccw" aria-hidden="true" style="width:14px;height:14px"></i>' +
    "<span>Đổi ý</span>";
  msg.after(b);
  const btn = document.getElementById("btn-rsvp-change");
  if (btn) window.lucide?.createIcons({ root: btn });
}

function changeRsvp() {
  const a = document.getElementById("btn-attend");
  const d = document.getElementById("btn-decline");
  if (!a || !d) return;
  a.classList.remove("btn-selected");
  d.classList.remove("btn-selected");
  a.style.cssText = "";
  d.style.cssText = "";
  _rsvpShow(a, true);
  _rsvpShow(d, true);
  if (a.parentElement === d.parentElement) _rsvpShow(a.parentElement, true);
  _rsvpShow(document.getElementById("attend-msg"), false);
  _rsvpShow(document.getElementById("btn-rsvp-change"), false);
}

// Ghi "Đã xem" cho khách của link; khách đã xác nhận từ trước thì giấu luôn hai
// nút. Lỗi ở đây không được chặn thiệp — chỉ log.
async function _markViewed(g) {
  if (!g || !window.guestDAL?.viewPublic) return;
  try {
    const res = await window.guestDAL.viewPublic(g);
    if (!res?.matched || !res.confirmed) return;
    const msg = document.getElementById("attend-msg");
    if (msg) {
      msg.textContent =
        res.confirmed === "Có tham dự"
          ? "Bạn đã xác nhận tham dự. Hẹn gặp bạn nhé 🌸"
          : "Bạn đã phản hồi không tham dự. Cảm ơn bạn!";
      _rsvpShow(msg, true);
    }
    _hideRsvpButtons();
  } catch (error) {
    console.error("Lỗi đánh dấu đã xem:", error);
  }
}

// Gửi xác nhận lên server. Lỗi mạng thì báo ngay dưới hai nút — im lặng là chủ
// thiệp mất một lượt phản hồi mà không ai biết.
async function _saveRsvp(attending, message, msgEl) {
  // Bản xem thử: giả như đã gửi xong (trễ một nhịp cho giống mạng thật), không ghi DB.
  if (isPreviewMode()) {
    await new Promise((r) => setTimeout(r, 400));
    return true;
  }

  const g = window.CX_GUEST;
  if (!g || !g.slug || !g.name || !window.guestDAL) return false;

  try {
    await window.guestDAL.rsvpPublic({
      slug: g.slug,
      name: g.name,
      relationship: g.relationship,
      attending: !!attending,
      message,
    });
    return true;
  } catch (error) {
    console.error("Lỗi lưu xác nhận tham dự:", error);
    if (msgEl) {
      msgEl.textContent =
        "Chưa gửi được xác nhận, bạn thử lại giúp nhé (kiểm tra kết nối mạng).";
      _rsvpShow(msgEl, true);
    }
    return false;
  }
}

async function saveQR(id) {
  if (showPreviewAlert()) return;

  const img = document.getElementById(id);
  if (!img) return;

  const filename = `${id}.png`;

  try {
    const response = await fetch(img.src);
    const blob = await response.blob();
    const file = new File([blob], filename, { type: "image/png" });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: "QR Mừng Cưới" });
    } else {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
    }
  } catch (e) {
    window.open(img.src, "_blank");
  }
}

// Make functions global
window.loadWeddingData = loadWeddingData;
window.setupPersonalizedGreeting = setupPersonalizedGreeting;
window.openInvitation = openInvitation;
window.confirmAttend = confirmAttend;
window.changeRsvp = changeRsvp;
window.saveQR = saveQR;
