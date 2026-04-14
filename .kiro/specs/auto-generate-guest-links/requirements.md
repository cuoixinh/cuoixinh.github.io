# Tài Liệu Yêu Cầu

## Giới Thiệu

Tính năng này cho phép tự động tạo link thiệp mời cá nhân hóa cho từng khách mời trong hệ thống quản lý thiệp cưới. Hệ thống sẽ mã hóa thông tin khách mời (tên và quan hệ) và tạo URL riêng biệt cho mỗi người, sau đó cập nhật các link này vào Google Sheets. Khi khách mời truy cập link cá nhân của họ, trang thiệp sẽ giải mã các tham số và hiển thị lời chào được cá nhân hóa.

## Thuật Ngữ

- **Trang_Quản_Trị**: Trang manage-by-customer.html nơi quản lý thông tin chi tiết của đám cưới
- **Trang_Thiệp**: Trang index.html hiển thị thiệp cưới cá nhân hóa cho khách mời
- **Google_Sheet**: Bảng tính chứa thông tin khách mời với các cột: họ tên, tên hiển thị, quan hệ, link thiệp, đã xem thiệp, xác nhận tham dự, lời chúc, và thời gian xác nhận
- **Bản_Ghi_Khách**: Một dòng trong Google Sheet đại diện cho một khách mời với thông tin của họ
- **Dịch_Vụ_Mã_Hóa**: Component chịu trách nhiệm mã hóa và giải mã dữ liệu khách mời sử dụng khóa "dqvinh"
- **Bộ_Tạo_Link**: Component tạo URL thiệp mời cá nhân hóa với các tham số đã mã hóa
- **Google_Apps_Script_API**: API endpoint hiện có để tương tác với dữ liệu Google Sheets
- **Batch_Update_Endpoint**: API endpoint mới trong Google Apps Script để cập nhật nhiều link khách mời cùng lúc
- **Wedding_ID**: Mã định danh duy nhất cho một đám cưới trong database Supabase
- **Phía_Khách**: Có thể là "groom" (nhà trai) hoặc "bride" (nhà gái) chỉ định khách thuộc gia đình nào

## Yêu Cầu

### Yêu Cầu 1: Nút Tự Động Tạo Link

**User Story:** Là quản trị viên đám cưới, tôi muốn thấy 2 nút "Tự động tạo link" riêng biệt cho nhà trai và nhà gái trong form quản lý, để tôi có thể tạo link thiệp cá nhân hóa cho từng phía.

#### Tiêu Chí Chấp Nhận

1. Trang_Quản_Trị PHẢI hiển thị nút "Tự động tạo link" trong phần quản lý khách mời nhà trai
2. Trang_Quản_Trị PHẢI hiển thị nút "Tự động tạo link" trong phần quản lý khách mời nhà gái
3. Mỗi nút PHẢI có thiết kế nổi bật và được gắn nhãn rõ ràng với text "🔗 Tự động tạo link"
4. Nút nhà trai PHẢI được đặt gần ô nhập "URL Google Apps Script (DS khách mời nhà trai)"
5. Nút nhà gái PHẢI được đặt gần ô nhập "URL Google Apps Script (DS khách mời nhà gái)"
6. KHI nút được click, Trang_Quản_Trị PHẢI hiển thị loading indicator
7. Nút PHẢI bị vô hiệu hóa trong quá trình tạo link
8. Mỗi nút PHẢI hoạt động độc lập (có thể tạo link riêng cho từng phía)

### Yêu Cầu 2: Lấy Dữ Liệu Khách Từ Google Sheets

**User Story:** Là quản trị viên đám cưới, tôi muốn hệ thống lấy thông tin khách mời từ Google Sheet tương ứng khi tôi click nút, để có thể tạo link cá nhân hóa cho đúng phía.

#### Tiêu Chí Chấp Nhận

1. KHI nút "Tự động tạo link" nhà trai được click, Bộ_Tạo_Link PHẢI lấy groom_google_sheet_url từ dữ liệu đám cưới
2. KHI nút "Tự động tạo link" nhà gái được click, Bộ_Tạo_Link PHẢI lấy bride_google_sheet_url từ dữ liệu đám cưới
3. Bộ_Tạo_Link PHẢI gọi Google_Apps_Script_API để lấy tất cả Bản_Ghi_Khách từ sheet tương ứng
4. NẾU URL Google Sheet trống hoặc không hợp lệ, THÌ Bộ_Tạo_Link PHẢI hiển thị thông báo lỗi "Vui lòng cấu hình URL Google Sheet trước"
5. Bộ_Tạo_Link PHẢI trích xuất tên hiển thị (cột B) và quan hệ (cột C) từ mỗi Bản_Ghi_Khách
6. Bộ_Tạo_Link PHẢI bỏ qua dòng header (dòng 1) và chỉ xử lý dữ liệu từ dòng 2 trở đi
7. Bộ_Tạo_Link PHẢI lưu số dòng (row number) của mỗi khách để cập nhật link sau này

### Yêu Cầu 3: Mã Hóa Thông Tin Khách Mời

