# CuoiXinh — Tổng quan hệ thống

## Mô tả

Nền tảng tạo thiệp cưới online cá nhân hóa. Người dùng chọn template, điền thông tin, thanh toán rồi nhận 2 link chia sẻ riêng (nhà trai / nhà gái) với tên khách mời được mã hóa.

---

## Sơ đồ luồng chính

> Node viền liền = tính năng hiện có · Node viền nét đứt = tính năng tương lai

```mermaid
flowchart TD
    classDef future fill:#f5f5f5,stroke:#999,stroke-dasharray:5 5,color:#555
    classDef cdcr fill:#fef9ec,stroke:#d4a017,color:#333
    classDef guest fill:#eef6fb,stroke:#3a85c0,color:#333
    classDef admin fill:#f3f0fa,stroke:#7c5cbf,color:#333

    subgraph landing ["🏠 Landing Page"]
        A([Trang chủ])
        A --> HERO[Hero · CTA\nTạo thiệp của tôi]:::cdcr
        A --> COUNTER[500+ cặp đôi\nthoả mãn · stats]
        A --> BROWSE[Carousel mẫu thiệp\n3D · giá trên card]
        A --> FEAT[Tính năng\nbên trong thiệp]
        A --> STEPS[Cách dùng\n4 bước đơn giản]
        A --> BENEFITS[Lý do chọn\nCưới Xinh]
        A --> TESTI[Testimonial\nkhách hàng nói gì]
        A --> CTA[CTA tối · liên hệ\nemail · SĐT]
        A --> LOGIN[Đăng nhập\n/ Đăng ký]:::cdcr
        BROWSE --> DEMO[Xem demo\nthiệp thật]
        BROWSE -. F-30 .-> FILTER[Lọc mẫu theo\nphong cách · màu]:::future
        DEMO --> B[Chọn mẫu\nvà tạo thiệp]:::cdcr
        HERO --> B
        LOGIN --> B
        LOGIN -- F-02 --> ACC[Trang account\nquản lý đơn hàng]:::cdcr
        LOGIN -. F-18 .-> AUTH[Đăng nhập email\n/ đặt lại mật khẩu]:::future
    end
    B --> C[Tạo draft]

    subgraph edit ["✏️ Chỉnh sửa — CDCR · miễn phí"]
        C --> D[Điền thông tin]:::cdcr
        D <--> PV[Preview real-time]:::cdcr
        D -. F-03 .-> D1[Đổi template\nsau khi tạo]:::future
        D -- F-04 --> D2[Tùy chỉnh\nmàu · font]:::cdcr
        D -. F-06 .-> D3[Slideshow /\nvideo cover]:::future
        D -- F-07 --> D4[AI gợi ý\nnội dung thiệp]:::cdcr
    end

    subgraph publish ["🚀 Publish & Thanh toán — CDCR"]
        D --> FREE[Publish dùng thử\nmiễn phí · 3 ngày]:::cdcr
        FREE --> EXP{Hết hạn?}:::cdcr
        EXP -- Chưa TT --> DEAD([Thiệp hết hạn]):::cdcr
        EXP -- Đã TT --> PERM([Thiệp vĩnh viễn]):::cdcr
        D --> PAY[Thanh toán\nPayOS QR]:::cdcr
        PAY --> R{Thành công?}:::cdcr
        R -- Thất bại --> PAY
        R -- Có --> PERM
        PAY -. F-16 .-> TIER[Chọn gói\nStandard · Premium]:::future
    end

    subgraph dist ["📤 Phân phối — CDCR"]
        FREE --> LINK[2 link chia sẻ\nnhà trai · nhà gái]:::cdcr
        PERM --> LINK
        LINK --> MANUAL[Nhập tên trực tiếp\ntạo link cá nhân]:::cdcr
        LINK --> MSG[Nút gửi\nqua Messenger]:::cdcr
        LINK -. F-17 .-> PDF[Xuất PDF\nđể in]:::future
        LINK -. F-22 .-> QRC[QR code thiệp\ncho thiệp giấy]:::future
        LINK -- F-23 --> CPY[Copy tin nhắn mẫu\nkèm link]:::cdcr
    end

    subgraph view ["👥 Trải nghiệm — Khách mời"]
        LINK --> V[Khách xem thiệp]:::guest
        V -- F-05 --> CD[Đếm ngược\nngày cưới]:::guest
        V -. F-12 .-> GB[Guestbook\nlời chúc]:::future
        V -. F-13 .-> RSVP[Xác nhận tham dự\n→ Supabase]:::future
        V -. F-24 .-> CAL[Thêm vào\nGoogle/Apple Calendar]:::future
        V -- F-31 --> QRMOBILE[Quét QR\nxem trên mobile]:::guest
    end

    subgraph mgmt ["📊 Quản lý — Admin / CDCR"]
        RSVP -. F-14 .-> ANL[Analytics\nlượt xem · tỉ lệ RSVP]:::future
        LINK -- F-10 --> GM[Quản lý khách\nnội bộ trong app]:::cdcr
        ADM[Dashboard Admin\nquản lý toàn bộ thiệp]:::admin
        ADM -. F-01 .-> TMPL[Quản lý &\nthêm mẫu thiệp]:::future
        ADM -. F-25 .-> STAT[Dashboard thống kê\ncho CDCR]:::future
        ADM -. F-26 .-> EXT[Gia hạn dùng thử\nbởi Admin]:::future
        ADM -. F-27 .-> TXLOG[Lịch sử\nthanh toán]:::future
    end
```

