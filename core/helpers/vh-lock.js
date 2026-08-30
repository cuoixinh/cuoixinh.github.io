// Khoá chiều cao "một màn" thành px, ghi vào --vh (1% khung nhìn). Tự chạy khi
// nạp; trang nào cần khối cao-một-màn đứng yên thì chỉ việc thêm thẻ script.
//
// Không dùng được đơn vị viewport của CSS cho việc này: Chrome/trình duyệt
// in-app trên iOS ẩn/hiện thanh công cụ bằng cách RESIZE cả webview, nên với
// trang web đó là một lần đổi khổ cửa sổ thật — svh/lvh/dvh đều tính lại theo,
// khối cao-một-màn cao dần lúc vuốt và ảnh phủ trong đó giật theo từng khung.
// Chỉ px đo sẵn mới đứng yên.
//
// Lấy giá trị NHỎ NHẤT thấy được ở mỗi bề ngang — tức lúc thanh công cụ đang
// hiện đủ, đúng bằng svh — nên chiều cao chỉ có thể co lại một lần rồi ổn định,
// không bao giờ phình ra giữa lúc vuốt. Đổi bề ngang (xoay máy) thì đo lại từ đầu.
//
// CÁCH DÙNG trong CSS — luôn kèm đơn vị dự phòng cho lúc script chưa chạy:
//   min-height: calc(var(--vh, 1vh) * 100);   /* trình duyệt chưa hiểu svh */
//   min-height: calc(var(--vh, 1svh) * 100);  /* thứ tự sau nên thắng */
// ĐỪNG khai thêm một dòng `100svh`/`100dvh` trần sau đó: nó đè mất --vh, và
// dvh thì phình ra đúng lúc thanh công cụ ẩn — cái mà file này sinh ra để tránh.

(function () {
  let vhWidth = 0;
  let vhPx = 0;

  // Đo `100svh` ra px bằng một thẻ dò rồi bỏ đi. Trả 0 nếu trình duyệt chưa
  // hiểu svh (lúc đó nơi gọi lùi về `innerHeight`).
  //
  // Cần thứ này vì `innerHeight` NGAY LÚC TRANG MỞ không chắc là khung nhìn lúc
  // thanh công cụ đang hiện: mở thiệp từ trang chủ là chuyển trang sau khi đã
  // cuộn, mà Chrome/Safari di động giữ nguyên trạng thái thanh ĐANG ẨN sang
  // trang mới → đo được khung CAO (lvh) rồi khoá luôn vào --vh. `svh` không phụ
  // thuộc trạng thái đó, nên lấy min(innerHeight, svh) là ra ngay con số đúng.
  function measureSvh() {
    if (!window.CSS?.supports?.("height", "100svh")) return 0;
    const probe = document.createElement("div");
    probe.style.cssText =
      "position:fixed;top:0;left:0;width:0;height:100svh;visibility:hidden;pointer-events:none;";
    const host = document.body || document.documentElement;
    host.appendChild(probe);
    const h = probe.getBoundingClientRect().height;
    probe.remove();
    return h;
  }

  function setVH() {
    const doc = document.documentElement;
    const w = window.innerWidth;
    const h = window.innerHeight;
    // Trong iframe (khung xem trước ở trang Thiết lập) khổ do trang cha đặt và
    // không có thanh công cụ nào ẩn/hiện → mọi thay đổi chiều cao đều là thật.
    if (window.self !== window.top) {
      doc.style.setProperty("--vh", `${h * 0.01}px`);
      return;
    }
    if (w !== vhWidth) {
      // Chỉ đo svh ở nhánh này (lần đầu + xoay máy): thanh công cụ ẩn/hiện không
      // đổi svh, mà resize thì bắn liên tục lúc vuốt — đo mỗi nhịp là ép layout
      // đúng lúc cần mượt nhất.
      vhWidth = w;
      const svh = measureSvh();
      vhPx = svh ? Math.min(h, svh) : h;
    } else if (h < vhPx) {
      vhPx = h;
    } else {
      return;
    }
    doc.style.setProperty("--vh", `${vhPx * 0.01}px`);
  }

  // Nạp hai lần (lỡ thêm thẻ script ở hai chỗ) thì bỏ qua lần sau.
  if (window.cxVhLocked) return;
  window.cxVhLocked = true;
  setVH();
  window.addEventListener("resize", setVH, { passive: true });
})();
