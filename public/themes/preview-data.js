// Preview data for wedding template
const today = new Date();
const ceremonyDate = new Date(today);
ceremonyDate.setDate(today.getDate() + 30);

const groomPartyDate = new Date(today);
groomPartyDate.setDate(today.getDate() + 29);

const bridePartyDate = new Date(today);
bridePartyDate.setDate(today.getDate() + 29);

const ceremonyDateStr = ceremonyDate.toISOString().split("T")[0];
const groomPartyDateStr = groomPartyDate.toISOString().split("T")[0];
const bridePartyDateStr = bridePartyDate.toISOString().split("T")[0];

const lunarYear = "Ất Tỵ";
function lunarStr(d) {
  return `Ngày ${d.getDate()} tháng ${d.getMonth() + 1} năm ${lunarYear}`;
}

// Nhận diện theme hiện tại từ URL (vd .../public/themes/romantic-gold/index.html)
// để biết thư mục assets/data-template/<theme>/ nào cần đọc.
function currentThemeName() {
  const m = window.location.pathname.match(/\/themes\/([^/]+)\//);
  return m ? m[1] : null;
}

// Đọc bộ dữ liệu mẫu (do admin tạo ở tab "Dữ liệu mẫu") cho theme hiện tại, nếu có.
// Trả về null nếu chưa có data.json (theme chưa được chuẩn bị dữ liệu mẫu) hoặc lỗi mạng —
// khi đó giữ nguyên ảnh + nội dung generic hardcode như trước.
async function loadThemeSampleImages() {
  const theme = currentThemeName();
  if (!theme) return null;
  try {
    const res = await fetch(`../../../assets/data-template/${theme}/data.json`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  }
}

// Đè các field ảnh của `w` bằng bộ ảnh mẫu (nếu có), build full path tới
// assets/data-template/<theme>/<filename> — getImageUrl() (core/utils.js) giữ
// nguyên các chuỗi bắt đầu bằng "../" nên không cần sửa gì ở phía render.
function applyThemeSampleImages(w, sample, theme) {
  if (!sample) return;
  const base = `../../../assets/data-template/${theme}`;
  const toPath = (filename) => `${base}/${filename}`;

  const focalPoints = {};
  ["cover_image_url", "groom_image_url", "bride_image_url"].forEach((field) => {
    if (sample[field]) {
      w[field] = toPath(sample[field]);
      if (sample.image_focal_points?.[field]) {
        focalPoints[field] = sample.image_focal_points[field];
      }
    }
  });
  ["groom_qr_url", "bride_qr_url"].forEach((field) => {
    if (sample[field]) w[field] = toPath(sample[field]);
  });

  if (Array.isArray(sample.gallery_images) && sample.gallery_images.length) {
    const galleryFocal = {};
    w.gallery_images = sample.gallery_images.map((filename) => {
      const fullPath = toPath(filename);
      // Key focal point theo full path đã map — data.json lưu key theo filename
      // gốc, nhưng renderer tra cứu bằng chính giá trị trong w.gallery_images.
      if (sample.image_focal_points?.gallery_images?.[filename]) {
        galleryFocal[fullPath] = sample.image_focal_points.gallery_images[filename];
      }
      return fullPath;
    });
    focalPoints.gallery_images = galleryFocal;
  }

  if (Array.isArray(sample.love_story) && sample.love_story.length) {
    w.love_story = sample.love_story.map((item) => ({
      ...item,
      image_url: item.image_url ? toPath(item.image_url) : item.image_url,
    }));
  }

  w.image_focal_points = focalPoints;
}

// Đè phần CHỮ (tên, ngày giờ, địa điểm, lịch trình, lời ngỏ, công tắc khối…).
// Admin chỉ ghi vào data.json những field đã nhập nên field trống vẫn giữ giá
// trị mặc định hardcode phía dưới — không cần đồng bộ danh sách field ở đây.
function applyThemeSampleContent(w, sample) {
  const content = sample?.content;
  if (!content || typeof content !== "object") return;
  Object.assign(w, content);

  // Ngày âm mặc định được tính từ ngày dương mặc định. Nếu mẫu đổi ngày dương
  // mà không kèm ngày âm thì bỏ trống, đừng hiện ngày âm của ngày khác.
  ["ceremony", "groom_party", "bride_party"].forEach((prefix) => {
    if (content[`${prefix}_date`] && !content[`${prefix}_lunar`]) {
      w[`${prefix}_lunar`] = "";
    }
  });
}

async function loadPreviewData() {
  // Ảnh mặc định khi theme CHƯA có bộ dữ liệu mẫu (assets/data-template/<theme>/):
  // khung xám có chữ do core/utils.js dựng, dạng data: URI nên getImageUrl() giữ
  // nguyên. ĐỪNG trỏ vào file ảnh trong repo — mẫu mới nào cũng sẽ ra ảnh vỡ.
  const ph = (label) =>
    typeof createPlaceholderSVG === "function" ? createPlaceholderSVG(label) : "";

  const w = {
    is_active: true,

    // --- Tên ---
    groom_name: "Quang Vinh",
    bride_name: "Hải Yến",

    // --- Gia đình ---
    groom_father: "Đoàn Văn Lối",
    groom_mother: "Trần Thị Kích",
    groom_address: "Chu Trần, Yên Lãng, Hà Nội",
    bride_father: "Vương Đức Bắc",
    bride_mother: "Nguyễn Thị Khuyên",
    bride_address: "Tân Trường, Mao Điền, Hải Phòng",

    // --- Ảnh ---
    cover_image_url: ph("Ảnh bìa"),
    groom_image_url: ph("Ảnh chú rể"),
    bride_image_url: ph("Ảnh cô dâu"),
    gallery_images: Array.from({ length: 6 }, (_, i) => ph(`Ảnh ${i + 1}`)),
    image_focal_points: {},

    // --- Lễ thành hôn ---
    ceremony_date: ceremonyDateStr,
    ceremony_time: "10:00",
    ceremony_lunar: lunarStr(ceremonyDate),
    ceremony_name: "Lễ Thành Hôn",
    ceremony_location: "Chu Trần, Yên Lãng, Hà Nội",
    ceremony_map_embed_url:
      "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3919.3193500642!2d106.69746931533417!3d10.782432192318482!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x31752f4b3330bcc9%3A0x5a8b2b3e5e5e5e5e!2zVHLGsOG7nW5nIMSQ4bqhaSBo4buNYyBLaG9hIGjhu41jIFThu7Egbmhpw6puIC0gxJDhuqFpIGjhu41jIFF14buRYyBnaWEgVFAuSENN!5e0!3m2!1svi!2s!4v1234567890123!5m2!1svi!2s",

    // --- Lễ vu quy ---
    vu_quy_enabled: true,
    vu_quy_time: "07:30",
    vu_quy_location: "Tư gia nhà gái — Tân Trường, Mao Điền, Hải Phòng",
    vu_quy_map_embed_url: "",

    // --- Tiệc nhà trai ---
    groom_party_date: groomPartyDateStr,
    groom_party_time: "18:00",
    groom_party_lunar: lunarStr(groomPartyDate),
    groom_party_location: "Chu Trần, Yên Lãng, Hà Nội",
    groom_party_show_location: true,
    groom_party_map_embed_url:
      "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d1860.0792782511846!2d105.64021153879186!3d21.1858593960541!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3134f9003f1b880d%3A0xeb883682aa3cee03!2zTmjDoCBWxINuIEjDs2EgVGjDtG4gQ2h1IFRy4bqnbg!5e0!3m2!1svi!2s!4v1781110640086!5m2!1svi!2s",

    // --- Tiệc nhà gái ---
    bride_party_date: bridePartyDateStr,
    bride_party_time: "17:00",
    bride_party_lunar: lunarStr(bridePartyDate),
    bride_party_location: "Tư gia nhà gái — Tân Trường, Mao Điền, Hải Phòng",
    bride_party_show_location: true,
    bride_party_map_embed_url:
      "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3726.334193161438!2d106.21554367596814!3d20.939090290851034!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3135990067a39f47%3A0x1b851f047c539be6!2zRklUQ0FSRUUgMjkwIC0gSOG7hyBUaOG7kW5nIFBow7JuZyBU4bqtcCBLaeG7g20gU2_DoXQgQ8OibiBO4bq3bmc!5e0!3m2!1svi!2s!4v1781109650680!5m2!1svi!2s",

    // --- Lịch trình ---
    timeline: [
      // Ngày trước: tiệc cưới buổi tối
      { time: "14:30", title: "Trang trí & chuẩn bị tiệc", type: "bride-party" },
      { time: "15:00", title: "Đón khách, chụp ảnh lưu niệm", type: "bride-party" },
      { time: "16:00", title: "Check-in, nhận quà mừng", type: "bride-party" },
      { time: "17:00", title: "Khai tiệc & dùng bữa", type: "bride-party" },
      { time: "19:00", title: "Cảm ơn & tiễn khách", type: "bride-party" },
      { time: "15:00", title: "Đón khách, chụp ảnh lưu niệm", type: "party" },
      { time: "16:00", title: "Check-in, nhận quà mừng", type: "party" },
      { time: "17:30", title: "Khai tiệc, phát biểu", type: "party" },
      { time: "18:00", title: "Dùng tiệc mừng cưới", type: "party" },
      { time: "20:00", title: "Cảm ơn & tiễn khách", type: "party" },
      // Ngày lễ chính: sáng hôm sau
      { time: "06:00", title: "Cô dâu trang điểm & chuẩn bị", type: "ceremony" },
      { time: "07:30", title: "Lễ vu quy tại nhà gái", type: "ceremony" },
      { time: "08:00", title: "Đoàn nhà trai xuất phát đón dâu", type: "ceremony" },
      { time: "09:00", title: "Lễ đón dâu tại nhà gái", type: "ceremony" },
      { time: "10:00", title: "Lễ thành hôn tại hội trường", type: "ceremony" },
      { time: "11:30", title: "Tiệc trưa mừng lễ thành hôn", type: "ceremony" },
    ],

    // --- Câu chuyện tình yêu ---
    love_story: [
      {
        date: "03/2019",
        title: "Lần đầu gặp nhau",
        content:
          "Chúng mình gặp nhau lần đầu tại một buổi tiệc của bạn chung. Ánh mắt đầu tiên đó mãi không quên.",
        image_url: ph("Ảnh kỷ niệm"),
      },
      {
        date: "08/2019",
        title: "Chính thức hẹn hò",
        content:
          'Sau nhiều lần cà phê, anh đã dũng cảm hỏi: "Em có muốn làm bạn gái anh không?"',
        image_url: ph("Ảnh kỷ niệm"),
      },
      {
        date: "12/2022",
        title: "Cầu hôn",
        content:
          "Dưới bầu trời đêm đầy sao tại Đà Lạt, anh quỳ xuống và trao cho em chiếc nhẫn nhỏ xinh cùng câu hỏi quan trọng nhất đời.",
        image_url: ph("Ảnh kỷ niệm"),
      },
      {
        date: "2025",
        title: "Về chung một nhà",
        content:
          "Hành trình mới bắt đầu — cùng nhau viết tiếp những trang đẹp nhất của cuộc đời.",
        image_url: ph("Ảnh kỷ niệm"),
      },
    ],

    // --- QR / Ngân hàng ---
    groom_bank_name: "Vietcombank",
    groom_bank_number: "0123456789",
    groom_bank_owner: "DOAN QUANG VINH",
    groom_qr_url: ph("QR chú rể"),
    bride_bank_name: "Techcombank",
    bride_bank_number: "0987654321",
    bride_bank_owner: "VUONG THI HAI YEN",
    bride_qr_url: ph("QR cô dâu"),

    // --- RSVP ---
    rsvp_enabled: true,
    rsvp_message: "Sự có mặt của bạn là món quà ý nghĩa nhất với chúng mình.",

    // --- Slogan ---
    story_quote:
      "Cảm ơn em đã đến bên đời nhau, cùng nhau viết nên câu chuyện của riêng chúng ta.",

    // --- Footer ---
    footer_text:
      "Trân trọng cảm ơn sự hiện diện của quý khách. Sự có mặt của bạn là niềm vinh hạnh lớn nhất của chúng tôi.",

    // --- Nhạc ---
    music_url: "https://www.youtube.com/watch?v=06-XXOTP3Gc",

    // --- Section visibility (tất cả bật cho preview) ---
    enable_family: true,
    enable_party: true,
    enable_photos: true,
    enable_timeline: true,
    enable_love_story: true,
    enable_music: true,
    enable_gift: true,
    enable_footer: true,
  };

  const theme = currentThemeName();
  const sample = theme ? await loadThemeSampleImages() : null;
  if (sample) {
    applyThemeSampleImages(w, sample, theme);
    applyThemeSampleContent(w, sample);
  }

  if (typeof renderWedding === "function") {
    renderWedding(w);
  } else {
    console.error("renderWedding function not found");
  }
}

// Auto-load preview data when in preview mode
if (window.location.search.includes("preview=true")) {
  document.addEventListener("DOMContentLoaded", () => {
    // Live preview: dùng data thật từ sessionStorage
    if (window.location.search.includes("source=live")) {
      const raw = sessionStorage.getItem("preview_data");
      if (raw) {
        try {
          const data = JSON.parse(raw);
          if (typeof renderWedding === "function") {
            if (typeof applyThemeSetting === "function") {
              applyThemeSetting(data.theme_setting);
            }
            renderWedding(data);
            // Áp nội dung text đã sửa (sau render)
            if (typeof applyTextOverrides === "function") {
              applyTextOverrides(data.theme_setting);
            }
            if (typeof applyCustomBlocks === "function") {
              applyCustomBlocks(data.theme_setting);
            }
            if (typeof applyDecorations === "function") {
              applyDecorations(data.theme_setting);
            }
            if (typeof applyElements === "function") {
              applyElements(data.theme_setting);
            }
            return;
          }
        } catch (e) {}
      }
    }
    // Default: dùng data fake
    loadPreviewData();
  });
}
