// Danh mục mẫu slide của trang /tao-slide/. Thêm mẫu = thư mục templates/<id>/
// (index.html + index.js + slide.css, chạy bằng runtime/slide-runtime.js) + một mục ở
// đây; `id` trùng tên thư mục, `ratio` = tỉ lệ khung xem mặc định (khớp CX_SLIDE.w/h của mẫu), `thumb` chụp từ chính slide
// bằng `npm run capture:slides -- <id>`. `ratios` (tuỳ chọn): các tỉ lệ khách chọn được — trang gửi
// `?ratio=<rộng>x<cao>` vào khung, mẫu tự đổi khổ + bố cục theo đó. `youtube`: mã video demo khung
// ngang (11 ký tự sau `v=` hoặc sau `youtu.be/`) cho trang /mau-slide/ — để trống thì mẫu KHÔNG hiện ở
// đó. Tên mẫu đánh số "Mẫu NN" theo thứ tự ở đây; `id` (tên thư mục) giữ nguyên — là khoá chữ/ảnh/
// thời lượng khách đã lưu.
window.CX_SLIDE_TEMPLATES = [
  {
    id: "ngay-chung-doi",
    name: "Mẫu 01",
    desc: "Nền trắng tối giản, ảnh là chính, ít chữ",
    ratio: "16 / 9",
    ratios: ["16 / 9", "1 / 1", "9 / 16"],
    thumb: "/tao-slide/templates/ngay-chung-doi/thumb.jpg",
    youtube: "2otPa55zyLo",
  },
  {
    id: "romantic-blush",
    name: "Mẫu 02",
    desc: "Hồng pastel, mỗi cảnh một bố cục, ảnh bay từ ngoài vào",
    ratio: "16 / 9",
    ratios: ["16 / 9", "1 / 1", "9 / 16"],
    thumb: "/tao-slide/templates/romantic-blush/thumb.jpg",
    youtube: "",
  },
  {
    id: "mai-ben-nhau",
    name: "Mẫu 03",
    desc: "Bố cục tạp chí, ảnh bay từ ngoài vào",
    ratio: "16 / 9",
    ratios: ["16 / 9", "1 / 1", "9 / 16"],
    thumb: "/tao-slide/templates/mai-ben-nhau/thumb.jpg",
    youtube: "",
  },
  {
    id: "tram-nam-hanh-phuc",
    name: "Mẫu 04",
    desc: "Chỉ có ảnh, không chữ — ảnh phủ kín khung, ghép 2–3 ảnh mỗi màn",
    ratio: "16 / 9",
    ratios: ["16 / 9", "1 / 1", "9 / 16"],
    thumb: "/tao-slide/templates/tram-nam-hanh-phuc/thumb.jpg",
    youtube: "",
  },
];
