// Danh mục mẫu slide của trang /slide-cuoi/. Thêm mẫu = thư mục templates/<id>/
// (index.html + index.js + slide.css, chạy bằng runtime/slide-runtime.js) + một mục ở
// đây; `id` trùng tên thư mục, `ratio` = tỉ lệ khung xem mặc định (khớp CX_SLIDE.w/h của mẫu), `thumb` chụp từ chính slide
// bằng `npm run capture:slides -- <id>`. `ratios` (tuỳ chọn): các tỉ lệ khách chọn được — trang gửi
// `?ratio=<rộng>x<cao>` vào khung, mẫu tự đổi khổ + bố cục theo đó.
window.CX_SLIDE_TEMPLATES = [
  {
    id: "romantic-blush",
    name: "Mãi mãi về sau",
    desc: "Hồng pastel, mỗi cảnh một bố cục, ảnh bay từ ngoài vào",
    ratio: "16 / 9",
    thumb: "/slide-cuoi/templates/romantic-blush/thumb.jpg",
  },
  {
    id: "mai-ben-nhau",
    name: "Mãi Bên Nhau",
    desc: "Bố cục tạp chí, ảnh bay từ ngoài vào",
    ratio: "16 / 9",
    thumb: "/slide-cuoi/templates/mai-ben-nhau/thumb.jpg",
  },
  {
    id: "ngay-chung-doi",
    name: "Ngày Chung Đôi",
    desc: "Nền trắng tối giản, ảnh là chính, ít chữ",
    ratio: "16 / 9",
    ratios: ["16 / 9", "1 / 1"],
    thumb: "/slide-cuoi/templates/ngay-chung-doi/thumb.jpg",
  },
  {
    id: "tram-nam-hanh-phuc",
    name: "Trăm Năm Hạnh Phúc",
    desc: "Chỉ có ảnh, không chữ — ảnh phủ kín khung, ghép 2–3 ảnh mỗi màn",
    ratio: "16 / 9",
    ratios: ["16 / 9", "1 / 1"],
    thumb: "/slide-cuoi/templates/tram-nam-hanh-phuc/thumb.jpg",
  },
];
