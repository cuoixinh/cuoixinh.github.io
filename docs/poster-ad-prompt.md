# Prompt tạo poster quảng cáo Cưới Xinh

Prompt cho công cụ tạo ảnh có nhận ảnh tham chiếu (ChatGPT / GPT-image, Gemini / Nano Banana,
Midjourney `--cref`/`--sref`…). Bố cục học theo dạng quảng cáo "câu hỏi khiêu khích + thiết bị
ở giữa + 4 icon + dải ưu đãi" của Facebook Ads; nội dung lấy từ `index.html`,
`js/section-features.js`, `js/section-benefits.js`, màu lấy từ `styles/_colors.css`.

## Ảnh đính kèm theo thứ tự

| Ảnh   | Đính kèm gì                                                         | Lấy ở đâu trong repo                       | Bắt buộc |
| ----- | ------------------------------------------------------------------- | ------------------------------------------ | -------- |
| Ảnh 1 | Logo Cưới Xinh                                                      | `assets/icons/logo.png`                    | Có       |
| Ảnh 2 | Ảnh chụp màn hình thiệp Đức Anh & Phương Thảo (06.12.2026)          | chụp từ thiệp thật                         | Có       |
| Ảnh 3 | Linh vật trợ lý AI XuXi                                             | `assets/icons/XuXi.webp`                   | Không    |
| Ảnh 4 | Poster tham chiếu bố cục (ảnh quảng cáo PhotoShare)                 | —                                          | Không    |

Ảnh 2 tốt nhất là chụp thiệp mở bằng **link riêng của khách "em Linh"**, để dòng
"Thân mời em Linh" nằm sẵn trong thiệp — đó là thứ duy nhất chứng minh được tiêu đề. Không
đính kèm ảnh nào thì xoá dòng tương ứng trong prompt, đừng để model tự bịa logo.

**Tỉ lệ 4:5 phải chọn ở phần cài đặt của công cụ** — nhiều công cụ bỏ qua tỉ lệ ghi trong
prompt và trả về ảnh vuông.

## Prompt chính (dán nguyên khối)

