/** DAL — Wedding: chỉ truy vấn database, không có logic nghiệp vụ. */

// Hạn dùng của bản cache danh sách thiệp trong localStorage (xem listMyWeddings).
// Đây là chốt chặn cuối cho thay đổi xảy ra Ở NƠI KHÁC (thiết bị khác, webhook
// thanh toán, cron dọn hết hạn); thay đổi từ chính máy này đã tự dọn cache ngay.
const MY_LIST_TTL_MS = 5 * 60 * 1000;

// Cần core/cache-util.js (buildCacheKey/getCache/setCache/removeCache/listCacheKeys)
// nạp TRƯỚC file này — mọi trang dùng WeddingDAL đều đã nạp.
class WeddingDAL {
  constructor(config) {
    this.edgeUrl = config.supabase.edgeUrl;
    this.anonKey = config.supabase.anonKey;
    this.workerUrl = config.cloudflare.cacheProxy;
    // Đóng dấu bản phát hành lên cache: đổi CX_VERSION (mỗi lần deploy) là mọi
    // bản cache cũ hết hiệu lực, khỏi lo cấu trúc hàng thiệp đổi mà máy khách
    // còn giữ bản cũ.
    this.version = config.version;
  }

  // ===== Cache danh sách thiệp của người dùng =====

  _myListKey(email) {
    return buildCacheKey("myweddings", email || "guest");
  }

  /** Bản cache còn hiệu lực, hoặc null (chưa có / hết hạn / khác bản phát hành). */
  readMyWeddingsCache(email) {
    const box = getCache(this._myListKey(email));
    if (!box || !Array.isArray(box.data)) return null;
    if (box.v !== this.version) return null;
    if (Date.now() - (box.ts || 0) > MY_LIST_TTL_MS) return null;
    return box.data;
  }

  /**
   * Vứt cache danh sách của MỌI tài khoản trên máy này. Gọi sau mỗi lệnh GHI
   * thiệp — không thì trang "Quản lý thiệp cưới" còn hiện bản trước khi sửa.
   * XOÁ key (không ghi đè) nên tab khác đang mở nhận được qua sự kiện `storage`.
   */
  invalidateMyWeddings() {
    const prefix = buildCacheKey("myweddings");
    listCacheKeys((k) => k.indexOf(prefix) === 0).forEach(removeCache);
  }

  /**
   * Danh sách thiệp của chính người dùng đang đăng nhập, ưu tiên bản cache trong
   * localStorage để bớt một lượt gọi Edge Function mỗi lần mở trang;
   * `force` bỏ qua cache (nút "Tải lại").
   * Ném lỗi khi không lấy được — người gọi phải phân biệt "không có thiệp" với
   * "hỏng mạng", nuốt lỗi thành [] là báo sai cho người dùng là mất thiệp.
   */
  async listMyWeddings(email, { force = false } = {}) {
    if (!force) {
      const cached = this.readMyWeddingsCache(email);
      if (cached) return cached;
    }

    const token = (await window.CXAuth?.accessToken()) ?? null;
    if (!token) throw new Error("Phiên đăng nhập đã hết hạn");

    const response = await fetch(`${this.edgeUrl}?resource=my-weddings`, {
      headers: {
        apikey: this.anonKey,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    const list = Array.isArray(data) ? data : [];
    setCache(this._myListKey(email), {
      v: this.version,
      ts: Date.now(),
      data: list,
    });
    return list;
  }

  /**
   * Header cho request GHI (POST/PATCH): luôn kèm apikey, và đính JWT của user khi
   * đã đăng nhập để edge function gán/nhận chủ (user_id). Token lấy qua CXAuth
   * (core/auth.js); trang không nạp core/auth.js (thiệp public, chỉ ĐỌC) → token
   * null → dùng anon key.
   */
  async _authHeaders() {
    const token = (await window.CXAuth?.accessToken()) ?? null;
    return {
      "Content-Type": "application/json",
      apikey: this.anonKey,
      Authorization: `Bearer ${token || this.anonKey}`,
    };
  }

  async getWeddingBySlug(slug) {
    const apiUrl = this.workerUrl || this.edgeUrl;
    const response = await fetch(`${apiUrl}?slug=${encodeURIComponent(slug)}`, {
      headers: {
        Authorization: `Bearer ${this.anonKey}`,
      },
    });

    // Lỗi có body JSON thì bê nguyên `code` ra ngoài: trang thiệp phân biệt "hết
    // hạn dùng thử" (403 TRIAL_EXPIRED → hiện màn khoá) với lỗi thật (đá về trang
    // chủ) bằng chính mã này.
    if (!response.ok) {
      let body = null;
      try {
        body = await response.json();
      } catch (e) {
        /* lỗi không kèm body JSON */
      }
      const err = new Error(
        (body && body.error) || `HTTP ${response.status}: ${response.statusText}`,
      );
      err.status = response.status;
      err.code = body && body.code;
      err.info = body;
      throw err;
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error);
    }

    return data;
  }

  // PHẢI gửi token người dùng: từ RC1.15 server chỉ trả thiệp theo id cho chính
  // chủ thiệp (xem wedding-admin). Gửi anon key trần là ăn 403.
  async getWeddingById(id) {
    const response = await fetch(
      `${this.edgeUrl}?id=${encodeURIComponent(id)}`,
      { headers: await this._authHeaders() },
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error);
    }

    return data;
  }

  /**
   * Cập nhật thiệp. Ném Error kèm .code / .status để tầng trên phân biệt lỗi cần
   * đăng nhập (AUTH_REQUIRED) hay không có quyền (FORBIDDEN) với lỗi máy chủ.
   */
  _httpError(response, errorData) {
    const err = new Error(errorData.error || `HTTP ${response.status}`);
    err.status = response.status;
    if (errorData.code) err.code = errorData.code;
    return err;
  }

  async updateWedding(payload) {
    const apiUrl = this.workerUrl || this.edgeUrl;
    const response = await fetch(apiUrl, {
      method: "PATCH",
      headers: await this._authHeaders(),
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw this._httpError(response, errorData);
    }

    this.invalidateMyWeddings();
    return await response.json();
  }

  async createWedding(payload) {
    const response = await fetch(this.edgeUrl, {
      method: "POST",
      headers: await this._authHeaders(),
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    this.invalidateMyWeddings();
    return await response.json();
  }

  /**
   * Create draft wedding (is_published = false, no payment required)
   */
  async createDraftWedding(manage_id, theme) {
    const response = await fetch(this.edgeUrl, {
      method: "POST",
      headers: await this._authHeaders(),
      body: JSON.stringify({ manage_id, theme, is_published: false }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${response.status}`);
    }
    this.invalidateMyWeddings();
    return await response.json();
  }

  /**
   * Publish wedding after payment (is_published = true)
   */
  async publishWedding(id) {
    return await this.updateWedding({ id, is_published: true });
  }

  async deleteWedding(id, token) {
    const response = await fetch(`${this.edgeUrl}?id=${id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${this.anonKey}`,
        "x-admin-token": token,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    this.invalidateMyWeddings();
  }

  /** Liệt kê toàn bộ thiệp (chỉ admin). */
  async listWeddings(token) {
    const response = await fetch(`${this.edgeUrl}?list=true`, {
      headers: {
        Authorization: `Bearer ${this.anonKey}`,
        "x-admin-token": token,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  }
}

// Export for use in other files
if (typeof window !== "undefined") {
  window.WeddingDAL = WeddingDAL;
}
