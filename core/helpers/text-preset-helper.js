// Kho "mẫu văn bản" (preset) cho tab Giao diện → Văn bản: một cụm chữ đã set sẵn
// phông/cỡ/màu/khoảng cách, người dùng chỉ thay nội dung. File này chỉ khai báo
// DANH MỤC + CSS của từng mẫu; phần thả/kéo/lưu ở theme-setting-helper.js (mục
// CUSTOM BLOCKS), bảng chọn ở 05-theme-panel.js — thêm mẫu mới chỉ sửa file này.
//
// Khai báo một mẫu:
//   id      khoá lưu trong custom_blocks[].preset
//   name    chữ hiện ở bảng chọn; desc là dòng phụ bên dưới
//   parts   [{ key, tag, label, def, inline, multiline }] — mỗi part là MỘT phần
//           chữ chỉnh riêng được (bấm vào nó mở bảng chỉnh phông/cỡ/màu).
//           key vào id thật: "<blockId>__<key>"; các part inline liền nhau được
//           gộp vào một dòng (dùng cho tiêu đề hai tông màu).
//   css     style mặc định, PHẢI bọc trong .cx-tpl-<id> để không đụng mẫu khác.
//           Cỡ chữ trong mẫu viết bằng `em` → chụm 2 ngón phóng cả cụm cân đối.
//           Màu để `inherit`/`currentColor` cho hợp mọi theme.
//
// Nạp TRƯỚC theme-setting-helper.js (cả loader.js lẫn public/themes/*/index.html).

