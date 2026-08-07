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
    console.error("Lỗi load wedding data:", error);
    if (!isPreviewMode()) {
      window.location.href = "/";
    }
  }
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

function confirmAttend(attending) {
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
    btnAttend.style.background = "rgb(var(--shadow-blush-rgb)/0.2)";
    btnAttend.style.borderColor = "rgb(var(--shadow-blush-rgb))";
    btnAttend.classList.add("btn-selected");
    msg.textContent = "Cảm ơn bạn! Chúng tôi rất mong được gặp bạn 🌸";
  } else {
    btnDecline.style.background = "rgb(var(--stone-400-rgb)/0.1)";
    btnDecline.style.borderColor = "rgb(var(--stone-400-rgb))";
    btnDecline.classList.add("btn-selected");
    msg.textContent = "Cảm ơn bạn đã phản hồi. Chúc bạn nhiều sức khỏe!";
  }

  msg.classList.remove("hidden");
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
