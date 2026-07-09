/**
 * AiDAL — gọi Edge Function ai-invitation để sinh nội dung thiệp bằng AI.
 * KHÔNG bắt buộc đăng nhập: nếu đã đăng nhập thì đính JWT (rate-limit theo user),
 * chưa đăng nhập vẫn dùng được (rate-limit theo IP ở phía server).
 */
class AiDAL {
  constructor() {
    this._url = CONFIG.supabase.aiInvitationUrl;
  }

  /** Lấy access token của phiên hiện tại (null nếu chưa đăng nhập). */
  async _token() {
    const sb = window.AuthUI?.supabase;
    if (!sb) return null;
    try {
      const { data } = await sb.auth.getSession();
      return data?.session?.access_token ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Sinh nội dung thiệp.
   * @param {{groom_name:string, bride_name:string, wedding_date?:string,
   *          tone?:"romantic"|"traditional"|"humorous", bullets?:string[],
   *          info?:string}} input  — `info`: dump thông tin cá nhân tự do để AI trích xuất.
   * @returns {Promise<{story_quote:string, love_story:Array, timeline:Array, fields:Object}>}
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
      body: JSON.stringify(input),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || "Không tạo được nội dung, vui lòng thử lại");
    return json.data;
  }

  /**
   * Sinh nội dung dạng STREAMING: server trả NDJSON, mỗi dòng là một sự kiện.
   * @param {object} input  — như generateInvitation.
   * @param {(evt:{block?:object, full?:object, meta?:object})=>void} onEvent
   *        block: 1 block sạch; full: kết quả đầy đủ (fallback Groq); meta: {done,provider} | {error}.
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
      body: JSON.stringify({ ...input, stream: true }),
    });

    if (!res.ok || !res.body) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j.error || "Không tạo được nội dung, vui lòng thử lại");
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
