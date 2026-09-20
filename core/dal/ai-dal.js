/**
 * AiDAL — gọi Edge Function ai-invitation. Không bắt buộc đăng nhập: đã đăng nhập
 * thì đính JWT (hạn mức theo user), chưa thì server đếm theo IP + mã thiết bị
 * (core/helpers/device-id.js, nạp trước file này).
 */
class AiDAL {
  constructor() {
    this._url = CONFIG.supabase.aiInvitationUrl;
  }

  /**
   * Error cho một phản hồi lỗi của Edge Function. `needLogin` = hết lượt AI khi
   * chưa đăng nhập (server gửi kèm `login`) — UI dựa vào cờ này để mời đăng nhập
   * thay vì chỉ báo lỗi suông.
   */
  _err(json, fallback) {
    const e = new Error(json?.error || fallback);
    if (json?.login) e.needLogin = true;
    return e;
  }

  /** Access token của phiên hiện tại — CXAuth (core/auth.js). null nếu chưa đăng nhập. */
  async _token() {
    return (await window.CXAuth?.accessToken()) ?? null;
  }

  /**
   * Sinh nội dung thiệp. `info` (BẮT BUỘC) là dump thông tin tự do — gồm tên cô
   * dâu/chú rể, ngày & giờ cưới… để AI trích xuất; `story_love` là chuyện tình
   * nguyên văn, backend tự tách mốc.
   */
  async generateInvitation(input) {
    const token = await this._token();

    // Chưa đăng nhập vẫn gọi được: dùng anon key làm apikey (bắt buộc để qua
    // gateway Supabase), và chỉ đính Bearer JWT khi thực sự đã đăng nhập.
    const headers = {
      "Content-Type": "application/json",
      apikey: CONFIG.supabase.anonKey,
      Authorization: `Bearer ${token || CONFIG.supabase.anonKey}`,
    };

    const res = await fetch(this._url, {
      method: "POST",
      headers,
      body: JSON.stringify({ ...input, device: window.cxDeviceId?.() || "" }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw this._err(json, "Không tạo được nội dung, vui lòng thử lại");
    return json.data;
  }

  /**
   * Tối ưu (làm giàu) nội dung MỘT ô văn bản — `mode: "optimize"`, prompt do
   * inputType quyết định ở server: slogan | rsvp | footer | love_story | timeline.
   * groomName/brideName chỉ cần cho love_story để server lọc tên riêng khỏi mốc.
   */
  async optimizeText({ inputType, text, tone, groomName, brideName }) {
    const token = await this._token();
    const headers = {
      "Content-Type": "application/json",
      apikey: CONFIG.supabase.anonKey,
      Authorization: `Bearer ${token || CONFIG.supabase.anonKey}`,
    };

    const res = await fetch(this._url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        mode: "optimize",
        device: window.cxDeviceId?.() || "",
        inputType,
        text,
        tone,
        // Chỉ dùng cho inputType="love_story": server lọc tên khỏi mốc chuyện tình.
        groom_name: groomName || "",
        bride_name: brideName || "",
      }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw this._err(json, "Không tối ưu được nội dung, vui lòng thử lại");
    return json.text || "";
  }

  /**
   * Tạo "Câu chuyện tình yêu": người dùng kể tự do → AI tách thành danh sách mốc
   * (`mode: "love_story"`). Luôn xưng "chúng mình/anh/em"; gửi kèm tên để server
   * lọc nốt nếu model lỡ nhắc tới.
   */
  async generateLoveStory({ text, tone, groomName, brideName }) {
    const token = await this._token();
    const headers = {
      "Content-Type": "application/json",
      apikey: CONFIG.supabase.anonKey,
      Authorization: `Bearer ${token || CONFIG.supabase.anonKey}`,
    };

    const res = await fetch(this._url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        mode: "love_story",
        device: window.cxDeviceId?.() || "",
        text,
        tone,
        groom_name: groomName || "",
        bride_name: brideName || "",
      }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw this._err(json, "Không tạo được câu chuyện, vui lòng thử lại");
    return Array.isArray(json.items) ? json.items : [];
  }

  /**
   * Sinh trọn bộ DỮ LIỆU MẪU cho một theme (`mode: "sample"`): server tự dựng cặp
   * đôi hư cấu, trả về cùng shape với generateInvitation(). hint: yêu cầu thêm
   * dạng tự do.
   */
  async generateSampleData({ tone, region, hint } = {}) {
    const token = await this._token();
    const headers = {
      "Content-Type": "application/json",
      apikey: CONFIG.supabase.anonKey,
      Authorization: `Bearer ${token || CONFIG.supabase.anonKey}`,
    };

    const res = await fetch(this._url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        mode: "sample",
        device: window.cxDeviceId?.() || "",
        tone,
        region,
        hint,
      }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw this._err(json, "Không tạo được dữ liệu mẫu, vui lòng thử lại");
    return json.data;
  }

  /**
   * Sinh nội dung dạng STREAMING: server trả NDJSON, mỗi dòng một sự kiện —
   * block: 1 block sạch; full: kết quả đầy đủ (đường non-stream);
   * meta: {done,provider} | {error}.
   */
  async generateInvitationStream(input, onEvent) {
    const token = await this._token();
    const headers = {
      "Content-Type": "application/json",
      apikey: CONFIG.supabase.anonKey,
      Authorization: `Bearer ${token || CONFIG.supabase.anonKey}`,
    };

    const res = await fetch(this._url, {
      method: "POST",
      headers,
      body: JSON.stringify({ ...input, device: window.cxDeviceId?.() || "", stream: true }),
    });

    if (!res.ok || !res.body) {
      const j = await res.json().catch(() => ({}));
      throw this._err(j, "Không tạo được nội dung, vui lòng thử lại");
    }

    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let nl;
      while ((nl = buf.indexOf("\n")) !== -1) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;
        let evt;
        try {
          evt = JSON.parse(line);
        } catch {
          continue;
        }
        onEvent(evt);
      }
    }
    const last = buf.trim();
    if (last) {
      try {
        onEvent(JSON.parse(last));
      } catch {}
    }
  }
}

window.aiDAL = new AiDAL();
