# Requirements Document

## Introduction

Tính năng thanh toán online qua QR code cho phép khách hàng thanh toán thực tế thay vì thanh toán giả lập (fake delay 1.5s). Hệ thống sẽ tích hợp với cổng thanh toán ngân hàng Việt Nam, hiển thị mã QR cho khách quét, và tự động cập nhật trạng thái đơn hàng vào database sau khi thanh toán thành công.

## Glossary

- **Payment_Modal**: Modal thanh toán 3 bước hiện tại trong payment.js
- **QR_Payment_Gateway**: Dịch vụ cổng thanh toán tạo mã QR và webhook callback
- **Wedding_Record**: Bản ghi thiệp cưới trong bảng weddings của Supabase
- **Edge_Function**: Supabase Edge Function wedding-admin xử lý CRUD
- **Payment_Webhook**: Endpoint nhận thông báo thanh toán thành công từ gateway
- **Order_Status**: Trạng thái đơn hàng trong localStorage (pending/completed/cancelled)
- **Manage_ID**: UUID v4 dùng để quản lý thiệp cưới
- **VietQR**: Chuẩn QR code thanh toán ngân hàng Việt Nam

## Requirements

### Requirement 1: Tích hợp cổng thanh toán QR

**User Story:** Là khách hàng, tôi muốn thanh toán qua QR code ngân hàng, để tôi có thể thanh toán nhanh chóng và an toàn bằng ứng dụng ngân hàng của mình.

#### Acceptance Criteria

1. WHEN khách hàng nhấn "Thanh toán ngay" trong Payment_Modal, THE Payment_Modal SHALL hiển thị mã QR thanh toán
2. THE QR_Payment_Gateway SHALL tạo mã QR theo chuẩn VietQR với thông tin: số tiền 299.000đ, nội dung chuyển khoản chứa Manage_ID
3. THE Payment_Modal SHALL hiển thị thông tin: số tài khoản, tên người nhận, số tiền, nội dung chuyển khoản
4. THE Payment_Modal SHALL hiển thị hướng dẫn: "Mở ứng dụng ngân hàng → Quét mã QR → Xác nhận thanh toán"
5. WHILE chờ thanh toán, THE Payment_Modal SHALL hiển thị trạng thái "Đang chờ thanh toán" với spinner animation

### Requirement 2: Polling trạng thái thanh toán

**User Story:** Là khách hàng, tôi muốn hệ thống tự động phát hiện khi tôi đã thanh toán thành công, để tôi không phải nhập mã xác nhận thủ công.

#### Acceptance Criteria

1. WHEN mã QR được hiển thị, THE Payment_Modal SHALL bắt đầu polling trạng thái thanh toán mỗi 3 giây
2. THE Payment_Modal SHALL gọi GET endpoint kiểm tra trạng thái thanh toán với Manage_ID
3. WHEN thanh toán thành công được phát hiện, THE Payment_Modal SHALL dừng polling
4. WHEN thanh toán thành công được phát hiện, THE Payment_Modal SHALL chuyển sang bước "Thanh toán thành công"
5. IF polling vượt quá 10 phút, THEN THE Payment_Modal SHALL dừng polling và hiển thị thông báo timeout
6. WHEN timeout xảy ra, THE Payment_Modal SHALL hiển thị nút "Kiểm tra lại" để khách hàng có thể thử lại

### Requirement 3: Webhook nhận thông báo thanh toán

**User Story:** Là hệ thống, tôi cần nhận thông báo từ cổng thanh toán khi giao dịch thành công, để cập nhật trạng thái đơn hàng ngay lập tức.

#### Acceptance Criteria

1. THE Payment_Webhook SHALL nhận POST request từ QR_Payment_Gateway với thông tin giao dịch
2. THE Payment_Webhook SHALL xác thực chữ ký (signature) từ QR_Payment_Gateway
3. IF chữ ký không hợp lệ, THEN THE Payment_Webhook SHALL trả về HTTP 401 Unauthorized
4. WHEN webhook nhận được thông báo thanh toán thành công, THE Payment_Webhook SHALL cập nhật trạng thái payment_status trong Wedding_Record
5. THE Payment_Webhook SHALL lưu thông tin giao dịch: transaction_id, payment_time, amount vào Wedding_Record
6. THE Payment_Webhook SHALL trả về HTTP 200 OK cho QR_Payment_Gateway

### Requirement 4: Tạo Wedding Record sau thanh toán thành công

**User Story:** Là khách hàng, tôi muốn hệ thống tự động tạo thiệp cưới sau khi thanh toán thành công, để tôi có thể bắt đầu nhập thông tin ngay lập tức.

#### Acceptance Criteria

1. WHEN Payment_Webhook xác nhận thanh toán thành công, THE Edge_Function SHALL tạo Wedding_Record với Manage_ID từ nội dung chuyển khoản
2. THE Edge_Function SHALL tạo slug từ tên khách hàng và số điện thoại
3. THE Edge_Function SHALL xử lý slug trùng lặp bằng cách thêm suffix (-2, -3, ...)
4. THE Edge_Function SHALL lưu theme được chọn vào Wedding_Record
5. THE Edge*Function SHALL đặt is_active = true cho Wedding*Record mới
6. THE Edge_Function SHALL đặt payment_status = "completed" cho Wedding_Record

### Requirement 5: Cập nhật Order Status trong localStorage

**User Story:** Là khách hàng, tôi muốn xem lịch sử đơn hàng của mình trong trang tài khoản, để theo dõi trạng thái thanh toán.

#### Acceptance Criteria

