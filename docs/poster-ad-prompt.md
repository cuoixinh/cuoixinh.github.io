# Prompt tạo poster quảng cáo Cưới Xinh

Prompt cho công cụ tạo ảnh có nhận ảnh tham chiếu (ChatGPT / GPT-image, Gemini / Nano Banana,
Midjourney `--cref`/`--sref`…). Bố cục học theo dạng quảng cáo "câu hỏi khiêu khích + thiết bị
ở giữa + 4 icon + dải ưu đãi" của Facebook Ads; nội dung lấy từ `index.html`,
`js/section-features.js`, `js/section-benefits.js`, màu lấy từ `styles/_colors.css`.

## Ảnh đính kèm theo thứ tự

| Ảnh   | Đính kèm gì                                                                     | Lấy ở đâu trong repo                       | Bắt buộc |
| ----- | ------------------------------------------------------------------------------- | ------------------------------------------ | -------- |
| Ảnh 1 | Logo Cưới Xinh                                                                  | `assets/icons/logo.png`                    | Có       |
| Ảnh 2 | Ảnh chụp màn hình thiệp hiện trên điện thoại chính                              | `assets/images/templates/*.jpg` (782×1444) | Có       |
| Ảnh 3 | Ảnh mẫu thiệp thứ hai (khác tông) cho thẻ link trong khung chat                 | `assets/images/templates/*.jpg`            | Không    |
| Ảnh 4 | Linh vật trợ lý AI XuXi                                                          | `assets/icons/XuXi.webp`                   | Không    |
| Ảnh 5 | Poster tham chiếu bố cục (ảnh quảng cáo PhotoShare)                             | —                                          | Không    |

Gợi ý ghép tông: `romantic-gold` / `romantic-blush` / `pearl-bow` cho Ảnh 2 (hợp nền hồng
kem), `vintage-forest` / `noir-elegance` cho Ảnh 3 để thấy được "nhiều mẫu". Không đính kèm
ảnh nào thì xoá dòng tương ứng trong prompt, đừng để model tự bịa logo.

## Prompt chính (dán nguyên khối)

```text
Thiết kế một poster quảng cáo Facebook/Instagram dọc tỉ lệ 4:5 (1080×1350 px) cho Cưới Xinh —
dịch vụ thiệp cưới online tại Việt Nam (cuoixinh.com). Phong cách: quảng cáo SaaS hiện đại,
sạch, nhiều khoảng trắng, sang trọng và lãng mạn; ảnh render 3D thiết bị chân thực, ánh sáng
studio mềm. Bố cục học theo Ảnh 5 (nếu có): tiêu đề dạng câu hỏi ở trên, cụm thiết bị ở giữa,
hàng 4 icon tính năng, dải ưu đãi và nút ở đáy. KHÔNG chép màu xanh dương, chữ hay logo của
Ảnh 5 — chỉ học bố cục.

BẢNG MÀU (bắt buộc): nền gradient kem trắng #FFFBF8 sang hồng phấn #FFF0F5, có các dải lụa /
sóng mềm màu hồng #FFB7CA và hồng đậm #EC829E ở hai góc chéo (thay cho sóng xanh của Ảnh 5).
Chữ tiêu đề màu nâu mận #5A3A45; dòng nhấn và nút màu hồng đậm #DB2777 → #E11D48. Điểm xuyết
ánh vàng champagne #C9A040 → #E0BB55 rất nhẹ (viền, tia lấp lánh). Không dùng xanh dương.

1. ĐẦU TRANG: logo Cưới Xinh lấy ĐÚNG từ Ảnh 1, đặt giữa phía trên, kích thước nhỏ vừa phải,
   giữ nguyên hình và màu của logo, không vẽ lại.

2. TIÊU ĐỀ (font serif sang trọng kiểu Playfair Display, đậm, căn giữa, 3 dòng):
   Dòng 1–2 màu #5A3A45: "THIỆP CƯỚI GỬI QUA ZALO."
   Dòng 3 to hơn, màu #DB2777: "SAO KHÔNG GỌI ĐÚNG TÊN TỪNG KHÁCH?"

3. Ô GIỐNG THANH ĐỊA CHỈ (khung bo tròn viền hồng nhạt, nền trắng, icon trái tim nhỏ bên trái):
   "cuoixinh.com/minhkhoi-thaomy"   ·   "Thân mời: em Linh"
   Bên dưới một dòng chữ sans-serif nhỏ màu #5A3A45:
   "Mỗi khách một link riêng — mở ra là thấy tên mình trên thiệp"

4. CỤM THIẾT BỊ Ở GIỮA (chiếm khoảng 45% chiều cao poster):
   - Một iPhone đời mới viền mỏng màu trắng/titan, nghiêng nhẹ 5–8°, đặt hơi lệch trái. Màn
     hình hiển thị NGUYÊN VẸN ảnh thiệp cưới ở Ảnh 2 (giữ đúng bố cục, chữ, ảnh cô dâu chú rể,
     không cắt, không vẽ lại nội dung). Phía trên màn thiệp có một nhãn nhỏ: "Thân mời: em Linh".
   - Một iPhone thứ hai phía sau bên phải, nhỏ hơn, hiển thị khung chat kiểu Zalo/Messenger:
     bong bóng tin nhắn "Linh ơi, anh chị gửi em thiệp cưới nhé 💌", tiếp theo là thẻ xem trước
     link có ảnh thiệp (Ảnh 3 nếu có, không thì Ảnh 2) kèm chữ "Minh Khôi & Thảo My · 11.10.2026"
     và "cuoixinh.com/minhkhoi-thaomy", cuối cùng là bong bóng trả lời
     "Ôi chúc mừng anh chị! Em nhất định tới ạ 🥰".
   - (Nếu có Ảnh 4) linh vật XuXi ở góc dưới trái của cụm thiết bị, cỡ nhỏ, kèm bong bóng
     thoại "Để XuXi viết lời mời giúp nhé!".
   - Quanh cụm thiết bị: vài cánh hoa hồng phấn, hạt lấp lánh vàng nhạt, bóng đổ mềm dưới máy.

5. HÀNG 4 TÍNH NĂNG (4 cột, ngăn bằng vạch dọc mảnh màu hồng nhạt, icon nét mảnh line-icon
   màu #DB2777 phía trên, chữ 2 dòng màu #5A3A45 căn giữa):
   - icon danh thiếp/người: "Thiệp riêng\ntừng khách"
   - icon đũa phép lấp lánh: "Tạo nhanh\nvới AI XuXi"
   - icon dấu tích trong vòng tròn: "Xác nhận dự\n& lời chúc"
   - icon album ảnh + nốt nhạc: "Album, nhạc\n& bản đồ"

6. DÒNG KẾT (icon ngôi sao 4 cánh màu hồng đậm bên trái, chữ cỡ vừa):
   "Khách mở ra là thấy " + chữ in đậm màu #DB2777 "tên mình trên thiệp"

7. DẢI ƯU ĐÃI ĐÁY (thẻ bo tròn nền trắng viền hồng, ô vuông bên trái nền gradient
   #E11D48 → #EC4899 có icon hộp quà trắng):
   - Giữa, chữ đậm màu #DB2777: "DÙNG THỬ MIỄN PHÍ"
     dưới nó chữ nhỏ: "Chỉ thanh toán khi ưng ý"
   - Bên phải sau vạch ngăn: "Thanh toán một lần · " + chữ đậm "dùng trọn đời"

8. NÚT PILL dưới cùng, nền gradient hồng đậm #E11D48 → #EC4899, chữ trắng, icon quả địa cầu
   nhỏ: "cuoixinh.com"

YÊU CẦU CHỮ: toàn bộ chữ là tiếng Việt CÓ DẤU, viết đúng từng ký tự như trong ngoặc kép ở
trên, không thêm chữ nào khác, không chữ giả / lorem ipsum, không sai dấu. Phân cấp rõ:
tiêu đề > dòng nhấn > nội dung. Chừa lề an toàn 60 px bốn cạnh.

TRÁNH: tông xanh dương, chữ méo hoặc sai dấu, logo bị vẽ lại, nội dung thiệp bị bịa khác
Ảnh 2, quá nhiều chi tiết rối, watermark, người thật ngoài ảnh thiệp, bàn tay cầm máy bị dị
dạng, nền tối.
```