> **Chú giải màu:** 🟡 Vàng = CDCR (cô dâu chú rể) · 🔵 Xanh dương = Khách mời · 🟣 Tím = Quản trị hệ thống · ⬜ Nét đứt = Tính năng tương lai

---

## Sơ đồ kiến trúc

```mermaid
flowchart LR
    subgraph Browser
        UI[UI Layer\nHTML + JS]
        BL[BL Layer\nwedding-bl / image-bl]
        DAL[DAL Layer\nwedding-dal / storage-dal]
        IDB[(IndexedDB\nảnh pending + focal)]
        LS[(localStorage\ndraft text)]
        UI --> BL --> DAL
        UI <--> IDB
        UI <--> LS
    end

    subgraph Supabase
        DB[(PostgreSQL\nbảng weddings)]
        ST[(Storage\nwedding-images)]
        EF[Edge Function\npayment-handler]
    end

    subgraph Bên ngoài
        PO[PayOS\nQR thanh toán]
        YT[YouTube\nnhạc nền]
    end

    DAL --> DB
    DAL --> ST
    DAL --> EF
    EF --> PO
    UI --> YT
```

---

## Luồng chính

```
Chọn template → Tạo draft → Điền thông tin → Preview
→ Publish dùng thử (miễn phí, public 3 ngày) → Chia sẻ link → Khách RSVP
                                ↓ hết hạn
                   Thanh toán (PayOS QR) → Thiệp vĩnh viễn
```

---

## Tính năng hiện có

### Landing Page

| Mục          | Nội dung                                                  |
| ------------ | --------------------------------------------------------- |
| Hero & CTA        | Headline, nút "Tạo thiệp của tôi", trust badges                   |
| Stats             | 500+ cặp đôi, 10+ mẫu, 5★ đánh giá — hardcoded trong hero        |
| Carousel mẫu thiệp | 3D carousel, giá hiển thị trên từng card, xem demo thiệp thật   |
| Tính năng         | Section giới thiệu nội dung bên trong thiệp + phone mockup        |
| Cách dùng         | 4 bước đơn giản                                                   |
| Lý do chọn        | Benefits grid "Tại sao chọn Cưới Xinh?"                           |
| Testimonial       | Section "Khách hàng nói gì?" với testimonial cards                |
| CTA cuối          | Section tối, nút tạo thiệp, email + SĐT liên hệ                  |
| Đăng nhập         | Xác thực qua Supabase (magic link)                                |

### Chỉnh sửa thiệp (`invitation-setup`)

