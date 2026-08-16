const http = require("http");
const { captureAll } = require("./capture");

const PORT = 3001;

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") { res.writeHead(204).end(); return; }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  // GET /scan?templates=name1,name2 — SSE stream chụp ảnh
  if (url.pathname === "/scan" && req.method === "GET") {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.writeHead(200);

    const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

    // Lọc theo danh sách được chọn (nếu có)
    const rawParam = url.searchParams.get("templates");
    const selected = rawParam
      ? rawParam.split(",").map((s) => s.trim()).filter(Boolean)
      : null;

    send({ type: "start", message: "Bắt đầu quét..." });

    captureAll((msg) => send({ type: "progress", message: msg }), selected)
      .then((results) => {
        // Mẫu khai CX_THEME.noScan không tính vào tổng — nó không phải việc
        // thất bại, mà là việc cố ý không làm.
        const skipped = results.filter((r) => r.skipped).length;
        const ok = results.filter((r) => r.ok && !r.skipped).length;
        const total = results.length - skipped;
        send({
          type: "done",
          message: `Hoàn thành: ${ok}/${total} ảnh${skipped ? ` (bỏ qua ${skipped})` : ""}.`,
          results,
        });
        res.end();
      })
      .catch((err) => {
        send({ type: "error", message: err.message });
        res.end();
      });

    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" }).end(JSON.stringify({ error: "Not found" }));
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Scan server chạy tại http://127.0.0.1:${PORT}`);
  console.log(`  GET /scan?templates=a,b  — chụp ảnh (bỏ param = chụp tất cả)`);
});
