class GuestDAL {
  constructor() {
    this._url = CONFIG.supabase.guestHandlerUrl;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  /**
   * Header cho mọi request: đính JWT của user đang đăng nhập — guest-handler yêu
   * cầu người gọi là CHỦ THIỆP mới được đọc/sửa danh sách khách mời.
   */
  async _authHeaders() {
    const token = (await window.CXAuth?.accessToken()) ?? null;
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
  }

  async _get(action, params = {}) {
    const qs = new URLSearchParams({ action, ...params });
    const res = await fetch(`${this._url}?${qs}`, {
      headers: await this._authHeaders(),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Lỗi máy chủ');
    return json;
  }

  async _post(action, body) {
    const res = await fetch(`${this._url}?action=${action}`, {
      method: 'POST',
      headers: await this._authHeaders(),
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Lỗi máy chủ');
    return json;
  }

  async _patch(action, body) {
    const res = await fetch(`${this._url}?action=${action}`, {
      method: 'PATCH',
      headers: await this._authHeaders(),
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Lỗi máy chủ');
    return json;
  }

  async _delete(body) {
    const res = await fetch(this._url, {
      method: 'DELETE',
      headers: await this._authHeaders(),
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Lỗi máy chủ');
    return json;
  }

  // ── Reads ─────────────────────────────────────────────────────────────────

  async getGuests(weddingId, side = null) {
    const params = { wedding_id: weddingId };
    if (side) params.side = side;
    return this._get('list', params);
  }

  async getWedding(weddingId) {
    return this._get('wedding', { wedding_id: weddingId });
  }

  // ── Xác nhận tham dự (CÔNG KHAI) ─────────────────────────────────────────

  /**
   * Khách mời tự xác nhận từ trang thiệp — KHÔNG đăng nhập, nên gửi anon key chứ
   * không dùng _authHeaders(). Edge function khớp khách theo slug + tên + xưng hô
   * trên link rồi chỉ ghi cột confirmed; trả { matched } để biết link có ứng với
   * khách nào trong danh sách hay không.
   */
  async rsvpPublic({ slug, name, relationship, attending, message }) {
    const res = await fetch(`${this._url}?action=rsvp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: CONFIG.supabase.anonKey,
        Authorization: `Bearer ${CONFIG.supabase.anonKey}`,
      },
      body: JSON.stringify({ slug, name, relationship, attending, message }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Lỗi máy chủ');
    return json;
  }

  // ── Writes ────────────────────────────────────────────────────────────────

  async insertOneGuest(weddingId, side, guest) {
    return this._post('insert-one', { wedding_id: weddingId, side, guest });
  }

  async importGuestsViaEdge(weddingId, side, guests, overwrite) {
    return this._post('import', { wedding_id: weddingId, side, guests, overwrite });
  }

  async updateGuestsBatchLinks(updates) {
    if (!updates || updates.length === 0) return;
    return this._patch('update-links-batch', { updates });
  }

  async updateGuest(id, fields) {
    return this._patch('update-guest', { id, ...fields });
  }

  async deleteGuestsByIds(ids) {
    if (!ids || ids.length === 0) return;
    return this._delete({ ids });
  }
}
