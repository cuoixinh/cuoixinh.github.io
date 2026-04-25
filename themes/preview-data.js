// Preview data for wedding template
const previewData = {
  groomName: "Minh Tuấn",
  brideName: "Hương Giang",
  groomFullName: "Nguyễn Minh Tuấn",
  brideFullName: "Lê Hương Giang",
  groomFather: "Nguyễn Văn Hải",
  groomMother: "Trần Thị Lan",
  brideFather: "Lê Quang Minh",
  brideMother: "Phạm Thu Hà",
  ceremonyDate: "2024-12-15",
  ceremonyTime: "10:00",
  ceremonyLunar: "Ngày 15 tháng 11 năm Giáp Thìn",
  partyDate: "2024-12-15",
  partyTime: "18:00",
  partyLunar: "Ngày 15 tháng 11 năm Giáp Thìn",
  partyLocation: "Trung tâm Hội nghị Tiệc cưới Diamond",
  groomAddress: "123 Đường Lê Lợi, Quận 1, TP.HCM",
  brideAddress: "456 Đường Nguyễn Huệ, Quận 3, TP.HCM",
  groomBankName: "Vietcombank",
  groomBankNumber: "1234567890",
  groomBankOwner: "NGUYEN MINH TUAN",
  brideBankName: "Techcombank",
  brideBankNumber: "0987654321",
  brideBankOwner: "LE HUONG GIANG",
  groomQR: "../assets/images/qr-chu-re.png",
  brideQR: "../assets/images/qr-co-dau.png",
  coverImageUrl: "../assets/images/10-1.jpg",
  groomImageUrl: "../assets/images/chup-anh-cuoi-phong-cach-han-quoc-2.jpg",
  brideImageUrl: "../assets/images/chup-anh-cuoi-da-lat-phong-cach-han-quoc-005.jpg",
  storyQuote: "Tình yêu không làm cho thế giới quay tròn. Tình yêu là thứ làm cho chuyến đi đáng giá.",
  galleryImages: [
    "../assets/images/10-1.jpg",
    "../assets/images/chup-anh-cuoi-da-lat-phong-cach-han-quoc-005.jpg",
    "../assets/images/chup-anh-cuoi-phim-truong-12.jpg",
    "../assets/images/chup-anh-cuoi-phong-cach-han-quoc-2.jpg",
    "../assets/images/chup-anh-cuoi-trong-studio-o-da-nang-6.jpg"
  ],
  mapEmbedUrl: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3919.3193500642!2d106.69746931533417!3d10.782432192318482!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x31752f4b3330bcc9%3A0x5a8b2b3e5e5e5e5e!2zVHLGsOG7nW5nIMSQ4bqhaSBo4buNYyBLaG9hIGjhu41jIFThu7Egbmhpw6puIC0gxJDhuqFpIGjhu41jIFF14buRYyBnaWEgVFAuSENN!5e0!3m2!1svi!2s!4v1234567890123!5m2!1svi!2s",
  mapLink: "https://maps.google.com"
};

// Function to populate preview data - mimic renderWedding from script.js
function loadPreviewData() {
  // Create fake wedding object matching DB structure
  const w = {
    is_active: true,
    groom_name: previewData.groomName,
    bride_name: previewData.brideName,
    groom_father: previewData.groomFather,
    groom_mother: previewData.groomMother,
    bride_father: previewData.brideFather,
    bride_mother: previewData.brideMother,
    groom_address: previewData.groomAddress,
    bride_address: previewData.brideAddress,
    ceremony_date: previewData.ceremonyDate,
    ceremony_time: previewData.ceremonyTime,
    ceremony_lunar: previewData.ceremonyLunar,
    groom_party_date: previewData.partyDate,
    groom_party_time: previewData.partyTime,
    groom_party_lunar: previewData.partyLunar,
    groom_party_location: previewData.partyLocation,
    bride_party_date: previewData.partyDate,
    bride_party_time: previewData.partyTime,
    bride_party_lunar: previewData.partyLunar,
    bride_party_location: previewData.partyLocation,
    groom_bank_name: previewData.groomBankName,
    groom_bank_number: previewData.groomBankNumber,
    groom_bank_owner: previewData.groomBankOwner,
    bride_bank_name: previewData.brideBankName,
    bride_bank_number: previewData.brideBankNumber,
    bride_bank_owner: previewData.brideBankOwner,
    groom_qr_url: previewData.groomQR,
    bride_qr_url: previewData.brideQR,
    cover_image_url: previewData.coverImageUrl,
    groom_image_url: previewData.groomImageUrl,
    bride_image_url: previewData.brideImageUrl,
    story_quote: previewData.storyQuote,
    gallery_images: previewData.galleryImages,
    groom_map_embed_url: previewData.mapEmbedUrl,
    bride_map_embed_url: previewData.mapEmbedUrl,
    groom_map_link: previewData.mapLink,
    bride_map_link: previewData.mapLink
  };
  
  // Call renderWedding if it exists
  if (typeof renderWedding === 'function') {
    renderWedding(w);
    console.log('Preview data loaded via renderWedding');
  } else {
    console.error('renderWedding function not found');
  }
}

// Auto-load preview data when in preview mode
if (window.location.search.includes('preview=true')) {
  document.addEventListener('DOMContentLoaded', loadPreviewData);
}
