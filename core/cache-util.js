// ============================================================
// CACHE-UTIL.JS - Chuẩn hoá truy cập localStorage toàn hệ thống
// Mọi key đều đi qua buildCacheKey() nên luôn có tiền tố "cuoixinh_",
// tránh đụng độ với script khác và dễ nhận diện khi debug qua DevTools.
// ============================================================

const CACHE_PREFIX = "cuoixinh_";

/**
 * Ghép các phần thành 1 cache key, luôn có tiền tố "cuoixinh_".
 * @param {...(string|number)} parts - Các phần của key (bỏ qua phần rỗng/undefined/null)
 * @returns {string}
 */
function buildCacheKey(...parts) {
  return (
    CACHE_PREFIX +
    parts
      .filter((p) => p !== undefined && p !== null && p !== "")
      .join("_")
  );
}

/**
 * Lưu 1 giá trị vào localStorage (tự JSON.stringify).
 * @param {string} key - Nên tạo bằng buildCacheKey()
 * @param {*} value
 */
function setCache(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error("Lỗi lưu cache:", key, error);
  }
}

/**
 * Đọc 1 giá trị từ localStorage (tự JSON.parse).
 * @param {string} key
 * @param {*} [defaultValue] - Trả về nếu key chưa tồn tại hoặc parse lỗi
 * @returns {*}
 */
function getCache(key, defaultValue = null) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return defaultValue;
    return JSON.parse(raw);
  } catch (error) {
    return defaultValue;
  }
}

/**
 * Xoá 1 key khỏi localStorage.
 * @param {string} key
 */
function removeCache(key) {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.error("Lỗi xoá cache:", key, error);
  }
}

/**
 * Liệt kê các cache key hiện có (chỉ trong phạm vi tiền tố "cuoixinh_"),
 * dùng khi cần quét nhiều key theo pattern (vd tất cả draft đang lưu).
 * @param {(key: string) => boolean} [predicate] - Lọc thêm nếu cần
 * @returns {string[]}
 */
function listCacheKeys(predicate) {
  try {
    return Object.keys(localStorage).filter(
      (k) => k.startsWith(CACHE_PREFIX) && (!predicate || predicate(k)),
    );
  } catch (error) {
    return [];
  }
}
