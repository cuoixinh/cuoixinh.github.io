/**
 * AiChatDAL — gọi Edge Function ai-chat (Trợ lý AI). Không bắt buộc
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
   * tin cuối phải là của khách; server tự cắt bớt lượt cũ. `card` là thông tin thiệp
   * đã thu được ở các lượt trước (server nhắc lại cho model để nó khỏi hỏi lại).
   *
   * opts.onDelta(text) — mỗi mảnh chữ mới (text = TOÀN BỘ câu tính tới lúc này).
   * opts.onPhase("card") — model đang dựng nội dung thiệp, phần còn lại còn chảy
   *   thêm cả chục giây; dùng để đổi hiệu ứng chờ.
   * opts.signal — huỷ khi khách đóng bảng chat giữa chừng.
   *
   * Trả { text, known, card }: `text` là câu trả lời đầy đủ (bản đã làm sạch của
   * server), `known` là thông tin thiệp gom được tới lúc này (gửi lại ở lượt sau),
   * `card` là nội dung thiệp đã sẵn sàng đổ vào form hoặc null nếu còn đang hỏi.
   */
  async ask(messages, card, opts = {}) {
    const { onDelta, onPhase, signal } = opts;
    const res = await fetch(this._url, {
      method: "POST",
      headers: await this._headers(),
      signal,
      body: JSON.stringify({
        // Chỉ gửi lời nói: mục lịch sử còn đính cả object thiệp (vài KB) mà server
        // không đọc tới, gửi kèm là phình request mỗi lượt.
        messages: (messages || []).map((m) => ({ role: m.role, content: m.content })),
        card: card || null,
        stream: true,
      }),
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
    let finalKnown = null;
    let finalCard = null;

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
      if (evt.phase) onPhase?.(evt.phase);
      if (evt.meta?.error) throw new Error(evt.meta.error);
      if (evt.meta?.done) {
        final = evt.meta.text || shown;
        finalKnown = evt.meta.known || null;
        finalCard = evt.meta.card || null;
      }
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
    return { text, known: finalKnown, card: finalCard };
  }
}

window.aiChatDAL = new AiChatDAL();