1. WHEN Payment_Modal phát hiện thanh toán thành công, THE Payment_Modal SHALL cập nhật Order_Status từ "pending" thành "completed"
2. THE Payment_Modal SHALL lưu manage_id vào order trong localStorage
3. THE Payment_Modal SHALL lưu transaction_id vào order trong localStorage
4. THE Payment_Modal SHALL lưu payment_time vào order trong localStorage
5. IF khách hàng đã đăng nhập, THEN THE Payment*Modal SHALL lưu order vào "orders*{email}"
6. IF khách hàng chưa đăng nhập, THEN THE Payment*Modal SHALL lưu order vào "guestOrders" hoặc "orders*{email_nhập}"

### Requirement 6: Hiển thị màn hình thanh toán thành công

**User Story:** Là khách hàng, tôi muốn thấy xác nhận thanh toán thành công và link thiết lập thiệp, để tôi biết giao dịch đã hoàn tất và có thể bắt đầu tùy chỉnh thiệp.

#### Acceptance Criteria

1. WHEN thanh toán thành công, THE Payment_Modal SHALL hiển thị icon checkmark màu xanh
2. THE Payment_Modal SHALL hiển thị thông báo "Thanh toán thành công!"
3. THE Payment_Modal SHALL hiển thị thông tin đơn hàng: tên, số điện thoại, mẫu thiệp
4. THE Payment_Modal SHALL hiển thị link thiết lập thiệp: /manage-by-customer.html?id={manage_id}
5. THE Payment_Modal SHALL hiển thị nút "Copy link" để sao chép link thiết lập
6. THE Payment_Modal SHALL hiển thị nút "Thiết lập ngay" để chuyển đến trang quản lý
7. THE Payment_Modal SHALL hiển thị nút "Đóng" để đóng modal

### Requirement 7: Xử lý lỗi thanh toán

**User Story:** Là khách hàng, tôi muốn được thông báo rõ ràng khi thanh toán thất bại, để tôi biết cách xử lý và thử lại.

#### Acceptance Criteria

1. IF QR_Payment_Gateway trả về lỗi, THEN THE Payment_Modal SHALL hiển thị thông báo lỗi cụ thể
2. IF kết nối mạng bị gián đoạn, THEN THE Payment_Modal SHALL hiển thị "Lỗi kết nối, vui lòng kiểm tra mạng"
3. IF thanh toán bị từ chối, THEN THE Payment_Modal SHALL hiển thị "Thanh toán bị từ chối, vui lòng thử lại"
4. WHEN lỗi xảy ra, THE Payment_Modal SHALL hiển thị nút "Thử lại" để khách hàng có thể tạo mã QR mới
5. WHEN lỗi xảy ra, THE Payment_Modal SHALL giữ nguyên thông tin form (tên, SĐT, email)
6. THE Payment_Modal SHALL log lỗi vào console để debug

### Requirement 8: Bảo mật và xác thực

**User Story:** Là hệ thống, tôi cần đảm bảo chỉ các giao dịch hợp lệ mới được xử lý, để tránh gian lận và tấn công.

#### Acceptance Criteria

1. THE Payment_Webhook SHALL xác thực chữ ký HMAC-SHA256 từ QR_Payment_Gateway
2. THE Payment_Webhook SHALL lưu secret key trong Supabase Secrets
3. THE Payment_Webhook SHALL kiểm tra Manage_ID tồn tại trong nội dung chuyển khoản
4. THE Payment_Webhook SHALL kiểm tra số tiền thanh toán khớp với giá thiệp (299.000đ)
5. THE Payment_Webhook SHALL kiểm tra giao dịch chưa được xử lý trước đó (dựa vào transaction_id)
6. IF bất kỳ kiểm tra nào thất bại, THEN THE Payment_Webhook SHALL trả về HTTP 400 Bad Request và log chi tiết lỗi

### Requirement 9: Timeout và retry logic

**User Story:** Là khách hàng, tôi muốn có thể thử lại nếu thanh toán không được xác nhận sau thời gian chờ, để tôi không bị mắc kẹt ở màn hình chờ.

#### Acceptance Criteria

1. THE Payment_Modal SHALL đặt timeout polling là 10 phút
2. WHEN timeout xảy ra, THE Payment_Modal SHALL hiển thị thông báo "Chưa nhận được xác nhận thanh toán"
3. THE Payment_Modal SHALL hiển thị nút "Kiểm tra lại" để thử polling lại
4. THE Payment_Modal SHALL hiển thị nút "Hủy và tạo mã mới" để tạo giao dịch mới
5. WHEN khách hàng nhấn "Kiểm tra lại", THE Payment_Modal SHALL gọi API kiểm tra trạng thái 1 lần
6. IF trạng thái vẫn là pending sau khi kiểm tra lại, THEN THE Payment_Modal SHALL hiển thị hướng dẫn liên hệ support

### Requirement 10: Tương thích với luồng hiện tại

**User Story:** Là developer, tôi muốn tính năng mới tương thích với code hiện tại, để giảm thiểu breaking changes và dễ dàng rollback nếu cần.

#### Acceptance Criteria

1. THE Payment_Modal SHALL giữ nguyên cấu trúc 3 bước: form → processing → success
2. THE Payment_Modal SHALL thay thế bước "processing" bằng hiển thị QR code và polling
3. THE Payment_Modal SHALL giữ nguyên logic auto-fill thông tin user đã đăng nhập
4. THE Payment_Modal SHALL giữ nguyên validation form (tên, SĐT bắt buộc)
5. THE Payment_Modal SHALL giữ nguyên logic lưu order vào localStorage
6. THE Edge_Function SHALL giữ nguyên endpoint POST /wedding-admin để tạo Wedding_Record
7. WHERE cấu hình feature flag "USE_REAL_PAYMENT" = false, THE Payment_Modal SHALL sử dụng fake payment như hiện tại
