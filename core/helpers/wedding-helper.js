// ============================================================
// WEDDING-HELPER.JS - Wedding data loading and personalization
// ============================================================

async function loadWeddingData(weddingSlug, renderCallback) {
  if (!weddingSlug) {
    if (!isPreviewMode()) {
      window.location.href = "/";
    }
    return;
  }

  try {
    const wedding = await weddingBL.getWeddingBySlug(weddingSlug);

    if (!weddingBL.isActive(wedding)) {
      if (!isPreviewMode()) {
        window.location.href = "/";
      }
      return;
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
    // Hoa / hoạ tiết trang trí thả theo toạ độ
    if (typeof applyDecorations === "function") {
      applyDecorations(wedding.theme_setting);
    }
    // Công cụ thả lên thiệp (trình phát nhạc…) — sau renderWedding vì nó cần
    // biết thiệp có nhạc nền chưa (setupMusic đặt cờ __cxMusicOn).
    if (typeof applyElements === "function") {
      applyElements(wedding.theme_setting);
    }
  } catch (error) {
    // Hết hạn dùng thử: edge function trả 403 TRIAL_EXPIRED. Đây KHÔNG phải lỗi —
    // hiện màn khoá thay vì đá về trang chủ, nếu không khách mời (và cả chủ thiệp)
    // không hiểu vì sao link chết.
    if (error && error.code === "TRIAL_EXPIRED") {
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
    "justify-content:center;padding:24px;background:var(--cx-surface,#fffdfa);" +
    "color:var(--cx-body,#6b5560);font-family:inherit;text-align:center";
  box.innerHTML =
    '<div style="max-width:360px">' +
    '<div style="width:64px;height:64px;margin:0 auto 20px;border-radius:999px;' +
    "display:flex;align-items:center;justify-content:center;" +
    'background:color-mix(in srgb, var(--cx-accent,#b8425f) 12%, transparent)">' +
    '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" ' +
    'stroke="var(--cx-accent,#b8425f)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
    '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>' +
    "</div>" +
    '<h1 style="margin:0 0 8px;font-size:22px;line-height:1.3;font-weight:600;' +
    'color:var(--cx-heading,#4a2c35)">Thiệp đang tạm khoá</h1>' +
    (names
      ? '<p style="margin:0 0 12px;font-size:15px;color:var(--cx-heading,#4a2c35)">' +
        esc(names) +
        "</p>"
      : "") +
    '<p style="margin:0;font-size:14px;line-height:1.6">Thiệp đã hết hạn dùng thử nên tạm ' +
    "thời chưa mở cho khách mời. Chủ thiệp cần kích hoạt để mở lại.</p>" +
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

function setupPersonalizedGreeting(
  weddingSlug,
  isGroom,
  openInvitationCallback,
) {
  if (isPreviewMode()) {
    openInvitationCallback();
    return;
  }

  const urlParams = new URLSearchParams(window.location.search);
  const encryptedName = urlParams.get("name");
  const encryptedRelationship = urlParams.get("relationship");

  if (!encryptedName || !encryptedRelationship) {
    openInvitationCallback();
    return;
  }

  try {
    const name = decryptData(encryptedName);
    const relationship = decryptData(encryptedRelationship);

    if (!name || !relationship) {
      openInvitationCallback();
      return;
    }

    // Khách của link này — confirmAttend() cần đúng cặp tên + xưng hô để tìm ra
    // hàng tương ứng trong bảng khách mời.
    window.CX_GUEST = { slug: weddingSlug, name, relationship };

    const coverGuestName = document.getElementById("cover-guest-name");
    if (coverGuestName) coverGuestName.textContent = name;

    const rsvpSection = document.getElementById("rsvp-section");
    if (rsvpSection) {
      rsvpSection.style.display = "flex";
    }
  } catch (error) {
    openInvitationCallback();
    return;
  }
}

function openInvitation(callback) {
  const cover = document.getElementById("cover-screen");
  const main = document.getElementById("main-card");

  if (!cover || !main) return;

  if (isPreviewMode()) {
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
// hoá; link chung không ứng với khách nào nên chỉ hiện lời cảm ơn.
async function confirmAttend(attending, message) {
  if (showPreviewAlert()) return;

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

  msg.classList.remove("hidden");

  await _saveRsvp(attending, message, msg);
}

// Gửi xác nhận lên server. Lỗi mạng thì báo ngay dưới hai nút — im lặng là chủ
// thiệp mất một lượt phản hồi mà không ai biết.
async function _saveRsvp(attending, message, msgEl) {
  const g = window.CX_GUEST;
  if (!g || !g.slug || !g.name || !window.guestDAL) return;

  try {
    await window.guestDAL.rsvpPublic({
      slug: g.slug,
      name: g.name,
      relationship: g.relationship,
      attending: !!attending,
      message,
    });
  } catch (error) {
    console.error("Lỗi lưu xác nhận tham dự:", error);
    if (msgEl) {
      msgEl.textContent =
        "Chưa gửi được xác nhận, bạn thử lại giúp nhé (kiểm tra kết nối mạng).";
      msgEl.classList.remove("hidden");
    }
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
window.saveQR = saveQR;
