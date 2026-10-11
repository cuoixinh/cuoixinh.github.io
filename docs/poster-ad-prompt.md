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
| Ảnh 3 | Linh vật trợ lý AI XuXi — nhân vật chính của poster                 | `assets/icons/XuXi.webp`                   | Có       |
| Ảnh 4 | Poster tham chiếu bố cục (ảnh quảng cáo PhotoShare)                 | —                                          | Không    |

Không đính kèm ảnh nào thì xoá dòng tương ứng trong prompt, đừng để model tự bịa logo.

**Tỉ lệ 4:5 phải chọn ở phần cài đặt của công cụ** — nhiều công cụ bỏ qua tỉ lệ ghi trong
prompt và trả về ảnh vuông.

## Prompt chính — góc đánh "Trợ lý AI" (dán nguyên khối)

```text
Thiết kế một poster quảng cáo Facebook/Instagram dọc tỉ lệ 4:5 (1080×1350 px) cho Cưới Xinh —
dịch vụ thiệp cưới online tại Việt Nam (cuoixinh.com) có trợ lý AI tên XuXi tự dựng thiệp từ
vài dòng khách kể. Phong cách: quảng cáo SaaS hiện đại, sạch, nhiều khoảng trắng, sang trọng
và lãng mạn; ảnh render 3D thiết bị chân thực, ánh sáng studio mềm. Bố cục học theo Ảnh 4
(nếu có): tiêu đề ở trên, cụm thiết bị ở giữa, hàng 4 icon tính năng, dải ưu đãi và nút ở đáy.
KHÔNG chép màu xanh dương, chữ hay logo của Ảnh 4 — chỉ học bố cục.

BẢNG MÀU (bắt buộc): nền gradient kem trắng #FFFBF8 sang hồng phấn #FFF0F5, có các dải lụa
mềm màu hồng #FFB7CA và hồng đậm #EC829E uốn ở hai góc chéo. Chữ tiêu đề màu nâu mận #5A3A45;
dòng nhấn và nút màu hồng đậm #DB2777 → #E11D48. Điểm xuyết vài hạt lấp lánh vàng champagne
#C9A040 → #E0BB55 rất nhẹ. Không dùng xanh dương.
TRANG TRÍ CHỈ GỒM dải lụa + hạt lấp lánh: KHÔNG có hoa hồng, KHÔNG cánh hoa, KHÔNG bông hoa
nào trên nền (hoa nhỏ trên đầu linh vật XuXi là một phần của nhân vật, giữ nguyên).

DỮ LIỆU THIỆP (dùng GIỐNG HỆT nhau ở mọi chỗ trên poster, không đổi, không viết tắt):
cô dâu chú rể "Đức Anh & Phương Thảo", ngày "06.12.2026".

1. ĐẦU TRANG: logo Cưới Xinh lấy ĐÚNG từ Ảnh 1, đặt giữa phía trên, giữ nguyên hình và màu,
   không vẽ lại. Ngay dưới logo là chữ "Cưới Xinh" font serif, màu #5A3A45, cỡ vừa.

2. TIÊU ĐỀ (font serif sang trọng kiểu Playfair Display, đậm, căn giữa, 2 dòng):
   Dòng 1 màu #5A3A45: "KỂ VÀI DÒNG VỀ HAI BẠN"
   Dòng 2 to hơn, màu #DB2777: "TRỢ LÝ CƯỚI XINH DỰNG THIỆP TRONG 1 PHÚT"

3. Ô NHẬP CHAT (thay cho thanh địa chỉ của Ảnh 4): khung bo tròn viền hồng nhạt, nền trắng,
   icon lấp lánh ✨ màu #DB2777 bên trái, nút gửi tròn màu #DB2777 bên phải, bên trong là dòng
   đang gõ dở có con trỏ nhấp nháy:
   "Bọn mình là Đức Anh & Phương Thảo, cưới 06.12, quen nhau hồi đại học…"
   Dưới ô, chữ sans-serif nhỏ màu #5A3A45:
   "Nhắn như kể cho bạn thân — XuXi viết lời mời, chuyện tình và lịch trình giúp bạn"

4. CỤM THIẾT BỊ Ở GIỮA (~50% chiều cao), kể một câu chuyện từ trái sang phải "chat → thiệp":
   - iPhone bên TRÁI, nhỏ hơn, hơi lùi sau: màn hình chat với trợ lý. Thanh tiêu đề có avatar
     XuXi tròn + chữ "XuXi · Trợ lý Cưới Xinh". Bong bóng của khách (bên phải, nền hồng nhạt):
     "Bọn mình là Đức Anh & Phương Thảo, cưới Chủ Nhật 06.12.2026. Quen nhau năm nhất đại học,
     thích văn phong lãng mạn ✨". Bong bóng của XuXi (bên trái, nền trắng):
     "Xong rồi nè! Mình đã viết lời mời và chuyện tình cho hai bạn 💌", ngay dưới là thẻ xem
     trước nhỏ có ảnh lấy từ Ảnh 2, chữ "Đức Anh & Phương Thảo · 06.12.2026" và nút "Xem thiệp".
   - iPhone bên PHẢI, to hơn, ở phía trước, nghiêng nhẹ 5–8°: màn hình hiển thị NGUYÊN VẸN
     thiệp ở Ảnh 2 (không cắt, không vẽ lại ảnh và chữ của thiệp).
   - Giữa hai máy: một vệt sáng lấp lánh màu hồng–vàng cong từ máy chat sang máy thiệp, như
     phép màu biến tin nhắn thành tấm thiệp.
   - Linh vật XuXi giữ ĐÚNG hình Ảnh 3, cỡ lớn (cao bằng khoảng 1/2 điện thoại), đứng phía
     trước giữa hai máy hoặc ló ra từ cạnh trái máy thiệp, tay cầm phong bì như trong Ảnh 3.
     Bong bóng thoại cạnh XuXi: "Để XuXi lo phần chữ nhé!"
   - Một huy hiệu tròn nhỏ nền trắng viền hồng gần góc trên máy thiệp: icon đồng hồ +
     "1 phút".
   - Dưới máy: bóng đổ mềm, vài hạt lấp lánh vàng nhạt. Không hoa.

5. HÀNG 4 TÍNH NĂNG (4 cột, vạch dọc mảnh hồng nhạt, line-icon màu #DB2777, chữ #5A3A45):
   - icon trái tim + bút: "Viết chuyện tình / theo giọng bạn"
   - icon ghim địa điểm: "Đúng tên lễ / theo miền"
   - icon ảnh + nốt nhạc: "Chọn ảnh, nhạc / & bản đồ"
   - icon người/danh thiếp: "Gọi tên / từng khách"

6. DẢI ƯU ĐÃI ĐÁY (thẻ bo tròn nền trắng viền hồng, ô trái gradient #E11D48 → #EC4899 có
   icon hộp quà trắng), cách hàng tính năng một khoảng thoáng:
   - Giữa, đậm màu #DB2777: "DÙNG THỬ MIỄN PHÍ", dưới là chữ nhỏ "Chỉ thanh toán khi ưng ý"
   - Bên phải sau vạch ngăn: "Thanh toán một lần · " + đậm "dùng trọn đời"

7. NÚT PILL dưới cùng, gradient #E11D48 → #EC4899, chữ trắng, icon lấp lánh ✨ bên trái:
   "Tạo thiệp với AI tại cuoixinh.com"

YÊU CẦU CHỮ: toàn bộ là tiếng Việt CÓ DẤU, đúng từng ký tự trong ngoặc kép, không thêm chữ khác,
không lorem ipsum, không sai dấu. Lề an toàn 60 px bốn cạnh.

TRÁNH: hoa hồng, cánh hoa, bông hoa trang trí; tông xanh dương; chữ méo/sai dấu; logo hoặc
XuXi bị vẽ lại khác ảnh gốc; robot kim loại kiểu khoa học viễn tưởng; tên hoặc ngày cưới khác
với "Đức Anh & Phương Thảo · 06.12.2026"; chi tiết rối; watermark; bàn tay dị dạng; nền tối.
```