**User Story:** Là quản trị viên đám cưới, tôi muốn tên và quan hệ của khách được mã hóa trong URL, để link được bảo mật nhưng vẫn có thể giải mã để cá nhân hóa.

#### Tiêu Chí Chấp Nhận

1. Dịch_Vụ_Mã_Hóa PHẢI sử dụng khóa mã hóa "dqvinh" cho tất cả các thao tác mã hóa
2. KHI mã hóa dữ liệu khách, Dịch_Vụ_Mã_Hóa PHẢI mã hóa tên khách từ cột B (Tên hiển thị)
3. KHI mã hóa dữ liệu khách, Dịch_Vụ_Mã_Hóa PHẢI mã hóa quan hệ từ cột C (Quan hệ)
4. Dịch_Vụ_Mã_Hóa PHẢI tạo ra chuỗi mã hóa an toàn cho URL
5. Chuỗi đã mã hóa PHẢI có thể giải mã được bằng cùng khóa mã hóa
6. NẾU tên khách hoặc quan hệ trống, THÌ Dịch_Vụ_Mã_Hóa PHẢI mã hóa chuỗi rỗng

### Yêu Cầu 4: Tạo Link Cá Nhân Hóa

**User Story:** Là quản trị viên đám cưới, tôi muốn hệ thống tạo link thiệp mời riêng biệt cho từng khách, để mỗi khách nhận được thiệp mời cá nhân hóa theo phía nhà trai hoặc nhà gái.

#### Tiêu Chí Chấp Nhận

1. Bộ_Tạo_Link PHẢI tạo URL theo định dạng: https://domain.com/index.html?id=WEDDING_ID&isGroom=true/false&name=ENCRYPTED_NAME&relationship=ENCRYPTED_RELATIONSHIP
2. Bộ_Tạo_Link PHẢI sử dụng domain hiện tại từ window.location.origin
3. Bộ_Tạo_Link PHẢI bao gồm tham số id với giá trị Wedding_ID trong mỗi link được tạo
4. Bộ_Tạo_Link PHẢI bao gồm tham số isGroom=true cho khách nhà trai
5. Bộ_Tạo_Link PHẢI bao gồm tham số isGroom=false cho khách nhà gái
6. Bộ_Tạo_Link PHẢI bao gồm tham số name với giá trị đã mã hóa trong mỗi link được tạo
7. Bộ_Tạo_Link PHẢI bao gồm tham số relationship với giá trị đã mã hóa trong mỗi link được tạo
8. Link nhà trai PHẢI có định dạng: http://domain/index.html?id=xxx&isGroom=true&name=xxx&relationship=xxx
9. Link nhà gái PHẢI có định dạng: http://domain/index.html?id=xxx&isGroom=false&name=xxx&relationship=xxx

### Yêu Cầu 5: Cập Nhật Link Vào Google Sheets

**User Story:** Là quản trị viên đám cưới, tôi muốn các link đã tạo được tự động lưu lại vào Google Sheet tương ứng, để tôi có thể theo dõi và chia sẻ chúng với khách mời.

#### Tiêu Chí Chấp Nhận

1. Bộ_Tạo_Link PHẢI cập nhật cột D (Link thiệp) trong Google_Sheet với link cá nhân hóa đã tạo
2. Bộ_Tạo_Link PHẢI sử dụng Batch_Update_Endpoint để cập nhật nhiều link khách trong một lần gọi API
3. KHI tạo link cho nhà trai, Bộ_Tạo_Link PHẢI cập nhật vào groom_google_sheet_url
4. KHI tạo link cho nhà gái, Bộ_Tạo_Link PHẢI cập nhật vào bride_google_sheet_url
5. KHI tất cả link được cập nhật thành công, Bộ_Tạo_Link PHẢI hiển thị thông báo thành công "✅ Đã tạo link thành công cho [N] khách mời nhà [trai/gái]"
6. NẾU cập nhật thất bại cho bất kỳ khách nào, THÌ Bộ_Tạo_Link PHẢI hiển thị thông báo lỗi với số dòng cụ thể
7. Bộ_Tạo_Link PHẢI giữ nguyên tất cả dữ liệu cột khác trong quá trình cập nhật

### Yêu Cầu 6: API Endpoint Cập Nhật Hàng Loạt

**User Story:** Là nhà phát triển hệ thống, tôi muốn có endpoint cập nhật hàng loạt trong Google Apps Script, để có thể cập nhật nhiều link khách một cách hiệu quả.

#### Tiêu Chí Chấp Nhận

1. Batch_Update_Endpoint PHẢI chấp nhận POST request với action="batchUpdateLinks"
2. Batch_Update_Endpoint PHẢI chấp nhận mảng JSON updates chứa các object {row: number, link: string}
3. Batch_Update_Endpoint PHẢI cập nhật cột D (Link thiệp) cho mỗi dòng được chỉ định
4. Batch_Update_Endpoint PHẢI trả về response thành công với số lượng dòng đã cập nhật
5. NẾU bất kỳ cập nhật nào thất bại, THÌ Batch_Update_Endpoint PHẢI trả về response lỗi với chi tiết
6. Batch_Update_Endpoint PHẢI xác thực rằng số dòng nằm trong phạm vi hợp lệ (>= 2)
7. Batch_Update_Endpoint PHẢI xử lý các request đồng thời một cách an toàn
8. Batch_Update_Endpoint PHẢI tự động phát hiện sheet đầu tiên (không hardcode tên sheet)

