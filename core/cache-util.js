// Chuẩn hoá truy cập localStorage: mọi key đi qua buildCacheKey() nên luôn có
// tiền tố "cuoixinh_", tránh đụng độ và dễ nhận diện khi debug.

const CACHE_PREFIX = "cuoixinh_";

/** Ghép các phần thành 1 cache key, luôn có tiền tố "cuoixinh_". */
function buildCacheKey(...parts) {
  return (
    CACHE_PREFIX +
    parts
      .filter((p) => p !== undefined && p !== null && p !== "")
      .join("_")
  );
}

function setCache(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error("Lỗi lưu cache:", key, error);
  }
}

function getCache(key, defaultValue = null) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return defaultValue;
    return JSON.parse(raw);
  } catch (error) {
    return defaultValue;
  }
}

function removeCache(key) {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.error("Lỗi xoá cache:", key, error);
  }
}

/** Liệt kê cache key hiện có (trong phạm vi tiền tố), lọc thêm bằng predicate. */
function listCacheKeys(predicate) {
  try {
    return Object.keys(localStorage).filter(
      (k) => k.startsWith(CACHE_PREFIX) && (!predicate || predicate(k)),
    );
  } catch (error) {
    return [];
  }
}