## Tiêu đề thay thế (thay mục 2 nếu muốn A/B test)

Góc AI — giữ nguyên bố cục ở trên:

| Dòng 1 (#5A3A45)                     | Dòng 2 (#DB2777)                              |
| ------------------------------------ | --------------------------------------------- |
| BẠN CÓ CẢ TRĂM VIỆC TRƯỚC NGÀY CƯỚI. | VẬY SAO CÒN TỰ NGỒI VIẾT THIỆP?               |
| BÍ CÂU CHỮ CHO CHUYỆN TÌNH?          | XUXI VIẾT GIÚP, LÃNG MẠN HAY DÍ DỎM TUỲ BẠN.  |
| LỄ THÀNH HÔN HAY LỄ TÂN HÔN?         | XUXI GHI ĐÚNG THEO MIỀN QUÊ BẠN.              |
| KHÔNG CẦN BIẾT THIẾT KẾ.             | KHÔNG CẦN NGHĨ CÂU CHỮ.                       |
| AI VIẾT LỜI MỜI.                     | THIỆP GỌI ĐÚNG TÊN TỪNG KHÁCH.                |

Góc "gọi tên từng khách" cần bố cục khác (máy chính hiện "Thân mời em Linh" trong thiệp, máy
phụ là chat gửi link cho khách) — xem lịch sử git của file này cho bản prompt đó.

| Dòng 1 (#5A3A45)                     | Dòng 2 (#DB2777)                              |
| ------------------------------------ | --------------------------------------------- |
| MỜI CƯỚI QUA TIN NHẮN                | VẪN TRANG TRỌNG NHƯ TRAO TẬN TAY.             |
| KHÔNG THỂ TRAO TẬN TAY TỪNG NGƯỜI?   | ĐỂ THIỆP GỌI TÊN TỪNG NGƯỜI.                  |

Danh sách tính năng thật nằm ở `js/section-features.js` (10 mục) và
`js/section-benefits.js` (8 mục); việc trợ lý làm được nằm ở `CREATE_INTRO` của
`js/ai-assistant.js`.

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
- **"Trong 1 phút" là lời hứa có thể bị đối chiếu**: XuXi dựng phần chữ ngay khi khách gửi
  đủ thông tin, nhưng ảnh/nhạc/bản đồ khách vẫn tự chọn. Nếu bị hỏi, câu đỡ là "dựng sẵn
  thiệp trong 1 phút"; muốn chắc ăn thì đổi thành "dựng thiệp chỉ qua vài tin nhắn".
- Kích thước khác: 1:1 (1080×1080) cho bài đăng, 9:16 (1080×1920) cho Story/Reels — với 9:16
  chừa trống 250 px đầu và đáy cho giao diện Story.
