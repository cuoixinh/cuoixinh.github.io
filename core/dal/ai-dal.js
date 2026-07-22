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
   * @param {{tone?:string, story_love?:string, info:string, region?:string,
   *          love_count?:number}} input  — `info` (BẮT BUỘC): dump thông tin tự do,
   *          GỒM tên cô dâu/chú rể, ngày & giờ cưới… để AI trích xuất; `story_love`:
   *          chuyện tình nguyên văn (text liền mạch, backend tự tách mốc).
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
   * Tối ưu (làm giàu) nội dung MỘT ô văn bản bằng AI.
   * Dùng chung Edge Function ai-invitation với `mode: "optimize"`; prompt do
   * `inputType` quyết định ở server.
   * @param {{inputType:string, text:string, tone?:string}} input
   *        inputType: slogan | rsvp | footer | love_story | timeline.
   * @returns {Promise<string>} văn bản đã tối ưu.
   */
  async optimizeText({ inputType, text, tone }) {
    const token = await this._token();
    const headers = {
      "Content-Type": "application/json",
      apikey: CONFIG.supabase.anonKey,
      Authorization: `Bearer ${token || CONFIG.supabase.anonKey}`,
    };

    const res = await fetch(this._url, {
      method: "POST",
      headers,
      body: JSON.stringify({ mode: "optimize", inputType, text, tone }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || "Không tối ưu được nội dung, vui lòng thử lại");
    return json.text || "";
  }

  /**
   * Tạo "Câu chuyện tình yêu": người dùng kể tự do → AI tách thành danh sách mốc.
   * Dùng chung Edge Function ai-invitation với `mode: "love_story"`.
   * @param {{text:string, tone?:string}} input
   * @returns {Promise<Array<{date:string,title:string,content:string}>>}
   */
  async generateLoveStory({ text, tone }) {
    const token = await this._token();
    const headers = {
      "Content-Type": "application/json",
      apikey: CONFIG.supabase.anonKey,
      Authorization: `Bearer ${token || CONFIG.supabase.anonKey}`,
    };

    const res = await fetch(this._url, {
      method: "POST",
      headers,
      body: JSON.stringify({ mode: "love_story", text, tone }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || "Không tạo được câu chuyện, vui lòng thử lại");
    return Array.isArray(json.items) ? json.items : [];
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
