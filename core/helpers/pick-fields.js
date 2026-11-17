// Danh mục cột sửa được bằng cách bấm lên thiệp (dải Xem trực tiếp, tab Xem trước):
// cột → [nhãn, bước của trang Thiết lập]. Dùng CHUNG cho thiệp (preview-pick.js, nhãn
// khi hover) và trang Thiết lập (js/29-preview-pick.js, nhảy tới ô). Cột không có ở đây
// thì bấm vào chỉ mở bước chứa mục đó.
const CX_PICK_FIELDS = {
  groom_name: ["Tên chú rể", "couple"],
  bride_name: ["Tên cô dâu", "couple"],
  story_quote: ["Câu mở đầu", "couple"],
  ceremony_name: ["Tên buổi lễ", "ceremony"],
  ceremony_date: ["Ngày lễ", "ceremony"],
  ceremony_time: ["Giờ lễ", "ceremony"],
  ceremony_location: ["Địa điểm lễ", "ceremony"],
  ceremony_map_embed_url: ["Bản đồ lễ", "ceremony"],
  vu_quy_date: ["Ngày vu quy", "ceremony"],
  vu_quy_time: ["Giờ vu quy", "ceremony"],
  vu_quy_location: ["Địa điểm vu quy", "ceremony"],
  vu_quy_map_embed_url: ["Bản đồ vu quy", "ceremony"],
  groom_father: ["Bố chú rể", "family"],
  groom_mother: ["Mẹ chú rể", "family"],
  groom_address: ["Địa chỉ nhà trai", "family"],
  bride_father: ["Bố cô dâu", "family"],
  bride_mother: ["Mẹ cô dâu", "family"],
  bride_address: ["Địa chỉ nhà gái", "family"],
  groom_party_date: ["Ngày tiệc nhà trai", "party"],
  groom_party_time: ["Giờ tiệc nhà trai", "party"],
  groom_party_location: ["Địa điểm tiệc nhà trai", "party"],
  groom_party_map_embed_url: ["Bản đồ tiệc nhà trai", "party"],
  bride_party_date: ["Ngày tiệc nhà gái", "party"],
  bride_party_time: ["Giờ tiệc nhà gái", "party"],
  bride_party_location: ["Địa điểm tiệc nhà gái", "party"],
  bride_party_map_embed_url: ["Bản đồ tiệc nhà gái", "party"],
  rsvp_message: ["Lời mời xác nhận", "rsvp"],
  groom_bank_name: ["Ngân hàng chú rể", "gift"],
  groom_bank_number: ["Số tài khoản chú rể", "gift"],
  groom_bank_owner: ["Chủ tài khoản chú rể", "gift"],
  bride_bank_name: ["Ngân hàng cô dâu", "gift"],
  bride_bank_number: ["Số tài khoản cô dâu", "gift"],
  bride_bank_owner: ["Chủ tài khoản cô dâu", "gift"],
  footer_text: ["Lời cảm ơn", "footer"],
  // Ảnh: bấm vào là hỏi Đổi ảnh / Chỉnh khung.
  cover_image_url: ["Ảnh bìa", "couple"],
  groom_image_url: ["Ảnh chú rể", "couple"],
  bride_image_url: ["Ảnh cô dâu", "couple"],
  groom_qr_url: ["Mã QR chú rể", "gift"],
  bride_qr_url: ["Mã QR cô dâu", "gift"],
  gallery_images: ["Ảnh trong album", "photos"],
};

// Cột ảnh đơn (một tấm) — gallery_images là mảng, xử lý riêng theo chỉ số.
const CX_PICK_IMAGES = ["cover_image_url", "groom_image_url", "bride_image_url", "groom_qr_url", "bride_qr_url"];

// Tên các bước (trùng CX_STEPS) — để nhãn của mục, kể cả mục bóng mờ đang tắt.
const CX_PICK_STEPS = {
  couple: "Cặp đôi",
  ceremony: "Sự kiện",
  family: "Gia đình",
  party: "Tiệc cưới",
  photos: "Ảnh cưới",
  timeline: "Lịch trình",
  love_story: "Chuyện tình yêu",
  rsvp: "Xác nhận dự",
  gift: "Hộp mừng",
  footer: "Lời cảm ơn",
};

window.CX_PICK_FIELDS = CX_PICK_FIELDS;
window.CX_PICK_IMAGES = CX_PICK_IMAGES;
window.CX_PICK_STEPS = CX_PICK_STEPS;
