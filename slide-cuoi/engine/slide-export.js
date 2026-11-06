// Xuất slide ra MP4 ngay trên trình duyệt: vẽ từng khung bằng CÙNG bộ vẽ của bản xem
// (CXSlideEngine.frame) ở khổ 1080p/4K, mã hoá H.264 bằng WebCodecs (phần cứng nếu có),
// ghép MP4 bằng vendor/mp4-muxer.js. Nhạc chỉ ghép được khi là FILE (mp3…) — YouTube không
// lấy được luồng tiếng. Toàn bộ chạy trên máy khách, không gửi gì lên server.

window.CXSlideExport = (() => {
  const SIZES = {
    1080: { w: 1920, h: 1080, bitrate: 8e6, codecs: ["avc1.640028", "avc1.4d0028", "avc1.42e028"] },
    2160: { w: 3840, h: 2160, bitrate: 16e6, codecs: ["avc1.640033", "avc1.4d0033", "avc1.640034"] },
  };
  const FPS = 30;
  const AUDIO_RATE = 48000;

  const supported = () => typeof VideoEncoder === "function" && typeof VideoFrame === "function";

  // Codec H.264 đầu tiên máy mã hoá được ở khổ này; null = không xuất được khổ đó.
  async function pickCodec(height) {
    if (!supported()) return null;
    const S = SIZES[height];
    for (const codec of S.codecs) {
      const cfg = { codec, width: S.w, height: S.h, bitrate: S.bitrate, framerate: FPS, avc: { format: "avc" } };
      try {
        if ((await VideoEncoder.isConfigSupported(cfg)).supported) return cfg;
      } catch (e) {}
    }
    return null;
  }

  // Nhường luồng chính một nhịp — qua MessageChannel vì setTimeout bị bóp khi tab ẩn.
  const _yield = () => new Promise((r) => {
    const ch = new MessageChannel();
    ch.port1.onmessage = () => r();
    ch.port2.postMessage(0);
  });

  // Nhạc file → PCM 48kHz stereo dài đúng `seconds`: lặp nếu bài ngắn, mờ vào/ra 1.5 giây.
  // `from` là URL cùng gốc hoặc Blob — file khách tải lên phải đưa thẳng Blob: CSP chặn fetch
  // URL `blob:` (connect-src không có blob:).
  async function _pcm(from, seconds) {
    const buf = from instanceof Blob ? await from.arrayBuffer() : await (await fetch(from)).arrayBuffer();
    const frames = Math.ceil(seconds * AUDIO_RATE);
    const off = new OfflineAudioContext(2, frames, AUDIO_RATE);
    const decoded = await off.decodeAudioData(buf);
    const src = off.createBufferSource();
    src.buffer = decoded;
    src.loop = true;
    const gain = off.createGain();
    const f = Math.min(1.5, seconds / 4);
    gain.gain.setValueAtTime(0, 0);
    gain.gain.linearRampToValueAtTime(1, f);
    gain.gain.setValueAtTime(1, Math.max(f, seconds - f));
    gain.gain.linearRampToValueAtTime(0, seconds);
    src.connect(gain).connect(off.destination);
    src.start(0);
    return off.startRendering();
  }

  // Mã tiếng: AAC trước (phát được ở mọi nơi). Máy không có bộ mã AAC (Chromium mã nguồn mở,
  // Firefox, Chrome trên Linux…) thì Opus — MP4 mang Opus phát được trên Chrome, Firefox, VLC,
  // Android. Trả {cfg cho AudioEncoder, mux: tên codec cho mp4-muxer} hoặc null.
  const _AUDIO = [
    { codec: "mp4a.40.2", mux: "aac", bitrate: 160000 },
    { codec: "opus", mux: "opus", bitrate: 128000 },
  ];
  async function _audioCfg() {
    if (typeof AudioEncoder !== "function") return null;
    for (const a of _AUDIO) {
      const cfg = { codec: a.codec, sampleRate: AUDIO_RATE, numberOfChannels: 2, bitrate: a.bitrate };
      try {
        if ((await AudioEncoder.isConfigSupported(cfg)).supported) return { cfg, mux: a.mux };
      } catch (e) {}
    }
    return null;
  }

  // opts: { height: 1080|2160, audioUrl (URL hoặc Blob nhạc), signal, onProgress(p 0..1),
  // onAudio({ok, reason: "codec"|"decode"|""}) — báo trước khi mã hoá: có ghép được tiếng không } → Blob MP4.
  async function run(P, opts) {
    const vcfg = await pickCodec(opts.height);
    if (!vcfg) throw Object.assign(new Error("Máy này không mã hoá được video khổ này"), { code: "UNSUPPORTED" });
    const S = SIZES[opts.height];

    // Nhạc (nếu có và máy mã hoá được tiếng). Hỏng thì xuất video không tiếng, không dừng cả việc.
    let pcm = null;
    let audio = null;
    if (opts.audioUrl) {
      audio = await _audioCfg();
      if (audio) pcm = await _pcm(opts.audioUrl, P.total).catch(() => null);
      opts.onAudio?.({ ok: !!(audio && pcm), reason: !audio ? "codec" : !pcm ? "decode" : "" });
      if (!pcm) audio = null;
    }
    const acfg = audio?.cfg || null;

    const muxer = new Mp4Muxer.Muxer({
      target: new Mp4Muxer.ArrayBufferTarget(),
      video: { codec: "avc", width: S.w, height: S.h, frameRate: FPS },
      audio: audio ? { codec: audio.mux, numberOfChannels: 2, sampleRate: AUDIO_RATE } : undefined,
      fastStart: "in-memory",
    });

    let fail = null;
    const venc = new VideoEncoder({
      output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
      error: (e) => (fail = e),
    });
    venc.configure({ ...vcfg, latencyMode: "quality" });

    const canvas = document.createElement("canvas");
    canvas.width = S.w;
    canvas.height = S.h;
    const ctx = canvas.getContext("2d", { alpha: false });

    const frames = Math.ceil(P.total * FPS);
    const step = 1e6 / FPS;
    try {
      for (let i = 0; i < frames; i++) {
        if (opts.signal?.aborted) throw Object.assign(new Error("Đã huỷ"), { code: "ABORTED" });
        if (fail) throw fail;
        CXSlideEngine.frame(ctx, P, i / FPS);
        const vf = new VideoFrame(canvas, { timestamp: Math.round(i * step), duration: Math.round(step) });
        venc.encode(vf, { keyFrame: i % (FPS * 2) === 0 });
        vf.close();
        // Giữ hàng đợi bộ mã hoá ngắn: dồn khung 4K là đầy bộ nhớ.
        while (venc.encodeQueueSize > 4) await new Promise((r) => setTimeout(r, 4));
        if (i % 6 === 0) {
          opts.onProgress?.((i / frames) * (acfg ? 0.95 : 1));
          await _yield();
        }
      }
      await venc.flush();
      if (fail) throw fail;

      if (acfg) {
        const aenc = new AudioEncoder({
          output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
          error: (e) => (fail = e),
        });
        aenc.configure(acfg);
        const total = pcm.length;
        const L = pcm.getChannelData(0);
        const R = pcm.getChannelData(1);
        const SLICE = AUDIO_RATE; // 1 giây một lần đưa vào
        for (let at = 0; at < total; at += SLICE) {
          const n = Math.min(SLICE, total - at);
          const data = new Float32Array(n * 2);
          data.set(L.subarray(at, at + n), 0);
          data.set(R.subarray(at, at + n), n);
          const ad = new AudioData({
            format: "f32-planar",
            sampleRate: AUDIO_RATE,
            numberOfFrames: n,
            numberOfChannels: 2,
            timestamp: Math.round((at / AUDIO_RATE) * 1e6),
            data,
          });
          aenc.encode(ad);
          ad.close();
        }
        await aenc.flush();
        aenc.close();
        if (fail) throw fail;
      }
    } finally {
      if (venc.state !== "closed") venc.close();
    }

    muxer.finalize();
    opts.onProgress?.(1);
    return new Blob([muxer.target.buffer], { type: "video/mp4" });
  }

  // Mã tiếng máy này dùng được khi xuất: "aac" · "opus" · "" (không ghép được tiếng).
  const audioCodec = async () => (await _audioCfg())?.mux || "";

  return { supported, pickCodec, audioCodec, run, FPS };
})();
