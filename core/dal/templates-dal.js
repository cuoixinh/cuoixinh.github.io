/**
 * TemplatesDAL — NGUỒN DUY NHẤT cho danh sách mẫu thiệp (đã ghép sẵn giá).
 *
 * Hai nguồn cho cùng một danh sách: Worker Cloudflare (có cache, nhanh) rồi Edge
 * Function `public-templates`. Worker hỏng — Supabase chập chờn, worker lỗi,
 * hoặc *.workers.dev bị chặn ở phía khách — thì gọi lại chính nó cũng hỏng y
 * vậy, phải ĐỔI nguồn. Hai nguồn trả cùng một shape, đổi field ở một bên phải
 * đổi cả bên kia (`cloudflare-worker/templates-cache.js`).
 *
 * KHÔNG gọi thẳng REST của Supabase, và đừng chép lại luồng fallback này ở chỗ
 * khác — mọi trang đều đi qua đây.
 */
class TemplatesDAL {
  constructor() {
    // Nhớ trong RAM cho cả vòng đời trang: một trang có thể hỏi danh sách ở
    // nhiều chỗ (thẻ mẫu, nút "Tạo thiệp ngay", popup đổi mẫu) — không memo thì
    // mỗi chỗ một request.
    this._promise = null;
  }

  /** Danh sách mẫu đang bật, đã sắp theo `sort_order`. */
  list() {
    if (!this._promise) {
      this._promise = this._fetch().catch((err) => {
        // Hỏng thì quên đi để lần gọi sau thử lại — mất mạng tạm thời không nên
        // làm cả trang chết danh sách mẫu cho tới khi F5.
        this._promise = null;
        throw err;
      });
    }
    return this._promise;
  }

  /** Bỏ bản nhớ trong RAM, lần `list()` sau sẽ hỏi lại nguồn. */
  invalidate() {
    this._promise = null;
  }

  /**
   * Lấy lại bằng được bản mới nhất, bỏ qua CẢ bản nhớ trong RAM lẫn HTTP cache
   * của trình duyệt (`cache: "reload"`). Dùng sau khi admin sửa mẫu — `list()`
   * thường vẫn ăn bản cũ trong trình duyệt tới hết TTL.
   */
  refresh() {
    this.invalidate();
    this._promise = this._fetch(true).catch((err) => {
      this._promise = null;
      throw err;
    });
    return this._promise;
  }

  async _fetch(fresh) {
    const cacheUrl = CONFIG.cloudflare?.templatesCache;
    if (!cacheUrl) return this._viaEdge(fresh);
    try {
      return await this._get(cacheUrl + "/", null, fresh);
    } catch (err) {
      console.warn("Templates cache lỗi, chuyển sang Edge Function:", err);
      return this._viaEdge(fresh);
    }
  }

  _viaEdge(fresh) {
    return this._get(
      CONFIG.supabase.edgeUrl + "?resource=public-templates",
      { Authorization: "Bearer " + CONFIG.supabase.anonKey },
      fresh,
    );
  }

  async _get(url, headers, fresh) {
    const init = {};
    if (headers) init.headers = headers;
    if (fresh) init.cache = "reload";
    const res = await fetch(url, init);
    if (!res.ok) throw new Error("HTTP " + res.status);
    const rows = await res.json();
    return Array.isArray(rows) ? rows : [];
  }
}

window.templatesDAL = new TemplatesDAL();