## Biến thể tiêu đề (thay mục 2 + mục 3 nếu muốn A/B test)

| Góc đánh                    | Tiêu đề                                                                           | Ô "thanh địa chỉ" / dòng phụ                                       |
| --------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Cá nhân hoá (mặc định)      | THIỆP CƯỚI GỬI QUA ZALO. / SAO KHÔNG GỌI ĐÚNG TÊN TỪNG KHÁCH?                     | cuoixinh.com/minhkhoi-thaomy · Thân mời: em Linh                   |
| AI XuXi                     | KỂ VÀI DÒNG VỀ HAI BẠN. / XUXI LO PHẦN CÒN LẠI.                                   | Lời mời · chuyện tình · lịch trình — xong thiệp trong một buổi chiều |
| Giá / rủi ro                | TẠO THIỆP MIỄN PHÍ. / ƯNG Ý MỚI TRẢ TIỀN.                                          | Thanh toán một lần — sửa nội dung miễn phí trọn đời                |
| RSVP                        | KHÔNG CẦN GỌI HỎI TỪNG NGƯỜI. / BIẾT TRƯỚC AI SẼ TỚI DỰ.                          | Khách bấm xác nhận & để lại lời chúc ngay trên thiệp               |

Đổi góc đánh thì đổi luôn 4 icon cho khớp — danh sách tính năng thật nằm ở
`js/section-features.js` (10 mục) và `js/section-benefits.js` (8 mục).

## Lưu ý khi dùng

- **Đừng đưa con số giá vào poster** khi chưa tra bảng `template_pricing`: giá chỉ có một
  nguồn là bảng đó, in sai lên quảng cáo là khách thấy một giá, thanh toán một giá khác.
  Câu an toàn là "Dùng thử miễn phí · thanh toán một lần".
- Model ảnh hay sai dấu tiếng Việt ở chữ nhỏ. Nếu chữ lỗi: chạy lại với dòng
  "KHÔNG render bất kỳ chữ nào, chừa trống các vùng chữ" rồi đặt chữ trong Canva/Figma bằng
  font Playfair Display (tiêu đề) + Be Vietnam Pro hoặc Inter (nội dung).
- Màn hình điện thoại hay bị model "vẽ lại" thiệp. Cách chắc ăn: tạo poster với màn hình
  để trống ("màn hình hiển thị một màu hồng nhạt trơn"), sau đó dán Ảnh 2 vào màn bằng
  công cụ ghép ảnh.
- Kích thước khác: 1:1 (1080×1080) cho bài đăng, 9:16 (1080×1920) cho Story/Reels — với 9:16
  chừa trống 250 px đầu và đáy cho giao diện Story.
