// Danh sách "Tại sao chọn Cưới Xinh?" (#benefits): mỗi mục một hàng icon + chữ.
// Màu icon lấy theo VỊ TRÍ (--info-N-rgb ở styles/_colors.css), thêm mục phải thêm
// token. `featured` bật nhãn "Nổi bật"; `img: true` = icon ẢNH của core/helpers/icon.js
// (logo XuXi) thay cho glyph lucide. Hình hàng: .bnf-* ở styles/tailwind-src.css.

const BENEFITS_DATA = [
  { icon: "xuxi", img: true, title: "Trợ lý XuXi viết nội dung giúp bạn", desc: "Kể vài dòng về hai bạn, XuXi soạn luôn lời mời và chuyện tình yêu — không phải nghĩ câu chữ.", featured: true  },
  { icon: "user-check",   title: "Cá nhân hóa tên từng khách mời",       desc: "Mỗi khách nhận link thiệp riêng với tên gọi cá nhân — tạo cảm giác trân trọng và đặc biệt.",   featured: true  },
  { icon: "credit-card",  title: "Thanh toán một lần — dùng trọn đời",   desc: "Không phí hàng tháng, không giới hạn thời gian. Một lần thanh toán, sở hữu thiệp mãi mãi.",     featured: true  },
  { icon: "share-2",      title: "Chia sẻ link không giới hạn lượt xem", desc: "Gửi qua Zalo, Facebook, SMS… thiệp luôn mở được, không hết hạn, không giới hạn khách.",        featured: false },
  { icon: "refresh-cw",   title: "Sửa nội dung miễn phí trọn đời",       desc: "Đổi mẫu thoải mái lúc dựng thiệp. Thanh toán xong, nội dung và ảnh vẫn sửa miễn phí.",          featured: false },
  { icon: "images",       title: "Album ảnh & nhạc nền lãng mạn",        desc: "Tải ảnh cưới, chọn nhạc nền yêu thích — thiệp thành kỷ niệm sống động cho cả hai.",             featured: false },
  { icon: "circle-check", title: "Biết trước ai sẽ tới dự",              desc: "Khách bấm xác nhận ngay trên thiệp, bạn nắm số lượng mà không phải gọi hỏi từng người.",        featured: false },
  { icon: "headset",      title: "Hỗ trợ tư vấn tận tình qua Messenger", desc: "Đội ngũ phản hồi nhanh, hỗ trợ từ A đến Z — từ chọn mẫu đến chia sẻ thiệp cho khách.",         featured: false },
];

function renderBenefits() {
  const el = document.getElementById("benefitsGrid");
  if (!el) return;
  el.innerHTML = BENEFITS_DATA.map((b, i) => {
    const tag = b.featured ? `<span class="bnf-tag">Nổi bật</span>` : "";
    // Logo XuXi là ẢNH nên đi đường data-icon và phải khai data-size (không ăn font-size).
    const ico = b.img
      ? `<i data-icon="${b.icon}" data-size="24"></i>`
      : `<i data-lucide="${b.icon}"></i>`;
    return `<article class="bnf-row reveal reveal-delay-${(i % 2) + 1}" style="--bnf-c: var(--info-${i + 1}-rgb)">
  <span class="bnf-ico">${ico}</span>
  <div class="min-w-0">
    <h3 class="bnf-title">${b.title}${tag}</h3>
    <p class="bnf-desc">${b.desc}</p>
  </div>
</article>`;
  }).join("");
  window.lucide?.createIcons({ root: el });
  window.cxRenderIcons?.(el);
  setupRevealObserver();
}