| Section             | Nội dung                                        |
| ------------------- | ----------------------------------------------- |
| Thông tin cặp đôi   | Tên, ảnh cặp đôi, ảnh cover, slogan             |
| Gia đình            | Tên bố mẹ, địa chỉ, ảnh riêng nhà trai/gái      |
| Lễ thành hôn        | Ngày giờ dương/âm, địa điểm, bản đồ             |
| Lễ vu quy           | Tùy chọn bật/tắt, giờ, địa điểm                 |
| Tiệc cưới           | Ngày giờ dương/âm, địa điểm, bản đồ (cả 2 nhà)  |
| Gallery ảnh         | Tối đa 7 ảnh, focal point per ảnh               |
| Timeline            | Lịch trình sự kiện theo loại (ceremony / party) |
| Câu chuyện tình yêu | Tối đa 10 mốc, mỗi mốc có ảnh + focal point     |
| Ngân hàng           | Số tài khoản, tên chủ, ảnh QR (cả 2 bên)        |
| Nhạc nền            | Link YouTube, bật/tắt                           |
| RSVP                | Bật/tắt, tin nhắn tùy chỉnh                     |
| Hiển thị section    | Toggle từng section độc lập                     |
| Footer              | Text chân trang                                 |

### Tùy chỉnh giao diện (F-04)

Màn "Giao diện" trong editor: đổi **phông chữ** (heading/body), **bảng màu** chủ đạo (heading, body, accent, background — chọn qua Coloris) ngay trong cùng template. Lưu vào `theme_setting`; mặc định rơi về preset gốc của từng theme.

### AI gợi ý nội dung (F-07)

Modal AI trong editor: nhập từ khóa → sinh nội dung thiệp (slogan, **câu chuyện tình yêu**, timeline…). Edge Function `ai-invitation` (Gemini key rotation + Groq fallback), có bảng `ai_usage` giới hạn lượt dùng.

### Focal Point

Tất cả ảnh (cover, groom, bride, gallery, love story) đều hỗ trợ chọn điểm lấy nét. Được lưu vào IDB để tồn tại qua F5 trước khi save.

### Template & Theme

- 3 template: `basic-gold`, `romantic-gold`, `vintage-forest`
- Mỗi template là một trang độc lập render từ dữ liệu JSON chung

### Lưu trữ

- **Supabase PostgreSQL** — dữ liệu chính
- **Supabase Storage** — ảnh đã upload
- **IndexedDB** — ảnh pending (chưa upload) + focal points
- **localStorage** — draft text (auto-save mỗi 1.5s)

### Thanh toán

- Tích hợp PayOS, tạo QR động
- Poll trạng thái mỗi 30s, timeout 5 phút
- Sau thanh toán: set `is_published = true`, hiển thị 2 link chia sẻ

### Chia sẻ & Khách mời

- 2 link cá nhân hóa: nhà trai / nhà gái
- Tên & quan hệ khách mã hóa AES trong URL
- Quản lý khách mời nội bộ trong app (lưu tại Supabase, không dùng Google Sheet)
- Tạo link nhanh trực tiếp: nhập tên + quan hệ → link cá nhân hóa ngay
- Nút chia sẻ qua Messenger (mobile: mở app, desktop: copy + hướng dẫn dán)
- **Câu mẫu chia sẻ (F-23):** 10 câu mời mẫu có sẵn, biến trộn `##Danh xưng##` / `##link##`, nút "Chèn mẫu" / "Đổi mẫu khác", copy để dán vào Zalo/FB

### Trải nghiệm khách mời

- **Đếm ngược ngày cưới (F-05):** widget countdown hiển thị trên thiệp
- Xác nhận tham dự (RSVP): nút Tham dự / Không tham dự hiển thị lời cảm ơn — *hiện chỉ phản hồi tại chỗ, chưa lưu Supabase (xem F-13)*
- **Quét QR xem trên mobile (F-31):** khi xem thiệp trên desktop (≥1024px), card nổi (góc dưới phải) hiện sẵn mã QR mã hoá link hiện tại (giữ nguyên tên khách đã cá nhân hoá nếu có) — không cần bấm gì, quét là mở luôn trên điện thoại. Có nút thu gọn về icon tròn nhỏ + nút sao chép liên kết dự phòng. Tự ẩn trong preview của editor. Thư viện `qrcodejs` nạp động qua CDN khi cần, không tải sẵn cho khách xem trên mobile.