```text
Thiết kế một poster quảng cáo Facebook/Instagram dọc tỉ lệ 4:5 (1080×1350 px) cho Cưới Xinh —
dịch vụ thiệp cưới online tại Việt Nam (cuoixinh.com). Phong cách: quảng cáo SaaS hiện đại,
sạch, nhiều khoảng trắng, sang trọng và lãng mạn; ảnh render 3D thiết bị chân thực, ánh sáng
studio mềm. Bố cục học theo Ảnh 4 (nếu có): tiêu đề dạng câu hỏi ở trên, cụm thiết bị ở giữa,
hàng 4 icon tính năng, dải ưu đãi và nút ở đáy. KHÔNG chép màu xanh dương, chữ hay logo của
Ảnh 4 — chỉ học bố cục.

BẢNG MÀU (bắt buộc): nền gradient kem trắng #FFFBF8 sang hồng phấn #FFF0F5, có các dải lụa
mềm màu hồng #FFB7CA và hồng đậm #EC829E uốn ở hai góc chéo. Chữ tiêu đề màu nâu mận #5A3A45;
dòng nhấn và nút màu hồng đậm #DB2777 → #E11D48. Điểm xuyết vài hạt lấp lánh vàng champagne
#C9A040 → #E0BB55 rất nhẹ. Không dùng xanh dương.
TRANG TRÍ CHỈ GỒM dải lụa + hạt lấp lánh: KHÔNG có hoa hồng, KHÔNG cánh hoa, KHÔNG bông hoa
nào trên nền (hoa nhỏ trên đầu linh vật XuXi là một phần của nhân vật, giữ nguyên).

DỮ LIỆU THIỆP (dùng GIỐNG HỆT nhau ở mọi chỗ trên poster, không đổi, không viết tắt):
cô dâu chú rể "Đức Anh & Phương Thảo", ngày "06.12.2026", đường link
"cuoixinh.com/ducanh-phuongthao", khách mời "em Linh".

1. ĐẦU TRANG: logo Cưới Xinh lấy ĐÚNG từ Ảnh 1, đặt giữa phía trên, giữ nguyên hình và màu,
   không vẽ lại. Ngay dưới logo là chữ "Cưới Xinh" font serif, màu #5A3A45, cỡ vừa.

2. TIÊU ĐỀ (font serif sang trọng kiểu Playfair Display, đậm, căn giữa, 2 dòng):
   Dòng 1 màu #5A3A45: "CẢ TRĂM KHÁCH, CÙNG MỘT TẤM THIỆP?"
   Dòng 2 to hơn, màu #DB2777: "CƯỚI XINH GỌI ĐÚNG TÊN TỪNG NGƯỜI."

3. Ô GIỐNG THANH ĐỊA CHỈ (bo tròn, viền hồng nhạt, nền trắng, icon ổ khoá nhỏ bên trái,
   chỉ chứa đường link, không thêm gì khác): "cuoixinh.com/ducanh-phuongthao"
   Dưới ô, chữ sans-serif nhỏ màu #5A3A45:
   "Mỗi khách một link riêng — mở ra là thấy tên mình trên thiệp"

4. CỤM THIẾT BỊ Ở GIỮA (~50% chiều cao):
   - iPhone trắng/titan nghiêng nhẹ 5–8°, lệch trái. Màn hình hiển thị NGUYÊN VẸN thiệp ở
     Ảnh 2 (không cắt, không vẽ lại ảnh và chữ của thiệp). TRONG thiệp, phía trên tên cô dâu
     chú rể, có dòng chữ rõ ràng cùng font với thiệp: "Thân mời em Linh" — đây là chi tiết
     quan trọng nhất của poster, phải đọc được. Không gắn nhãn nổi bên ngoài thiệp.
   - iPhone thứ hai phía sau bên phải, nhỏ hơn, hiện khung chat kiểu Zalo/Messenger với người
     tên "Linh": bong bóng "Linh ơi, anh chị gửi em thiệp cưới nhé 💌", rồi thẻ xem trước link
     có ảnh lấy từ Ảnh 2 kèm "Đức Anh & Phương Thảo · 06.12.2026" và
     "cuoixinh.com/ducanh-phuongthao", rồi bong bóng trả lời
     "Ôi chúc mừng anh chị! Em nhất định tới ạ 🥰".
   - (Nếu có Ảnh 3) linh vật XuXi giữ đúng hình Ảnh 3, cỡ nhỏ ở góc dưới trái cụm thiết bị,
     bong bóng thoại "Để XuXi viết lời mời giúp nhé!".
   - Dưới máy: bóng đổ mềm, vài hạt lấp lánh vàng nhạt. Không hoa.

5. HÀNG 4 TÍNH NĂNG (4 cột, vạch dọc mảnh hồng nhạt, line-icon màu #DB2777, chữ #5A3A45):
   - icon người/danh thiếp: "Thiệp riêng / từng khách"
   - icon đũa phép lấp lánh: "Tạo nhanh / với AI XuXi"
   - icon dấu tích tròn: "Xác nhận dự / & lời chúc"
   - icon album ảnh + ghim bản đồ: "Album, nhạc / & bản đồ"

6. DẢI ƯU ĐÃI ĐÁY (thẻ bo tròn nền trắng viền hồng, ô trái gradient #E11D48 → #EC4899 có
   icon hộp quà trắng), cách hàng tính năng một khoảng thoáng:
   - Giữa, đậm màu #DB2777: "DÙNG THỬ MIỄN PHÍ", dưới là chữ nhỏ "Chỉ thanh toán khi ưng ý"
   - Bên phải sau vạch ngăn: "Thanh toán một lần · " + đậm "dùng trọn đời"

7. NÚT PILL dưới cùng, gradient #E11D48 → #EC4899, chữ trắng, chữ:
   "Tạo thiệp miễn phí tại cuoixinh.com"

YÊU CẦU CHỮ: toàn bộ là tiếng Việt CÓ DẤU, đúng từng ký tự trong ngoặc kép, không thêm chữ khác,
không lorem ipsum, không sai dấu. Lề an toàn 60 px bốn cạnh.

TRÁNH: hoa hồng, cánh hoa, bông hoa trang trí; tông xanh dương; chữ méo/sai dấu; logo bị vẽ
lại; tên hoặc ngày cưới khác với "Đức Anh & Phương Thảo · 06.12.2026"; chi tiết rối; watermark;
bàn tay dị dạng; nền tối.
```

## Tiêu đề thay thế (thay mục 2 nếu muốn A/B test)

Giữ dạng "câu hỏi chạm nỗi đau → câu trả lời là Cưới Xinh" như mẫu tham chiếu, và không
nhắc tên nền tảng khác (Zalo, Facebook) trong tiêu đề.

| Góc đánh            | Dòng 1 (#5A3A45)                     | Dòng 2 (#DB2777)                          |
| ------------------- | ------------------------------------ | ----------------------------------------- |
| Cá nhân hoá (chính) | CẢ TRĂM KHÁCH, CÙNG MỘT TẤM THIỆP?   | CƯỚI XINH GỌI ĐÚNG TÊN TỪNG NGƯỜI.        |
| Cá nhân hoá         | KHÁCH MỞ THIỆP,                      | THẤY NGAY TÊN MÌNH.                       |
| So với thiệp giấy   | THIỆP GIẤY PHẢI NGỒI GHI TÊN TỪNG TẤM? | THIỆP ONLINE TỰ GỌI TÊN TỪNG KHÁCH.     |
| AI XuXi             | KỂ VÀI DÒNG VỀ HAI BẠN.              | XUXI LO PHẦN CÒN LẠI.                     |
| Giá / rủi ro        | TẠO THIỆP MIỄN PHÍ.                  | ƯNG Ý MỚI TRẢ TIỀN.                       |
| RSVP                | VẪN GỌI HỎI TỪNG NGƯỜI CÓ ĐI KHÔNG?  | KHÁCH TỰ BẤM XÁC NHẬN NGAY TRÊN THIỆP.    |

Đổi góc đánh thì đổi luôn dòng phụ ở mục 3 và 4 icon cho khớp — danh sách tính năng thật nằm ở
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
