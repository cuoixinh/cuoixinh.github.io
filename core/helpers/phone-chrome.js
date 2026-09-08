// Chrome giả lập điện thoại cho khung máy: thanh trạng thái (giờ · sóng · wifi ·
// pin · đảo động) + thanh tiêu đề (nút quay lại · tên · nút ba chấm mở menu).
//
// Dùng ở CẢ HAI nơi có khung máy: bản xem thử mẫu trên máy tính
// (core/helpers/theme-boot.js) và hai khung của trang Thiết lập (dải Xem trực
// tiếp + tab Xem trước). Mỗi nơi tự khai tiêu đề và các mục menu — file này chỉ
// dựng hình và nối sự kiện, không biết gì về trang gọi nó.
//
// Khổ khai theo px của MÁY THẬT (390) rồi nhân --cx-scr-scale (biến do trang gọi
// đặt trên thân máy) — xem .cx-pchrome* ở styles/_common.css. Ô màn phải là
// flex-column: chrome · .cx-pviewport (khung thiệp) · .cx-ppad (dải trắng đáy).

(function () {
  // Hình icon nhúng thẳng thành chuỗi SVG: markup này dựng ngoài lượt quét icon
  // của trang, mà gọi lucide.createIcons thêm một lượt cho mấy hình cố định thì
  // không đáng. Nét lấy từ bộ lucide để đồng bộ với phần còn lại.
  const FILL = {
    // signal: bốn cột sóng cao dần.
    signal:
      '<rect x="1" y="9" width="3.2" height="4" rx="1" />' +
      '<rect x="6" y="6.5" width="3.2" height="6.5" rx="1" />' +
      '<rect x="11" y="4" width="3.2" height="9" rx="1" />' +
      '<rect x="16" y="1" width="3.2" height="12" rx="1" />',
    // wifi: ba vòng cung + chấm.
    wifi:
      '<path d="M1 4.6a13.5 13.5 0 0 1 16 0" fill="none" stroke="currentColor" ' +
      'stroke-width="2.1" stroke-linecap="round" />' +
      '<path d="M4 8a9 9 0 0 1 10 0" fill="none" stroke="currentColor" ' +
      'stroke-width="2.1" stroke-linecap="round" />' +
      '<path d="M9 12.4 6.6 10.2a4.6 4.6 0 0 1 4.8 0z" />',
    // battery: vỏ + mức pin + cực dương.
    battery:
      '<rect x="0.6" y="0.6" width="21" height="11.8" rx="3.2" fill="none" ' +
      'stroke="currentColor" stroke-width="1.2" opacity="0.4" />' +
      '<rect x="2.4" y="2.4" width="13" height="8.2" rx="2" />' +
      '<path d="M23.2 4.6v3.2a2.6 2.6 0 0 0 0-3.2z" opacity="0.4" />',
  };

  const SIZE = { signal: [20, 13], wifi: [18, 13], battery: [24, 13] };

  // Nét vẽ (24×24, stroke) — hai nút của thanh tiêu đề và icon các mục menu.
  const STROKE = {
    back: '<path d="m15 18-6-6 6-6"/>',
    more:
      '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>' +
      '<circle cx="5" cy="12" r="1"/>',
    navigation: '<polygon points="3 11 22 2 13 21 11 13 3 11"/>',
    refresh:
      '<path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/>' +
      '<path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/>',
    external:
      '<path d="M15 3h6v6"/><path d="M10 14 21 3"/>' +
      '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  };

  function _fill(name) {
    const [w, h] = SIZE[name];
    return (
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' +
      w +
      " " +
      h +
      '"' +
      ' width="' +
      w +
      '" height="' +
      h +
      '" fill="currentColor" aria-hidden="true">' +
      FILL[name] +
      "</svg>"
    );
  }

  function _stroke(name) {
    return (
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"' +
      ' stroke="currentColor" stroke-width="2" stroke-linecap="round"' +
      ' stroke-linejoin="round" aria-hidden="true">' +
      (STROKE[name] || "") +
      "</svg>"
    );
  }

  function _esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function _clock() {
    const d = new Date();
    return (
      String(d.getHours()).padStart(2, "0") +
      ":" +
      String(d.getMinutes()).padStart(2, "0")
    );
  }

  // opts.back = hàm chạy khi bấm mũi tên. Không truyền thì mũi tên vẫn hiện
  // nhưng CHỈ để nhìn (như giờ và cột sóng) — khung ở trang Thiết lập không có
  // chỗ nào để quay về, mà bỏ mũi tên đi thì thanh tiêu đề lệch hẳn.
  // opts.items = các mục của menu ba chấm ([] thì nút vẫn có, bấm ra menu rỗng
  // nên ẩn luôn nút cho gọn).
  function html(opts) {
    const o = opts || {};
    const items = o.items || [];
    const backTag = o.back ? "button" : "span";

    return (
      '<div class="cx-pchrome">' +
      '<div class="cx-pchrome-status">' +
      '<span class="cx-pchrome-clock">' +
      _clock() +
      "</span>" +
      '<span class="cx-pchrome-island"></span>' +
      '<span class="cx-pchrome-sys">' +
      _fill("signal") +
      _fill("wifi") +
      _fill("battery") +
      "</span>" +
      "</div>" +
      '<div class="cx-pchrome-bar">' +
      "<" +
      backTag +
      ' class="cx-pchrome-btn"' +
      (o.back
        ? ' type="button" data-act="back" aria-label="Quay lại"'
        : ' aria-hidden="true"') +
      ">" +
      _stroke("back") +
      "</" +
      backTag +
      ">" +
      '<span class="cx-pchrome-name">' +
      _esc(o.title || "") +
      "</span>" +
      (items.length
        ? '<button type="button" class="cx-pchrome-btn" data-act="more"' +
          ' aria-label="Tùy chọn" aria-haspopup="menu" aria-expanded="false">' +
          _stroke("more") +
          "</button>"
        : '<span class="cx-pchrome-btn" aria-hidden="true">' +
          _stroke("more") +
          "</span>") +
      "</div>" +
      '<div class="cx-pchrome-pop" role="menu" hidden>' +
      items
        .map(function (it, i) {
          return (
            '<button type="button" class="cx-pchrome-item" role="menuitem"' +
            ' data-act="item" data-i="' +
            i +
            '">' +
            _stroke(it.icon) +
            _esc(it.label) +
            "</button>"
          );
        })
        .join("") +
      "</div>" +
      "</div>"
    );
  }

  // Chèn chrome vào ĐẦU ô màn rồi nối sự kiện. Không đụng tới iframe đang có:
  // dời iframe trong DOM là trình duyệt nạp lại nó từ đầu.
  function mount(screenEl, opts) {
    if (!screenEl) return null;
    screenEl.insertAdjacentHTML("afterbegin", html(opts));
    const root = screenEl.firstElementChild;
    wire(root, opts);
    return root;
  }

  function wire(root, opts) {
    const o = opts || {};
    const items = o.items || [];
    const pop = root.querySelector(".cx-pchrome-pop");
    const more = root.querySelector('[data-act="more"]');

    function toggle(open) {
      pop.hidden = !open;
      if (more) more.setAttribute("aria-expanded", open ? "true" : "false");
    }

    // Bấm ra ngoài thì đóng menu — nghe ở document vì khung máy chỉ chiếm một
    // góc trang, cú bấm "ra ngoài" thường rơi ngoài cả khung.
    document.addEventListener("click", function (e) {
      if (!root.contains(e.target)) toggle(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") toggle(false);
    });

    root.addEventListener("click", function (e) {
      const btn = e.target.closest("[data-act]");
      const act = btn && btn.dataset.act;

      if (act === "more") return toggle(pop.hidden);
      toggle(false);
      if (act === "back") return o.back();
      if (act === "item") items[+btn.dataset.i]?.onClick?.();
    });
  }

  // Đổi tên hiện trên thanh tiêu đề (đổi mẫu, tải xong tên thật của mẫu…).
  // Không truyền root thì đổi mọi khung đang có trên trang.
  function setTitle(text, root) {
    const scope = root || document;
    scope.querySelectorAll(".cx-pchrome-name").forEach(function (el) {
      el.textContent = text;
    });
  }

  window.CXPhoneChrome = {
    html: html,
    mount: mount,
    wire: wire,
    setTitle: setTitle,
  };
})();
