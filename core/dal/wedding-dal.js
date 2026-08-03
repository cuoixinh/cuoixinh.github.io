/** DAL — Wedding: chỉ truy vấn database, không có logic nghiệp vụ. */

class WeddingDAL {
  constructor(config) {
    this.edgeUrl = config.supabase.edgeUrl;
    this.anonKey = config.supabase.anonKey;
    this.workerUrl = config.cloudflare.cacheProxy;
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

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error);
    }

    return data;
  }

  async getWeddingById(id) {
    const response = await fetch(
      `${this.edgeUrl}?id=${encodeURIComponent(id)}`,
      {
        headers: {
          Authorization: `Bearer ${this.anonKey}`,
        },
      },
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
