// Bộ ô màu dùng chung cho "Thành phần thả lên thiệp". Danh mục ở
// core/helpers/element-helper.js khai báo `options` theo các khoá này, còn mỗi
// MẪU (variant) liệt kê trong `colors` những ô mà nó thật sự dùng — bảng điều
// chỉnh chỉ hiện đúng bấy nhiêu (thanh ngang đủ 4, nút tròn chỉ 2…).
//
// GIÁ TRỊ của mỗi khoá chính là tên trường lưu trong theme_setting.elements[].opts
// → đổi giá trị là mất màu người dùng đã chọn. Thêm khoá mới thì phải nới
// EL_COLOR_SLOTS và thêm một hàng chip trong invitation-setup/partials/theme-panel.html
// (Coloris chỉ bọc được input có sẵn trong DOM).
//
// Nạp TRƯỚC element-helper.js.

window.CX_EL_COLOR = {
  BG: "bg", // nền của cả widget
  TEXT: "fg", // tên bài, tên ca sĩ, chữ nói chung
  CTRL: "ctrl", // icon trong nút điều khiển (phát/dừng, tua)
  CTRL_BG: "accent", // nền nút điều khiển
};

window.CX_EL_COLOR_LABEL = {
  bg: "Nền",
  fg: "Văn bản",
  ctrl: "Nút điều khiển",
  accent: "Nền nút",
};
