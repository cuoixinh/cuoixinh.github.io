/**
 * AiChatDAL — gọi Edge Function ai-chat (Trợ lý AI ở trang chủ). Không bắt buộc
 * đăng nhập: đã đăng nhập thì đính JWT (hạn mức theo user), chưa thì server tính
 * theo IP. Server trả NDJSON để chữ chạy dần.
 */
class AiChatDAL {
  constructor() {
    this._url = CONFIG.supabase.aiChatUrl;
  }

  /** Header chung: anon key để qua gateway Supabase, Bearer JWT nếu đã đăng nhập. */
  async _headers() {
    const token = (await window.CXAuth?.accessToken()) ?? null;
    return {
      "Content-Type": "application/json",
      apikey: CONFIG.supabase.anonKey,
      Authorization: `Bearer ${token || CONFIG.supabase.anonKey}`,
    };
  }

  /**
   * Hỏi trợ lý. `messages` là cả đoạn hội thoại [{role:"user"|"assistant", content}],
   * tin cuối phải là của khách; server tự cắt bớt lượt cũ.
   * onDelta(text) được gọi mỗi mảnh chữ mới. Trả về câu trả lời ĐẦY ĐỦ (bản đã
   * làm sạch của server) để lưu vào lịch sử.
   * `signal` để huỷ khi khách đóng bảng chat giữa chừng.
   */
  async ask(messages, onDelta, signal) {
    const res = await fetch(this._url, {
      method: "POST",
      headers: await this._headers(),
      signal,
      body: JSON.stringify({ messages, stream: true }),
    });

    if (!res.ok || !res.body) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j.error || "Trợ lý đang bận, bạn thử lại sau ít phút nhé.");
    }

    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    let shown = "";
    let final = "";

    const handle = (line) => {
      let evt;
      try {
        evt = JSON.parse(line);
      } catch {
        return;
      }
      if (evt.delta) {
        shown += evt.delta;
        onDelta?.(shown);
      }
      if (evt.meta?.error) throw new Error(evt.meta.error);
      if (evt.meta?.done) final = evt.meta.text || shown;
    };

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let nl;
      while ((nl = buf.indexOf("\n")) !== -1) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (line) handle(line);
      }
    }
    if (buf.trim()) handle(buf.trim());

    const text = (final || shown).trim();
    if (!text) throw new Error("Trợ lý chưa trả lời được, bạn hỏi lại giúp mình nhé.");
    return text;
  }
}

window.aiChatDAL = new AiChatDAL();
