// Xưng hô đối lại theo danh xưng của khách (Cô ↔ cháu, Anh ↔ em, Bác ↔ cháu…) để mẫu viết
// câu chat một lần dạng khuôn rồi điền theo từng khách. Danh xưng lấy từ link mời
// (CX_GUEST.relationship — danh sách ở GUEST_RELATIONS, invitation-setup/guests/index.js);
// bản xem thử giả lập bằng ?guest=&rel=. Mẫu nào dùng thì tự nạp file này (sau utils.js).
//
// Chỗ trống trong khuôn ({Xxx} = viết hoa chữ đầu):
//   {goi}  cô dâu chú rể gọi khách          bạn · anh · cô · cả nhà
//   {ta}   cô dâu chú rể tự xưng            tụi mình · tụi em · tụi cháu · anh chị
//   {toi}  khách tự xưng (bong bóng khách)  mình · anh · cô · em
//   {hai}  khách gọi cô dâu chú rể          hai bạn · hai em · hai cháu · anh chị
//   {chao} lời gọi kèm tên                  Bạn Hoàng · Cô Lan · Bạn (chưa có tên)
//   {ne} {nha} {nhe} {a}  tiểu từ cuối câu — với bậc trên (lễ phép) thành "ạ" / "với ạ"
//   {duoc} mở đầu câu nhận lời              Được chứ · Dạ

(function () {
  // [gọi, tự xưng, khách tự xưng, khách gọi cặp đôi, lễ phép, nhãn gọi kèm tên]
  // Nhãn rỗng = dùng chính danh xưng; null = gọi chung, không kèm tên.
  const ELDER = (g) => [g, "tụi cháu", g, "hai cháu", true];
  const TABLE = {
    "bạn": ["bạn", "tụi mình", "mình", "hai bạn", false],
    "đồng nghiệp": ["bạn", "tụi mình", "mình", "hai bạn", false, "Bạn"],
    "anh": ["anh", "tụi em", "anh", "hai em", false],
    "chị": ["chị", "tụi em", "chị", "hai em", false],
    "anh chị": ["anh chị", "tụi em", "anh chị", "hai em", false],
    "em": ["em", "anh chị", "em", "anh chị", false],
    "vợ chồng": ["hai bạn", "tụi mình", "vợ chồng mình", "hai bạn", false],
    "cô": ELDER("cô"),
    "chú": ELDER("chú"),
    "bác": ELDER("bác"),
    "dì": ELDER("dì"),
    "cậu": ELDER("cậu"),
    "mợ": ELDER("mợ"),
    "thím": ELDER("thím"),
    "dượng": ELDER("dượng"),
    "ông": ELDER("ông"),
    "bà": ELDER("bà"),
    "ông bà": ELDER("ông bà"),
    "cô chú": ELDER("cô chú"),
    "thầy": ["thầy", "tụi em", "thầy", "hai em", true],
    "cô giáo": ["cô", "tụi em", "cô", "hai em", true, "Cô"],
    "sếp": ["sếp", "tụi em", "mình", "hai em", true],
    "gia đình": ["cả nhà", "tụi mình", "cả nhà", "hai đứa", false],
    "họ hàng": ["cả nhà", "tụi mình", "cả nhà", "hai đứa", false, null],
  };

  const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
  const norm = (s) => String(s || "").trim().replace(/\s+/g, " ").toLowerCase();

  class CXXungHo {
    // Bộ vai cho một danh xưng. Danh xưng lạ: gọi bằng chính nó, còn lại như "Bạn".
    static of(relationship, name) {
      const rel = norm(relationship) || "bạn";
      const row = TABLE[rel] || [rel, "tụi mình", "mình", "hai bạn", false];
      const [goi, ta, toi, hai, polite] = row;
      const label = row.length > 5 ? row[5] : cap(rel);
      const nm = String(name || "").trim();
      return {
        goi,
        ta,
        toi,
        hai,
        polite,
        chao: label === null ? "Cả nhà" : nm ? `${label} ${nm}` : label,
        ne: polite ? "ạ" : "nè",
        nha: polite ? "ạ" : "nha",
        nhe: polite ? "với ạ" : "nhé",
        a: polite ? " ạ" : "",
        duoc: polite ? "dạ" : "được chứ",
      };
    }

    // Điền khuôn. {key} giữ nguyên chữ thường, {Key} viết hoa chữ đầu; khoá lạ để nguyên.
    static fill(tpl, roles) {
      return String(tpl || "").replace(/\{([A-Za-z]+)\}/g, (m, k) => {
        const v = roles[k.toLowerCase()];
        if (typeof v !== "string") return m;
        return k[0] === k[0].toUpperCase() ? cap(v) : v;
      });
    }

    // Đổi xưng hô trong câu chủ thiệp TỰ VIẾT (không có chỗ trống): "tụi mình / chúng mình /
    // bọn mình / chúng tôi" → {ta}; với guest: true thì "bạn" gọi khách → {goi} — trừ từ ghép
    // (bạn bè, bạn thân…) và "các / những bạn". Khách là bạn bè thì để nguyên câu.
    static adapt(text, roles, { guest = false } = {}) {
      let s = String(text || "");
      const L = "\\p{L}";
      const keepCase = (m, v) => (m[0] === m[0].toUpperCase() ? cap(v) : v);
      if (roles.ta !== "tụi mình")
        s = s.replace(new RegExp(`(?<![${L}])(tụi mình|chúng mình|bọn mình|chúng tôi)(?![${L}])`, "giu"), (m) => keepCase(m, roles.ta));
      if (guest && roles.goi !== "bạn")
        s = s.replace(
          new RegExp(`(?<![${L}])(?<!(?:các|những) )bạn(?![${L}])(?!\\s+(?:bè|thân|đời|trai|gái|học|cũ|ấy|nhỏ)(?![${L}]))`, "giu"),
          (m) => keepCase(m, roles.goi),
        );
      return s;
    }

    // Khách đang xem: link mời riêng (CX_GUEST, wedding-helper.js đặt) → bản xem thử
    // ?name=&rel= (hoặc ?guest=) → khách vãn lai (Bạn, không tên).
    static guest() {
      const g = window.CX_GUEST;
      if (g?.relationship) return { relationship: g.relationship, name: g.name || "" };
      const q = new URLSearchParams(location.search);
      const demo = q.get("name") || q.get("guest");
      if (window.isPreviewMode?.() && demo)
        return { relationship: q.get("rel") || "Bạn", name: demo };
      return { relationship: "Bạn", name: "" };
    }

    // Đổ mọi phần tử [data-cx-say="khuôn"] trong root theo khách đang xem. Gọi trong
    // renderWedding (trước applyTextOverrides — chủ thiệp sửa tay một câu thì câu sửa thắng).
    static apply(root = document, who = CXXungHo.guest()) {
      const roles = CXXungHo.of(who.relationship, who.name);
      root.querySelectorAll("[data-cx-say]").forEach((el) => {
        el.textContent = CXXungHo.fill(el.dataset.cxSay, roles);
      });
      return roles;
    }
  }

  window.CXXungHo = CXXungHo;
})();