### Quản lý đơn hàng cho khách (F-02)

- Trang account: gộp đơn ở localStorage (`orders_<email>` / `guestOrders`) với thiệp của user từ DB (`weddings.user_id`, edge `my-weddings`)
- Trạng thái đơn: draft / completed / pending / cancelled

### Admin

- Dashboard quản lý toàn bộ thiệp
- Tìm kiếm, pagination, edit slug, toggle active, xóa

---

## Tính năng tương lai (Roadmap)

### P0 — Nền tảng (cần thiết để scale)

| #    | Tính năng                      | Mô tả                                                                          |
| ---- | ------------------------------ | ------------------------------------------------------------------------------ |
| F-01 | **Thêm template**              | Mở rộng lên 5–10 template, đa dạng phong cách (hiện đại, tối giản, màu pastel) |
| F-03 | **Đổi template sau khi tạo**   | Cho phép chuyển theme mà không mất dữ liệu                                     |

### P1 — Trải nghiệm người dùng

| #    | Tính năng                            | Mô tả                                                           |
| ---- | ------------------------------------ | --------------------------------------------------------------- |
| F-06 | **Slideshow / video cover**          | Thay ảnh bìa bằng slideshow nhiều ảnh hoặc video ngắn           |
| F-08 | **Ảnh bìa + overlay text tùy chỉnh** | Thêm text / sticker lên ảnh bìa trong editor                    |
| F-30 | **Lọc mẫu thiệp**                    | Lọc / tìm kiếm mẫu theo phong cách, màu sắc (khi có nhiều mẫu)  |

### P2 — Khách mời & Tương tác

| #    | Tính năng                     | Mô tả                                                                |
| ---- | ----------------------------- | -------------------------------------------------------------------- |
| F-12 | **Guestbook (Sổ lưu bút)**     | Khách gửi lời chúc, cặp đôi duyệt và hiển thị trên thiệp              |
| F-13 | **Xác nhận tham dự (RSVP)**    | Lưu trạng thái tham dự / từ chối của khách vào Supabase (nút đã có, chưa lưu DB) |
| F-14 | **Analytics cơ bản**           | Số lượt xem, số khách RSVP, tỉ lệ tham dự per event                   |
| F-22 | **QR code thiệp**              | Tạo QR code để in lên thiệp giấy, khách quét để mở thiệp online       |
| F-24 | **Thêm vào Calendar**          | Nút thêm ngày cưới vào Google Calendar / Apple Calendar cho khách      |
| F-25 | **Dashboard thống kê cho CDCR**| Trang xem ai đã xem thiệp, ai chưa, tỉ lệ RSVP — không cần vào Sheet |

### P3 — Mở rộng nghiệp vụ

| #    | Tính năng                              | Mô tả                                                                           |
| ---- | -------------------------------------- | ------------------------------------------------------------------------------- |
| F-16 | **Gói dịch vụ (pricing tiers)**        | Free (draft xem trước) / Standard / Premium (thêm template, tính năng nâng cao) |
| F-17 | **Thiệp có thể in**                    | Xuất thiệp ra PDF chuẩn in A5/A6                                                |
| F-18 | **Đặt lại mật khẩu / đăng nhập email** | Bổ sung Auth đầy đủ thay vì chỉ dùng Supabase magic link                        |
| F-19 | **White-label / agency mode**          | Cho phép công ty tổ chức tiệc cưới tạo thiệp cho nhiều khách hàng               |
| F-26 | **Gia hạn dùng thử**                   | Admin gia hạn thêm ngày cho thiệp sắp hết hạn chưa thanh toán                   |
| F-27 | **Lịch sử thanh toán**                 | Log giao dịch PayOS để tra cứu khi có tranh chấp                                |
| F-20 | **API public**                         | API để tích hợp với phần mềm quản lý tiệc cưới bên thứ ba                       |
