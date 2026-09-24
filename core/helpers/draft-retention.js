// Dọn nháp bỏ quên trong localStorage (hạn: CONFIG.retention.localDraftDays).
// Nháp nằm trên máy khách nên back-end không với tới — đây là chỗ DUY NHẤT giữ
// đúng lời hứa "nháp tự động xoá sau N ngày" cho bản chỉ lưu trên thiết bị.
// Nạp SAU core/cache-util.js và core/config.js; chạy ngay, không đụng DOM.

(function () {
  const DAY_MS = 86400000;

  // Nháp đang mở thì tuyệt đối không đụng: khách có thể ngồi sửa một bản nháp cũ
  // hàng tháng trời mà chưa lưu lại lần nào.
  function _openDraftId() {
    try {
      return new URLSearchParams(window.location.search).get("id") || "";
    } catch (e) {
      return "";
    }
  }

  function cxSweepLocalDrafts() {
    if (typeof CONFIG === "undefined" || !CONFIG.retention) return [];
    const days = CONFIG.retention.localDraftDays;
    if (!days) return [];

    const prefix = buildCacheKey("draft") + "_";
    const openKey = buildCacheKey("draft", _openDraftId());
    const now = Date.now();
    const purged = [];

    listCacheKeys((k) => k.indexOf(prefix) === 0).forEach((key) => {
      if (key === openKey) return;
      const data = getCache(key);
      if (!data || typeof data !== "object") return;

      // Nháp có từ trước khi có cơ chế này: đóng dấu bây giờ chứ KHÔNG xoá —
      // xoá là bản đang làm dở của khách bay mất ngay lần deploy đầu tiên.
      if (!data._savedAt) {
        setCache(key, { ...data, _savedAt: now });
        return;
      }

      if (now - data._savedAt <= days * DAY_MS) return;
      removeCache(key);
      purged.push(key.slice(prefix.length));
    });

    if (purged.length) {
      _dropOrders(purged);
      _dropPendingImages(purged);
    }
    return purged;
  }

  // Ảnh chờ upload của nháp nằm ở IndexedDB (invitation-setup/js/02-idb.js), không
  // dọn cùng là File nằm lại vĩnh viễn. Tên DB/store/phiên bản phải khớp 02-idb.js;
  // onupgradeneeded cũng tạo store y hệt, vì mở lần đầu ở đây mà thiếu store thì
  // 02-idb.js (cùng phiên bản) không còn dịp tạo nữa.
  function _dropPendingImages(ids) {
    if (!ids.length || typeof indexedDB === "undefined") return;
    const gone = new Set(ids);
    try {
      const req = indexedDB.open("cuoixinh_pending", 1);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains("uploads"))
          db.createObjectStore("uploads", { keyPath: "key" });
      };
      req.onsuccess = (e) => {
        const db = e.target.result;
        const store = db.transaction("uploads", "readwrite").objectStore("uploads");
        store.openCursor().onsuccess = (ev) => {
          const cur = ev.target.result;
          if (!cur) return;
          if (gone.has(cur.value?.weddingId)) cur.delete();
          cur.continue();
        };
      };
    } catch (e) {
      console.error("draft-retention IDB:", e);
    }
  }

  // Khách tự xoá một thiệp (my-invitations): gỡ luôn nháp local + ảnh chờ upload,
  // không thì "Tạo thiệp" hỏi lại "thiệp đang viết dở" và nháp sống lại.
  function cxDropLocalDraft(id) {
    if (!id) return;
    removeCache(buildCacheKey("draft", id));
    _dropPendingImages([id]);
  }

  // Nháp đã xoá mà đơn vẫn nằm trong cache "orders" thì trang Quản lý thiệp cưới
  // hiện một thẻ ma, bấm vào ra form trống. Chỉ gỡ đơn còn ở trạng thái nháp —
  // đơn đã xuất bản/thanh toán là dữ liệu trên DB, không phải bản nháp.
  function _dropOrders(ids) {
    const gone = new Set(ids);
    const prefix = buildCacheKey("orders") + "_";
    listCacheKeys((k) => k.indexOf(prefix) === 0).forEach((key) => {
      const orders = getCache(key, []);
      if (!Array.isArray(orders) || !orders.length) return;
      const kept = orders.filter(
        (o) => !(o && o.status === "draft" && gone.has(o.manage_id)),
      );
      if (kept.length !== orders.length) setCache(key, kept);
    });
  }

  window.cxSweepLocalDrafts = cxSweepLocalDrafts;
  window.cxDropLocalDraft = cxDropLocalDraft;
  cxSweepLocalDrafts();
})();
