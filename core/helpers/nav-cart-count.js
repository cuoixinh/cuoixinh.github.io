// Ô đếm cho mục "Đã chọn" ở navbar (giống ô đếm của "Yêu thích").
// Đếm theo manage_id nên không trùng: đơn trong localStorage của phiên hiện tại
// + đơn tạo lúc chưa đăng nhập (chưa kịp gộp) + danh sách id lấy từ DB mà trang
// "Quản lý thiệp cưới" ghi lại — nhờ vậy các trang khác hiện đúng số mà không
// phải gọi API. Nạp SAU core/cache-util.js và sau lời gọi CXNavbar.mount().
(function () {
  function _email() {
    var u = window.CXAuth && window.CXAuth.getUserSync && window.CXAuth.getUserSync();
    return (u && u.email) || "guest";
  }

  function _addOrders(set, key) {
    var list = getCache(key, []);
    if (!Array.isArray(list)) return;
    list.forEach(function (o) {
      if (o && o.manage_id) set.add(o.manage_id);
    });
  }

  function _ids() {
    var email = _email();
    var set = new Set();
    _addOrders(set, buildCacheKey("orders", email));
    _addOrders(set, buildCacheKey("orders", "guest"));
    var db = getCache(buildCacheKey("cart_ids", email), []);
    if (Array.isArray(db)) db.forEach(function (id) {
      if (id) set.add(id);
    });
    return set;
  }

  function sync() {
    if (window.CXNavbar) CXNavbar.setCount("cart", _ids().size);
  }

  /** Trang "Quản lý thiệp cưới" gọi sau mỗi lần dựng lưới: id thật của danh sách. */
  function remember(ids) {
    setCache(buildCacheKey("cart_ids", _email()), (ids || []).filter(Boolean));
    sync();
  }

  window.CXCartCount = {
    sync: sync,
    remember: remember,
    count: function () {
      return _ids().size;
    },
  };

  function _init() {
    sync();
    // Phiên đổi thì đổi cả key cache lẫn con số; getUser() chốt lại bằng phiên
    // thật vì getUserSync() chỉ đọc storage.
    if (window.CXAuth) {
      CXAuth.onChange(sync);
      CXAuth.getUser().then(sync, function () {});
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", _init);
  } else {
    _init();
  }
  // Tab khác vừa tạo/xoá thiệp → cập nhật luôn, không phải tải lại trang.
  window.addEventListener("storage", sync);
})();