(function () {
  const PRESETS = [
    {
      id: "headline",
      name: "Tiêu đề & mô tả",
      desc: "Tiêu đề lớn hai tông màu, mô tả ngắn bên dưới",
      parts: [
        { key: "title", tag: "span", label: "Tiêu đề", inline: true, def: "Save the" },
        { key: "accent", tag: "span", label: "Chữ nhấn", inline: true, def: "Date" },
        {
          key: "detail",
          tag: "p",
          label: "Mô tả",
          multiline: true,
          def: "Chúng mình sẽ về chung một nhà — rất mong có bạn ở đó để ngày vui thêm trọn vẹn.",
        },
      ],
      css:
        ".cx-tpl-headline{text-align:left;max-width:min(88%,420px);margin:0 auto;font-size:16px}" +
        ".cx-tpl-headline .cx-tpl-row{margin:0 0 8px}" +
        ".cx-tpl-headline__title,.cx-tpl-headline__accent{font-size:2em;font-weight:800;letter-spacing:-.02em;line-height:1.15}" +
        ".cx-tpl-headline__accent{opacity:.55}" +
        ".cx-tpl-headline__detail{font-size:.95em;line-height:1.6;opacity:.75;margin:0}",
    },
    {
      id: "poster",
      name: "Áp phích",
      desc: "Dòng nhỏ in hoa, tiêu đề lớn, kẻ mảnh rồi tới mô tả",
      parts: [
        { key: "eyebrow", tag: "p", label: "Dòng dẫn", def: "Trân trọng kính mời" },
        { key: "title", tag: "p", label: "Tiêu đề", def: "Lễ Thành Hôn" },
        {
          key: "detail",
          tag: "p",
          label: "Mô tả",
          multiline: true,
          def: "Sự hiện diện của bạn là niềm vinh hạnh của gia đình chúng tôi.",
        },
      ],
      css:
        ".cx-tpl-poster{text-align:center;max-width:min(90%,460px);margin:0 auto;font-size:16px}" +
        ".cx-tpl-poster__eyebrow{font-size:.72em;letter-spacing:.32em;text-transform:uppercase;opacity:.6;margin:0 0 8px}" +
        ".cx-tpl-poster__title{font-size:2.4em;line-height:1.1;margin:0}" +
        // Kẻ mảnh dưới tiêu đề: phần trang trí của mẫu nên vẽ bằng CSS, không
        // thành một part để người dùng khỏi phải chỉnh.
        ".cx-tpl-poster__title::after{content:'';display:block;width:48px;height:1px;background:currentColor;opacity:.4;margin:16px auto}" +
        ".cx-tpl-poster__detail{font-size:.9em;line-height:1.7;opacity:.75;margin:0}",
    },
    {
      id: "subtitle",
      name: "Phụ đề phim",
      desc: "Câu thoại nghiêng canh giữa, tên người nói bên dưới",
      parts: [
        {
          key: "quote",
          tag: "p",
          label: "Câu thoại",
          multiline: true,
          def: "Đi khắp thế gian, cuối cùng vẫn muốn về nhà — nơi có em.",
        },
        { key: "by", tag: "p", label: "Người nói", def: "Lời của chú rể" },
      ],
      css:
        ".cx-tpl-subtitle{text-align:center;max-width:min(88%,440px);margin:0 auto;font-size:16px}" +
        ".cx-tpl-subtitle__quote{font-size:1.15em;font-style:italic;line-height:1.6;margin:0}" +
        ".cx-tpl-subtitle__by{font-size:.7em;letter-spacing:.22em;text-transform:uppercase;opacity:.6;margin:12px 0 0}",
    },
  ];

  const BASE_CSS =
    ".cx-tpl{width:100%}" +
    ".cx-tpl p{margin:0}" +
    // Nhóm part inline: các span nằm chung một dòng, cách nhau một khoảng trắng.
    ".cx-tpl .cx-tpl-row{display:block}" +
    ".cx-tpl .cx-tpl-row>*+*{margin-left:.25em}";

  const byId = {};
  PRESETS.forEach((p) => (byId[p.id] = p));

  // Dựng DOM của mẫu. content = { <key>: text }, thiếu key nào thì lấy def.
  // idPrefix có thì mỗi part được gán id "<idPrefix>__<key>" + data-cx-part để
  // bảng chỉnh chi tiết và text_overrides nhắm được từng phần; bỏ trống (xem
  // trước ở bảng chọn) thì không gán id, tránh trùng id với khối thật.
  function build(def, content, idPrefix) {
    const root = document.createElement("div");
    root.className = "cx-tpl cx-tpl-" + def.id;
    let row = null;
    def.parts.forEach((p) => {
      const el = document.createElement(p.tag || "p");
      el.className = "cx-tpl-" + def.id + "__" + p.key;
      const v = content && content[p.key] != null ? content[p.key] : p.def;
      el.textContent = String(v);
      if (idPrefix) {
        el.id = idPrefix + "__" + p.key;
        el.setAttribute("data-cx-part", p.key);
        // Nội dung nằm trong model (custom_blocks) → applyTextOverrides không ghi đè.
        el.setAttribute("data-cx-bound", "1");
      }
      if (p.inline) {
        if (!row) {
          row = document.createElement("div");
          row.className = "cx-tpl-row";
          root.appendChild(row);
        }
        row.appendChild(el);
      } else {
        row = null;
        root.appendChild(el);
      }
    });
    return root;
  }

  // Chèn CSS của toàn bộ mẫu vào một document (iframe thiệp lẫn trang chỉnh, để
  // ô xem trước ở bảng chọn hiện đúng kiểu). Gọi bao nhiêu lần cũng được.
  function ensureStyle(doc) {
    const d = doc || document;
    if (d.getElementById("cx-tpl-style")) return;
    const s = d.createElement("style");
    s.id = "cx-tpl-style";
    s.textContent = BASE_CSS + PRESETS.map((p) => p.css || "").join("");
    d.head.appendChild(s);
  }

  window.CX_TEXT_PRESETS = PRESETS;
  window.CX_TEXT_PRESET_GET = (id) => byId[id] || null;
  window.CX_TEXT_PRESET_BUILD = build;
  window.CX_TEXT_PRESET_ENSURE_STYLE = ensureStyle;
})();
