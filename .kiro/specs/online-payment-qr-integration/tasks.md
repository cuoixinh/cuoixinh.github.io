# Implementation Plan: Online Payment QR Integration

## Overview

Tích hợp cổng thanh toán PayOS vào hệ thống thiệp cưới online, cho phép khách hàng thanh toán thực tế qua QR code thay vì thanh toán giả lập. Hệ thống sẽ hiển thị mã QR, polling trạng thái thanh toán, nhận webhook từ PayOS, và tự động tạo wedding record sau khi thanh toán thành công.

**Tech Stack:**

- Frontend: Vanilla JavaScript + Tailwind CSS
- Backend: Supabase Edge Functions (Deno/TypeScript)
- Database: Supabase PostgreSQL
- Payment Gateway: PayOS API

## Tasks

- [x] 1. Cập nhật database schema
  - Thêm 5 columns mới vào bảng `weddings`: payment_status, payment_order_id, transaction_id, payment_time, payment_amount
  - Tạo indexes cho payment_order_id và transaction_id
  - Tạo bảng `payment_logs` để audit trail
  - _Requirements: 3.4, 3.5, 4.6_

- [ ] 2. Tạo Edge Function: payment-handler
  - [x] 2.1 Tạo file structure và CORS headers
    - Tạo `supabase/functions/payment-handler/index.ts`
    - Setup CORS headers tương tự wedding-admin
    - Setup Supabase client với service role key
    - _Requirements: 10.1, 10.6_

  - [x] 2.2 Implement endpoint POST /create-payment
    - Validate input: manage_id, customer_name, customer_phone, template_name, amount
    - Generate unique order_id (timestamp + random)
    - Call PayOS API `/v2/payment-requests` để tạo QR code
    - Lưu pending payment vào database
    - Return QR code (base64) và payment info
    - _Requirements: 1.1, 1.2, 1.3_

  - [ ]\* 2.3 Write property test for POST /create-payment
    - **Property 2: QR Code VietQR Format Compliance**
    - **Validates: Requirements 1.2**

  - [x] 2.4 Implement endpoint GET /check-payment-status
    - Accept query parameter: order_id
    - Query database by payment_order_id
    - Return payment status (pending/completed/failed)
    - Nếu completed, return manage_id và slug
    - _Requirements: 2.2, 2.3_

  - [ ]\* 2.5 Write property test for GET /check-payment-status
    - **Property 5: Polling API Call Correctness**
    - **Validates: Requirements 2.2**

  - [x] 2.6 Implement endpoint POST /webhook
    - Parse PayOS webhook payload
    - Verify HMAC-SHA256 signature với secret key
    - Extract manage_id từ payment description
    - Validate amount = 299000
    - Check transaction_id chưa được xử lý (idempotency)
    - Update payment_status = 'completed' trong database
    - Call wedding-admin POST để tạo wedding record
    - Return HTTP 200 OK
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 4.1_

  - [ ]\* 2.7 Write property test for webhook signature verification
    - **Property 7: Webhook Signature Verification**
    - **Validates: Requirements 3.2, 8.1**

  - [ ]\* 2.8 Write property test for webhook success handling
    - **Property 8: Webhook Success Handling**
    - **Validates: Requirements 3.4, 3.5, 3.6**

  - [ ]\* 2.9 Write unit tests for webhook validation
    - Test invalid signature → HTTP 401
    - Test amount mismatch → HTTP 400
    - Test duplicate transaction → HTTP 200 (idempotent)
    - Test missing manage_id → HTTP 400
    - _Requirements: 8.2, 8.3, 8.4, 8.5, 8.6_

- [ ] 3. Implement PayOS API integration utilities
  - [x] 3.1 Create PayOS API client helper
    - Function generateSignature(data, secretKey) → HMAC-SHA256
    - Function createPaymentRequest(orderData) → Call PayOS API
    - Function verifyWebhookSignature(payload, signature) → Boolean
    - Store API keys trong Supabase Secrets
    - _Requirements: 8.1, 8.2_

  - [ ]\* 3.2 Write property test for signature generation
    - **Property 7: Webhook Signature Verification**
    - **Validates: Requirements 3.2, 8.1**

