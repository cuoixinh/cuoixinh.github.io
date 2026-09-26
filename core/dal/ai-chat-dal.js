/**
 * AiChatDAL — gọi Edge Function ai-chat (Trợ lý XuXi). Không bắt buộc
 * đăng nhập: đã đăng nhập thì đính JWT (hạn mức theo user), chưa thì server đếm
 * theo IP + mã thiết bị (core/helpers/device-id.js). Server trả NDJSON để chữ
 * chạy dần.
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
   * Hỏi XuXi. `messages` là cả đoạn hội thoại [{role:"user"|"assistant", content}],
   * tin cuối phải là của khách; server tự cắt bớt lượt cũ. `card` là thông tin thiệp
   * đã thu được ở các lượt trước (server nhắc lại cho model để nó khỏi hỏi lại).
   *
   * opts.onDelta(text) — mỗi mảnh chữ mới (text = TOÀN BỘ câu tính tới lúc này).
   * opts.onPhase("card" | "edit") — model đang dựng / viết lại nội dung thiệp, phần còn
   *   lại còn chảy thêm cả chục giây; dùng để đổi hiệu ứng chờ.
   * opts.signal — huỷ khi khách đóng bảng chat giữa chừng.
   * opts.media — tóm tắt ảnh/nhạc/bản đồ/mẫu đang có (CXChatMedia.summary()).
   * opts.build — khách đã đi hết các ô chọn sau lượt "ready": lượt này phải dựng thiệp.
   * opts.ready — đã có lượt "ready" trước đó (khách đã được mời chọn mẫu/ảnh/nhạc/bản đồ);
   *   chưa có thì server không cho model nhảy sang lượt dựng thiệp.
   * opts.mode — "qa" (hỏi đáp) | "create" (tạo/sửa thiệp): server chọn loại prompt theo đây.
   * opts.current — phần sáng tạo của thiệp đang có ({story_quote, love_story, timeline});
   *   có nó là lượt SỬA thiệp, server chỉ trả phần thay đổi.
   *
   * Trả { text, known, card, patch, ask, ready, mode }: `text` là câu trả lời đầy đủ (bản
   * đã làm sạch của server), `known` là thông tin thiệp gom được tới lúc này (gửi lại ở
   * lượt sau), `card` là nội dung thiệp ĐẦY ĐỦ đã sẵn sàng đổ vào form hoặc null nếu
   * còn đang hỏi, `patch` là phần vừa đổi ở lượt sửa, `ask` là ô chọn cần mở dưới câu
   * trả lời ("" = không mở), `ready` = vừa thu đủ thông tin (bắt đầu dẫn qua các ô
   * chọn), `mode` là chế độ server đã chạy ("create" khi vừa tự chuyển từ hỏi đáp).
   */
  async ask(messages, card, opts = {}) {
    const { onDelta, onPhase, signal, media, build, ready, mode, current } = opts;
    const res = await fetch(this._url, {
      method: "POST",
      headers: await this._headers(),
      signal,
      body: JSON.stringify({
        // Chỉ gửi lời nói: mục lịch sử còn đính cả object thiệp (vài KB) mà server
        // không đọc tới, gửi kèm là phình request mỗi lượt.
        messages: (messages || []).map((m) => ({ role: m.role, content: m.content })),
        card: card || null,
        media: media || null,
        device: window.cxDeviceId?.() || "",
        build: build === true,
        ready: ready === true,
        mode: mode || "qa",
        current: current || null,
        stream: true,
      }),
    });

    if (!res.ok || !res.body) {
      const j = await res.json().catch(() => ({}));
      const err = new Error(j.error || "XuXi đang bận, bạn thử lại sau ít phút nhé.");
      // Hết lượt AI khi chưa đăng nhập: UI mời đăng nhập thay vì báo lỗi suông.
      if (j.login) err.needLogin = true;
      throw err;
    }

    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    let shown = "";
    let final = "";
    let finalKnown = null;
    let finalCard = null;
    let finalAsk = "";
    let finalReady = false;
    let finalPatch = null;
    let finalMode = "";

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
        finalAsk = evt.meta.ask || "";
        finalReady = evt.meta.ready === true;
        finalPatch = evt.meta.patch || null;
        finalMode = evt.meta.mode || "";
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
    if (!text) throw new Error("XuXi chưa trả lời được, bạn hỏi lại giúp mình nhé.");
    return {
      text,
      known: finalKnown,
      card: finalCard,
      patch: finalPatch,
      ask: finalAsk,
      ready: finalReady,
      mode: finalMode,
    };
  }
}

window.aiChatDAL = new AiChatDAL();
