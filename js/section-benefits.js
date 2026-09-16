// --- Benefits grid (#benefits) ---
// Màu mỗi thẻ lấy theo VỊ TRÍ trong mảng (--info-N-rgb ở styles/_colors.css),
// nên thêm mục phải thêm một token màu. Dáng thẻ ở .bnf-* trong
// styles/tailwind-src.css; `featured` chỉ bật nhãn "Nổi bật" + nền phớt màu.
// `img: true` = icon ẢNH của core/helpers/icon.js (logo XuXi) thay cho glyph lucide.

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
    const hot = b.featured ? " is-hot" : "";
    const tag = b.featured ? `<span class="bnf-tag">Nổi bật</span>` : "";
    // Logo XuXi là ẢNH nên đi đường data-icon và phải khai data-size: icon ảnh
    // nhận khổ bằng inline style, không ăn theo font-size của .bnf-ico như svg
    // lucide. Lấy 24px cho cân với glyph 20px — logo có lề trong nên trông nhỏ hơn.
    const ico = b.img
      ? `<i data-icon="${b.icon}" data-size="24"></i>`
      : `<i data-lucide="${b.icon}"></i>`;
    return `<article class="bnf-card reveal reveal-delay-${(i % 4) + 1}${hot}" style="--bnf-c: var(--info-${i + 1}-rgb)">
  <div class="bnf-head">
    <span class="bnf-ico">${ico}</span>
    ${tag}
  </div>
  <h3 class="bnf-title">${b.title}</h3>
  <p class="bnf-desc">${b.desc}</p>
</article>`;
  }).join("");
  window.lucide?.createIcons({ root: el });
  window.cxRenderIcons?.(el);
  setupRevealObserver();
}