### Yêu Cầu 7: Giải Mã Tham Số URL Trên Trang Thiệp

**User Story:** Là khách mời, tôi muốn trang thiệp nhận diện link cá nhân của tôi, để tôi thấy lời chào với tên và quan hệ của mình.

#### Tiêu Chí Chấp Nhận

1. KHI Trang_Thiệp load, Trang_Thiệp PHẢI kiểm tra sự hiện diện của tham số URL "name" và "relationship"
2. NẾU cả hai tham số đều có, THÌ Dịch_Vụ_Mã_Hóa PHẢI giải mã tham số name sử dụng khóa "dqvinh"
3. NẾU cả hai tham số đều có, THÌ Dịch_Vụ_Mã_Hóa PHẢI giải mã tham số relationship sử dụng khóa "dqvinh"
4. Trang_Thiệp PHẢI hiển thị các giá trị đã giải mã trong lời chào màn hình cover
5. NẾU giải mã thất bại, THÌ Trang_Thiệp PHẢI hiển thị lời chào chung không có cá nhân hóa
6. NẾU thiếu các tham số, THÌ Trang_Thiệp PHẢI hiển thị lời chào chung không có cá nhân hóa

### Yêu Cầu 8: Hiển Thị Lời Chào Cá Nhân Hóa

**User Story:** Là khách mời, tôi muốn thấy lời chào cá nhân hóa với tên và quan hệ của mình, để tôi cảm thấy thiệp mời được gửi riêng cho tôi.

#### Tiêu Chí Chấp Nhận

1. Trang_Thiệp PHẢI hiển thị lời chào theo định dạng: "Kính mời [relationship] [name] tới dự lễ thành hôn..."
2. Trang_Thiệp PHẢI cập nhật element có id "cover-guest-name" để hiển thị tên đã giải mã
3. Trang_Thiệp PHẢI xây dựng text lời chào đầy đủ sử dụng quan hệ và tên đã giải mã
4. Lời chào PHẢI được hiển thị trên màn hình cover trước khi thiệp được mở
5. Lời chào cá nhân hóa PHẢI vẫn hiển thị trong suốt quá trình xem thiệp
6. NẾU không có dữ liệu cá nhân hóa, THÌ Trang_Thiệp PHẢI hiển thị lời chào mặc định

### Yêu Cầu 9: Xử Lý Lỗi và Phản Hồi Người Dùng

**User Story:** Là quản trị viên đám cưới, tôi muốn có thông báo lỗi rõ ràng khi tạo link thất bại, để tôi có thể khắc phục và giải quyết vấn đề.

#### Tiêu Chí Chấp Nhận

1. NẾU Google_Apps_Script_API không thể kết nối, THÌ Bộ_Tạo_Link PHẢI hiển thị thông báo lỗi "Không thể kết nối đến Google Sheets"
2. NẾU mã hóa thất bại, THÌ Bộ_Tạo_Link PHẢI hiển thị thông báo lỗi "Lỗi mã hóa dữ liệu khách mời"
3. NẾU cập nhật hàng loạt thất bại, THÌ Bộ_Tạo_Link PHẢI hiển thị thông báo lỗi "Lỗi cập nhật link vào Google Sheets"
4. KHI bắt đầu tạo link, Trang_Quản_Trị PHẢI hiển thị progress indicator với text "Đang tạo link..."
5. KHI tạo link hoàn thành thành công, Trang_Quản_Trị PHẢI hiển thị toast notification thành công
6. Các thông báo lỗi PHẢI được hiển thị bằng tiếng Việt
7. Các thông báo lỗi PHẢI tự động đóng sau 5 giây

### Yêu Cầu 10: Tích Hợp Thư Viện Mã Hóa

**User Story:** Là nhà phát triển hệ thống, tôi muốn sử dụng thư viện mã hóa đáng tin cậy, để dữ liệu khách được mã hóa và giải mã một cách an toàn.

#### Tiêu Chí Chấp Nhận

1. Dịch_Vụ_Mã_Hóa PHẢI sử dụng thư viện CryptoJS cho các thao tác mã hóa
2. Dịch_Vụ_Mã_Hóa PHẢI sử dụng thuật toán mã hóa AES
3. Dịch_Vụ_Mã_Hóa PHẢI encode dữ liệu đã mã hóa sang định dạng Base64 để an toàn cho URL
4. Dịch_Vụ_Mã_Hóa PHẢI decode dữ liệu Base64 trước khi giải mã
5. Dịch_Vụ_Mã_Hóa PHẢI xử lý đúng các ký tự đặc biệt trong tên và quan hệ khách
6. Dịch_Vụ_Mã_Hóa PHẢI tạo ra output mã hóa nhất quán cho cùng một input
7. Quá trình giải mã PHẢI thành công đảo ngược mã hóa cho tất cả input hợp lệ