- [x] 4. Checkpoint - Test Edge Function endpoints
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Modify Frontend: Payment Modal (payment.js)
  - [x] 5.1 Add constants và state management
    - Add PAYMENT_API_URL constant
    - Add POLLING_INTERVAL = 3000ms
    - Add POLLING_TIMEOUT = 600000ms (10 phút)
    - Add state variables: pollingTimer, pollingStartTime
    - _Requirements: 2.1, 9.1_

  - [x] 5.2 Implement createPayment() function
    - Validate form inputs (name, phone required)
    - Generate manage_id (UUID v4) ở client
    - Call POST /create-payment với order data
    - Handle API errors và display error message
    - Return QR code và payment info
    - _Requirements: 1.1, 7.1, 7.2, 7.5_

  - [ ]\* 5.3 Write unit test for form validation
    - **Property 31: Form Validation Rules Preservation**
    - **Validates: Requirements 10.4**

  - [x] 5.3 Implement displayQRCode() function
    - Update Step 2 UI để hiển thị QR code image
    - Display payment info: bank name, account number, amount, content
    - Display instructions: "Mở app ngân hàng → Quét QR → Xác nhận"
    - Display spinner và "Đang chờ thanh toán..."
    - _Requirements: 1.3, 1.4, 1.5_

  - [ ]\* 5.4 Write property test for QR display
    - **Property 1: QR Code Display on Payment Initiation**
    - **Validates: Requirements 1.1**

  - [x] 5.5 Implement polling logic
    - Function startPolling(orderId) → Set interval 3 giây
    - Function checkPaymentStatus(orderId) → Call GET endpoint
    - Function stopPolling() → Clear interval
    - Khi status = 'completed', dừng polling và chuyển sang Step 3
    - Khi timeout (10 phút), dừng polling và hiển thị timeout UI
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 9.1_

  - [ ]\* 5.6 Write property test for polling interval
    - **Property 4: Polling Interval Consistency**
    - **Validates: Requirements 2.1**

  - [ ]\* 5.7 Write property test for polling termination
    - **Property 6: Polling Termination on Success**
    - **Validates: Requirements 2.3, 2.4**

  - [x] 5.8 Implement timeout và retry UI
    - Display timeout message: "Chưa nhận được xác nhận thanh toán"
    - Add button "Kiểm tra lại" → Call checkPaymentStatus() once
    - Add button "Tạo mã mới" → Call createPayment() again
    - Display timer countdown trong Step 2
    - _Requirements: 9.2, 9.3, 9.4, 9.5, 9.6_

  - [ ]\* 5.9 Write unit tests for timeout handling
    - Test timeout after 10 minutes
    - Test "Kiểm tra lại" button
    - Test "Tạo mã mới" button
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [x] 5.10 Update PaymentModal.process() function
    - Replace fake delay với createPayment() call
    - Display QR code trong Step 2
    - Start polling sau khi QR displayed
    - Handle errors và preserve form state
    - _Requirements: 10.2, 7.5_

  - [x] 5.11 Update success screen (Step 3)
    - Display manage link: /manage-by-customer.html?id={manage_id}
    - Keep existing UI: customer info, template name, buttons
    - Update localStorage order status từ pending → completed
    - Save manage_id, transaction_id, payment_time vào order
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 6.3, 6.4_

  - [ ]\* 5.12 Write property test for localStorage updates
    - **Property 13: Order Status Transition**
    - **Property 14: Payment Data Persistence in LocalStorage**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4**

  - [ ]\* 5.13 Write property test for storage keys
    - **Property 15: Authenticated User Storage Key**
    - **Property 16: Guest User Storage Key**
    - **Validates: Requirements 5.5, 5.6**

- [x] 6. Add error handling
  - [x] 6.1 Handle network errors
    - Display "Lỗi kết nối, vui lòng kiểm tra mạng"
    - Preserve form state
    - Show "Thử lại" button
    - Log error to console
    - _Requirements: 7.2, 7.4, 7.5, 7.6_

  - [x] 6.2 Handle API errors
    - Parse error message từ response
    - Display specific error hoặc generic fallback
    - Preserve form state
    - Show "Thử lại" button
    - _Requirements: 7.1, 7.4, 7.5_

  - [ ]\* 6.3 Write unit tests for error scenarios
    - Test network timeout
    - Test API 4xx/5xx errors
    - Test invalid response format
    - Test form state preservation
    - _Requirements: 7.1, 7.2, 7.4, 7.5, 7.6_

- [ ] 7. Checkpoint - Test frontend integration
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Update wedding-admin Edge Function
  - [x] 8.1 Verify POST endpoint compatibility
    - Ensure endpoint accepts id (manage_id) và slug
    - Ensure endpoint returns created id và slug
    - Ensure slug conflict handling works (auto-suffix)
    - _Requirements: 4.2, 4.3, 10.6_

  - [ ]\* 8.2 Write property test for slug generation
    - **Property 10: Slug Generation from Customer Info**
    - **Validates: Requirements 4.2**

  - [ ]\* 8.3 Write property test for slug conflict resolution
    - **Property 11: Slug Conflict Resolution**
    - **Validates: Requirements 4.3**

  - [ ]\* 8.4 Write property test for wedding record defaults
    - **Property 12: Wedding Record Default Values**
    - **Validates: Requirements 4.4, 4.5, 4.6**

- [x] 9. Add feature flag support
  - [x] 9.1 Add USE_REAL_PAYMENT flag
    - Add constant USE_REAL_PAYMENT = true/false
    - If false, use existing fake payment delay (1.5s)
    - If true, use new QR payment flow
    - _Requirements: 10.7_

  - [x] 9.2 Test feature flag toggle
    - Test với flag = false → Fake payment works
    - Test với flag = true → Real payment works
    - _Requirements: 10.7_

- [ ] 10. Integration testing
  - [ ]\* 10.1 Write end-to-end integration test
    - Test complete flow: form → QR → webhook → success
    - Mock PayOS API responses
    - Verify database updates
    - Verify localStorage updates
    - _Requirements: All_

  - [ ]\* 10.2 Write integration test for timeout scenario
    - Test polling timeout after 10 minutes
    - Test "Kiểm tra lại" flow
    - Test "Tạo mã mới" flow
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [ ]\* 10.3 Write integration test for error recovery
    - Test network error → retry → success
    - Test API error → retry → success
    - Test form state preservation
    - _Requirements: 7.1, 7.2, 7.4, 7.5_

- [ ] 11. Security testing
  - [ ]\* 11.1 Test webhook signature verification
    - Test valid signature → Accept
    - Test invalid signature → Reject (401)
    - Test missing signature → Reject (401)
    - Test tampered payload → Reject (401)
    - _Requirements: 8.1, 8.2, 8.3_

  - [ ]\* 11.2 Test input validation
    - Test SQL injection attempts in manage_id
    - Test XSS attempts in customer name
    - Test special characters in slug
    - Verify parameterized queries
    - _Requirements: 8.3, 8.4_

- [ ] 12. Final checkpoint - End-to-end testing
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- PayOS API keys phải được lưu trong Supabase Secrets, không hardcode
- Database migration phải chạy trước khi deploy Edge Functions
- Feature flag cho phép rollback nhanh nếu có vấn đề
