// Danh mục mẫu slide của trang /slide-cuoi/. Thêm mẫu = thư mục templates/<id>/
// (index.html + index.js + slide.css, chạy bằng runtime/slide-runtime.js) + một mục ở
// đây; `id` trùng tên thư mục, `ratio` = tỉ lệ khung xem (khớp CX_SLIDE.w/h của mẫu), `thumb` chụp từ chính slide
// bằng `npm run capture:slides -- <id>`.
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
];
