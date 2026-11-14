// Mẫu SỚM HÔM CÓ NHAU — thiệp trang dài nền trắng tối giản, ảnh xen ca dao. Chỉ KHAI
// BÁO: window.CX_THEME + renderWedding + phần đặc thù (album theo bố cục cố định, khối ngày
// lớn, lịch tháng đè ảnh). Phần "chạy" nằm ở core/helpers/theme-boot.js.
// Bọc IIFE: `const` cấp cao nhất của script cổ điển là biến toàn cục.

(function () {
  window.CX_THEME = {
    // Trùng TÊN THƯ MỤC và cột `templates.template_name`.
    id: "som-hom-co-nhau",

    wishesMode: "card",
    giftBox: "lixi_do_hy",

    music: { variant: "mini", chrome: "fixed-corner", art: "couple" },

    // Bộ màu MẶC ĐỊNH của mẫu — bản khai máy đọc được của đúng những giá trị
    // :root trong theme.css (nguồn sự thật). Trang Thiết lập đọc nó để hiện mục
    // "Mặc định"; theme_setting.palette ghi đè lên trên lúc chạy.
    // Sinh lại bằng: node scripts/check-theme-palette.mjs --write
    palette: {
      heading: "#fbefe6",
      body: "#efdcd5",
      accent: "#e3c27f",
      accent_soft: "#6a1d25",
      on_accent: "#4e1319",
      on_image: "#ffffff",
      on_lightbox: "#ffffff",
      card_bg: "#4e1319",
      page_bg: "#f4eee2",
      surface: "#571920",
      band: "#44101a",
      panel: "#5c1b23",
      panel_warm: "#62212a",
      cover: "#4e1319",
      cover_mid: "#5e1a22",
      cover_veil: "#4e1319",
      lightbox_bg: "#000000",
      line: "#8f6440",
      shadow: "#1e0507",
      scrim: "#170a0b",
      deco: "#d9b266",
      deco_soft: "#3f0e13",
      deco_2: "#d4aeab",
      deco_2_soft: "#6b2a31",
      shine_from: "#f6e2ae",
      shine_mid: "#d9b266",
      shine_to: "#a87c34",
    },

    // Biến thể tông của chính mẫu này, hiện ngay sau "Mặc định" (đỏ rượu) ở tab Giao diện →
    // Bộ màu. Bộ NỀN TỐI (`dark: true`: "Độ đậm" chỉ đổi độ sáng mảng sẫm) cùng khuôn màu gốc:
    // `vars` khai lại đủ biến --sh-* của :root ở theme.css. `wishes` thay CX_THEME.wishes, khai
    // bằng TÊN khoá bộ màu. `id` lưu xuống DB → đừng đổi; thêm bộ mới thì chạy
    // `npm run check:palette-contrast`. "som-hom-do-ruou" đã thành màu gốc nên không khai lại.
    palettes: [
      // "Hồng phấn": bộ NỀN SÁNG kiểu thiệp giấy — mục thẻ hồng phấn chữ đen, mục xen kẽ giấy
      // trắng, bìa giấy trắng phong bì hồng, dấu sáp trắng in hoa hồng, lá xanh như cành tulip.
      // Có `vars` nên .sh-lite không trả bìa/mục xen kẽ về token chung (shLite ở dưới).
      {
        id: "som-hom-hong-phan",
        name: "Hồng phấn",
        heading: "#1f1a1c",
        body: "#3d3436",
        accent: "#2b2325",
        accent_soft: "#f9e3e7",
        on_accent: "#ffffff",
        on_image: "#ffffff",
        on_lightbox: "#ffffff",
        card_bg: "#f6d6db",
        page_bg: "#f3eeef",
        surface: "#f7dade",
        band: "#f2ccd2",
        panel: "#f9e3e7",
        panel_warm: "#fae8eb",
        cover: "#f2c9ce",
        cover_mid: "#eebcc4",
        cover_veil: "#f2c9ce",
        lightbox_bg: "#000000",
        line: "#dca7b1",
        shadow: "#6b4a52",
        scrim: "#1c1517",
        deco: "#b9707f",
        deco_soft: "#f9e3e7",
        deco_2: "#6e545a",
        deco_2_soft: "#ecc0c8",
        shine_from: "#ffffff",
        shine_mid: "#f6e3e6",
        shine_to: "#e3c0c7",
        wishes: { bubble: "panel", text: "body", accent: "heading", btn: "accent" },
        vars: {
          "--sh-cv-bg-rgb": "#f9f6f5",
          "--sh-cv-bg-2-rgb": "#f3eeee",
          "--sh-cv-glow-a-rgb": "#ffffff",
          "--sh-cv-glow-b-rgb": "#f6e3e6",
          "--sh-cv-ink-rgb": "#2a2426",
          "--sh-cv-muted-rgb": "#6e545a",
          "--sh-cv-amp-rgb": "#b9707f",
          "--sh-cv-btn-rgb": "#ffffff",
          "--sh-seal-hi-rgb": "#ffffff",
          "--sh-seal-mid-rgb": "#f3eeec",
          "--sh-seal-lo-rgb": "#d9cfcd",
          "--sh-seal-ink-rgb": "#e3a3b0",
          "--sh-rose-a-rgb": "#f0b7c1",
          "--sh-rose-b-rgb": "#ffffff",
          "--sh-rose-c-rgb": "#d88a9b",
          "--sh-leaf-rgb": "#6f8f62",
          "--sh-berry-rgb": "#d88a9b",
          "--sh-env-in-a-rgb": "#e9b3bd",
          "--sh-env-in-b-rgb": "#d49aa6",
          "--sh-alt-bg-rgb": "#ffffff",
          "--sh-alt-bg-2-rgb": "#f8f5f4",
          "--sh-alt-heading-rgb": "#1f1a1c",
          "--sh-alt-body-rgb": "#3d3436",
          "--sh-alt-accent-rgb": "#2b2325",
          "--sh-alt-accent-soft-rgb": "#f6e3e6",
          "--sh-alt-on-accent-rgb": "#ffffff",
          "--sh-alt-surface-rgb": "#faf7f6",
          "--sh-alt-band-rgb": "#f6eff0",
          "--sh-alt-panel-rgb": "#ffffff",
          "--sh-alt-panel-warm-rgb": "#fcfafa",
          "--sh-alt-line-rgb": "#e6dadc",
          "--sh-alt-deco-rgb": "#b9707f",
          "--sh-alt-deco-soft-rgb": "#f6e3e6",
          "--sh-alt-deco-2-rgb": "#6e545a",
          "--sh-alt-deco-2-soft-rgb": "#efe5e6",
        },
      },
      // Mỗi bộ dưới đây ứng với một bộ sáng của danh mục chung: đúng khuôn màu gốc đỏ rượu,
      // mọi màu họ đỏ đổi sang tông đó (mảng sẫm sáng hơn đỏ rượu một chút, cùng mức với
      // "Tím mận"); giấy kem, vàng (nhấn, dấu sáp, ánh kim) và lá giữ nguyên.
      // "Tím mận": ứng với "Oải hương".
      {
        id: "som-hom-tim-man",
        name: "Tím mận",
        dark: true,
        heading: "#fbefe6",
        body: "#e7d5ef",
        accent: "#e3c27f",
        accent_soft: "#683080",
        on_accent: "#522366",
        on_image: "#ffffff",
        on_lightbox: "#ffffff",
        card_bg: "#522366",
        page_bg: "#f4eee2",
        surface: "#592b6e",
        band: "#4a1f5d",
        panel: "#5e2d73",
        panel_warm: "#643478",
        cover: "#522366",
        cover_mid: "#5f2c75",
        cover_veil: "#522366",
        lightbox_bg: "#000000",
        line: "#8f6440",
        shadow: "#17051e",
        scrim: "#130a17",
        deco: "#d9b266",
        deco_soft: "#471d59",
        deco_2: "#c8abd4",
        deco_2_soft: "#6d3e80",
        shine_from: "#f6e2ae",
        shine_mid: "#d9b266",
        shine_to: "#a87c34",
        wishes: { bubble: "panel", text: "body", accent: "accent", btn: "accent" },
        vars: {
          "--sh-cv-bg-rgb": "#f6f0e4",
          "--sh-cv-bg-2-rgb": "#f1e9db",
          "--sh-cv-glow-a-rgb": "#fffaf1",
          "--sh-cv-glow-b-rgb": "#ece2cf",
          "--sh-cv-ink-rgb": "#522366",
          "--sh-cv-muted-rgb": "#825f90",
          "--sh-cv-amp-rgb": "#8a659a",
          "--sh-cv-btn-rgb": "#fffaf1",
          "--sh-seal-hi-rgb": "#f3dc96",
          "--sh-seal-mid-rgb": "#c99a3e",
          "--sh-seal-lo-rgb": "#8a5f1d",
          "--sh-seal-ink-rgb": "#6a4512",
          "--sh-rose-a-rgb": "#73308f",
          "--sh-rose-b-rgb": "#efe2cf",
          "--sh-rose-c-rgb": "#522366",
          "--sh-leaf-rgb": "#a89462",
          "--sh-berry-rgb": "#662a80",
          "--sh-env-in-a-rgb": "#5f2c75",
          "--sh-env-in-b-rgb": "#3a1849",
          "--sh-alt-bg-rgb": "#f1e9db",
          "--sh-alt-bg-2-rgb": "#f6f0e4",
          "--sh-alt-heading-rgb": "#522366",
          "--sh-alt-body-rgb": "#512e61",
          "--sh-alt-accent-rgb": "#73308f",
          "--sh-alt-accent-soft-rgb": "#ece2cf",
          "--sh-alt-on-accent-rgb": "#fbefe6",
          "--sh-alt-surface-rgb": "#f1e9db",
          "--sh-alt-band-rgb": "#ece2cf",
          "--sh-alt-panel-rgb": "#fffaf1",
          "--sh-alt-panel-warm-rgb": "#fbf5ea",
          "--sh-alt-line-rgb": "#d8c6a6",
          "--sh-alt-deco-rgb": "#7d329e",
          "--sh-alt-deco-soft-rgb": "#efe2cf",
          "--sh-alt-deco-2-rgb": "#825f90",
          "--sh-alt-deco-2-soft-rgb": "#e8dcc6",
        },
      },
      // "Hồng trầm": ứng với "Trắng hồng" — hồng trầm pha tro.
      {
        id: "som-hom-hong-tram",
        name: "Hồng trầm",
        dark: true,
        heading: "#fbefe6",
        body: "#ebdde2",
        accent: "#e3c27f",
        accent_soft: "#763a50",
        on_accent: "#58293a",
        on_image: "#ffffff",
        on_lightbox: "#ffffff",
        card_bg: "#58293a",
        page_bg: "#f4eee2",
        surface: "#613143",
        band: "#4d2433",
        panel: "#683447",
        panel_warm: "#6e3b4e",
        cover: "#58293a",
        cover_mid: "#693447",
        cover_veil: "#58293a",
        lightbox_bg: "#000000",
        line: "#8f6440",
        shadow: "#240e16",
        scrim: "#1e1317",
        deco: "#d9b266",
        deco_soft: "#47202e",
        deco_2: "#cab0ba",
        deco_2_soft: "#784759",
        shine_from: "#f6e2ae",
        shine_mid: "#d9b266",
        shine_to: "#a87c34",
        wishes: { bubble: "panel", text: "body", accent: "accent", btn: "accent" },
        vars: {
          "--sh-cv-bg-rgb": "#f6f0e4",
          "--sh-cv-bg-2-rgb": "#f1e9db",
          "--sh-cv-glow-a-rgb": "#fffaf1",
          "--sh-cv-glow-b-rgb": "#ece2cf",
          "--sh-cv-ink-rgb": "#58293a",
          "--sh-cv-muted-rgb": "#916b79",
          "--sh-cv-amp-rgb": "#a78693",
          "--sh-cv-btn-rgb": "#fffaf1",
          "--sh-seal-hi-rgb": "#f3dc96",
          "--sh-seal-mid-rgb": "#c99a3e",
          "--sh-seal-lo-rgb": "#8a5f1d",
          "--sh-seal-ink-rgb": "#6a4512",
          "--sh-rose-a-rgb": "#883d59",
          "--sh-rose-b-rgb": "#efe2cf",
          "--sh-rose-c-rgb": "#58293a",
          "--sh-leaf-rgb": "#a89462",
          "--sh-berry-rgb": "#77354d",
          "--sh-env-in-a-rgb": "#693448",
          "--sh-env-in-b-rgb": "#351722",
          "--sh-alt-bg-rgb": "#f1e9db",
          "--sh-alt-bg-2-rgb": "#f6f0e4",
          "--sh-alt-heading-rgb": "#58293a",
          "--sh-alt-body-rgb": "#54313e",
          "--sh-alt-accent-rgb": "#883d59",
          "--sh-alt-accent-soft-rgb": "#ece2cf",
          "--sh-alt-on-accent-rgb": "#fbefe6",
          "--sh-alt-surface-rgb": "#f1e9db",
          "--sh-alt-band-rgb": "#ece2cf",
          "--sh-alt-panel-rgb": "#fffaf1",
          "--sh-alt-panel-warm-rgb": "#fbf5ea",
          "--sh-alt-line-rgb": "#d8c6a6",
          "--sh-alt-deco-rgb": "#994363",
          "--sh-alt-deco-soft-rgb": "#efe2cf",
          "--sh-alt-deco-2-rgb": "#916b79",
          "--sh-alt-deco-2-soft-rgb": "#e8dcc6",
        },
      },
      // "Nâu cà phê": ứng với "Kem champagne" — nâu cà phê ánh vàng.
      {
        id: "som-hom-nau-ca-phe",
        name: "Nâu cà phê",
        dark: true,
        heading: "#fbefe6",
        body: "#e6ded7",
        accent: "#e3c27f",
        accent_soft: "#5e4a35",
        on_accent: "#443525",
        on_image: "#ffffff",
        on_lightbox: "#ffffff",
        card_bg: "#443525",
        page_bg: "#f4eee2",
        surface: "#4e3d2c",
        band: "#3d2e20",
        panel: "#52412f",
        panel_warm: "#594836",
        cover: "#443525",
        cover_mid: "#54422f",
        cover_veil: "#443525",
        lightbox_bg: "#000000",
        line: "#8f6440",
        shadow: "#1a130d",
        scrim: "#191510",
        deco: "#d9b266",
        deco_soft: "#382a1d",
        deco_2: "#c1b5a8",
        deco_2_soft: "#645241",
        shine_from: "#f6e2ae",
        shine_mid: "#d9b266",
        shine_to: "#a87c34",
        wishes: { bubble: "panel", text: "body", accent: "accent", btn: "accent" },
        vars: {
          "--sh-cv-bg-rgb": "#f6f0e4",
          "--sh-cv-bg-2-rgb": "#f1e9db",
          "--sh-cv-glow-a-rgb": "#fffaf1",
          "--sh-cv-glow-b-rgb": "#ece2cf",
          "--sh-cv-ink-rgb": "#443525",
          "--sh-cv-muted-rgb": "#817364",
          "--sh-cv-amp-rgb": "#9c8d7d",
          "--sh-cv-btn-rgb": "#fffaf1",
          "--sh-seal-hi-rgb": "#f3dc96",
          "--sh-seal-mid-rgb": "#c99a3e",
          "--sh-seal-lo-rgb": "#8a5f1d",
          "--sh-seal-ink-rgb": "#6a4512",
          "--sh-rose-a-rgb": "#6b5238",
          "--sh-rose-b-rgb": "#efe2cf",
          "--sh-rose-c-rgb": "#443525",
          "--sh-leaf-rgb": "#a89462",
          "--sh-berry-rgb": "#5d4630",
          "--sh-env-in-a-rgb": "#54422f",
          "--sh-env-in-b-rgb": "#291f15",
          "--sh-alt-bg-rgb": "#f1e9db",
          "--sh-alt-bg-2-rgb": "#f6f0e4",
          "--sh-alt-heading-rgb": "#443525",
          "--sh-alt-body-rgb": "#45392c",
          "--sh-alt-accent-rgb": "#6b5238",
          "--sh-alt-accent-soft-rgb": "#ece2cf",
          "--sh-alt-on-accent-rgb": "#fbefe6",
          "--sh-alt-surface-rgb": "#f1e9db",
          "--sh-alt-band-rgb": "#ece2cf",
          "--sh-alt-panel-rgb": "#fffaf1",
          "--sh-alt-panel-warm-rgb": "#fbf5ea",
          "--sh-alt-line-rgb": "#d8c6a6",
          "--sh-alt-deco-rgb": "#785a3d",
          "--sh-alt-deco-soft-rgb": "#efe2cf",
          "--sh-alt-deco-2-rgb": "#817364",
          "--sh-alt-deco-2-soft-rgb": "#e8dcc6",
        },
      },
      // "Cam đất": ứng với "Đào nắng" — cam đất nung.
      {
        id: "som-hom-cam-dat",
        name: "Cam đất",
        dark: true,
        heading: "#fbefe6",
        body: "#eddcd7",
        accent: "#e3c27f",
        accent_soft: "#763e29",
        on_accent: "#572c1c",
        on_image: "#ffffff",
        on_lightbox: "#ffffff",
        card_bg: "#572c1c",
        page_bg: "#f4eee2",
        surface: "#623423",
        band: "#4d2618",
        panel: "#683726",
        panel_warm: "#6f3f2d",
        cover: "#572c1c",
        cover_mid: "#6a3725",
        cover_veil: "#572c1c",
        lightbox_bg: "#000000",
        line: "#8f6440",
        shadow: "#230f08",
        scrim: "#1d130f",
        deco: "#d9b266",
        deco_soft: "#472315",
        deco_2: "#cdb1a7",
        deco_2_soft: "#7a4938",
        shine_from: "#f6e2ae",
        shine_mid: "#d9b266",
        shine_to: "#a87c34",
        wishes: { bubble: "panel", text: "body", accent: "accent", btn: "accent" },
        vars: {
          "--sh-cv-bg-rgb": "#f6f0e4",
          "--sh-cv-bg-2-rgb": "#f1e9db",
          "--sh-cv-glow-a-rgb": "#fffaf1",
          "--sh-cv-glow-b-rgb": "#ece2cf",
          "--sh-cv-ink-rgb": "#572c1c",
          "--sh-cv-muted-rgb": "#936d5e",
          "--sh-cv-amp-rgb": "#ab877b",
          "--sh-cv-btn-rgb": "#fffaf1",
          "--sh-seal-hi-rgb": "#f3dc96",
          "--sh-seal-mid-rgb": "#c99a3e",
          "--sh-seal-lo-rgb": "#8a5f1d",
          "--sh-seal-ink-rgb": "#6a4512",
          "--sh-rose-a-rgb": "#884229",
          "--sh-rose-b-rgb": "#efe2cf",
          "--sh-rose-c-rgb": "#572c1c",
          "--sh-leaf-rgb": "#a89462",
          "--sh-berry-rgb": "#763a24",
          "--sh-env-in-a-rgb": "#6a3725",
          "--sh-env-in-b-rgb": "#351a10",
          "--sh-alt-bg-rgb": "#f1e9db",
          "--sh-alt-bg-2-rgb": "#f6f0e4",
          "--sh-alt-heading-rgb": "#572c1c",
          "--sh-alt-body-rgb": "#553326",
          "--sh-alt-accent-rgb": "#884229",
          "--sh-alt-accent-soft-rgb": "#ece2cf",
          "--sh-alt-on-accent-rgb": "#fbefe6",
          "--sh-alt-surface-rgb": "#f1e9db",
          "--sh-alt-band-rgb": "#ece2cf",
          "--sh-alt-panel-rgb": "#fffaf1",
          "--sh-alt-panel-warm-rgb": "#fbf5ea",
          "--sh-alt-line-rgb": "#d8c6a6",
          "--sh-alt-deco-rgb": "#9a492c",
          "--sh-alt-deco-soft-rgb": "#efe2cf",
          "--sh-alt-deco-2-rgb": "#936d5e",
          "--sh-alt-deco-2-soft-rgb": "#e8dcc6",
        },
      },
      // "Nâu ca cao": ứng với "Nâu sữa" — nâu ca cao trầm.
      {
        id: "som-hom-nau-ca-cao",
        name: "Nâu ca cao",
        dark: true,
        heading: "#fbefe6",
        body: "#e5dedd",
        accent: "#e3c27f",
        accent_soft: "#5f4842",
        on_accent: "#46332f",
        on_image: "#ffffff",
        on_lightbox: "#ffffff",
        card_bg: "#46332f",
        page_bg: "#f4eee2",
        surface: "#4f3c37",
        band: "#3e2e29",
        panel: "#53403b",
        panel_warm: "#5a4642",
        cover: "#46332f",
        cover_mid: "#55413b",
        cover_veil: "#46332f",
        lightbox_bg: "#000000",
        line: "#8f6440",
        shadow: "#1a1311",
        scrim: "#191513",
        deco: "#d9b266",
        deco_soft: "#392925",
        deco_2: "#c0b4b2",
        deco_2_soft: "#64514c",
        shine_from: "#f6e2ae",
        shine_mid: "#d9b266",
        shine_to: "#a87c34",
        wishes: { bubble: "panel", text: "body", accent: "accent", btn: "accent" },
        vars: {
          "--sh-cv-bg-rgb": "#f6f0e4",
          "--sh-cv-bg-2-rgb": "#f1e9db",
          "--sh-cv-glow-a-rgb": "#fffaf1",
          "--sh-cv-glow-b-rgb": "#ece2cf",
          "--sh-cv-ink-rgb": "#46332f",
          "--sh-cv-muted-rgb": "#82726f",
          "--sh-cv-amp-rgb": "#9b8c88",
          "--sh-cv-btn-rgb": "#fffaf1",
          "--sh-seal-hi-rgb": "#f3dc96",
          "--sh-seal-mid-rgb": "#c99a3e",
          "--sh-seal-lo-rgb": "#8a5f1d",
          "--sh-seal-ink-rgb": "#6a4512",
          "--sh-rose-a-rgb": "#6c5048",
          "--sh-rose-b-rgb": "#efe2cf",
          "--sh-rose-c-rgb": "#46332f",
          "--sh-leaf-rgb": "#a89462",
          "--sh-berry-rgb": "#5e453e",
          "--sh-env-in-a-rgb": "#55413b",
          "--sh-env-in-b-rgb": "#2a1e1c",
          "--sh-alt-bg-rgb": "#f1e9db",
          "--sh-alt-bg-2-rgb": "#f6f0e4",
          "--sh-alt-heading-rgb": "#46332f",
          "--sh-alt-body-rgb": "#463834",
          "--sh-alt-accent-rgb": "#6c5048",
          "--sh-alt-accent-soft-rgb": "#ece2cf",
          "--sh-alt-on-accent-rgb": "#fbefe6",
          "--sh-alt-surface-rgb": "#f1e9db",
          "--sh-alt-band-rgb": "#ece2cf",
          "--sh-alt-panel-rgb": "#fffaf1",
          "--sh-alt-panel-warm-rgb": "#fbf5ea",
          "--sh-alt-line-rgb": "#d8c6a6",
          "--sh-alt-deco-rgb": "#7a5950",
          "--sh-alt-deco-soft-rgb": "#efe2cf",
          "--sh-alt-deco-2-rgb": "#82726f",
          "--sh-alt-deco-2-soft-rgb": "#e8dcc6",
        },
      },
      // "Xanh than": ứng với "Xám lạnh" — xanh than xám.
      {
        id: "som-hom-xanh-than",
        name: "Xanh than",
        dark: true,
        heading: "#fbefe6",
        body: "#dbe1e8",
        accent: "#e3c27f",
        accent_soft: "#3b4e6b",
        on_accent: "#2a384e",
        on_image: "#ffffff",
        on_lightbox: "#ffffff",
        card_bg: "#2a384e",
        page_bg: "#f4eee2",
        surface: "#324159",
        band: "#243145",
        panel: "#35455e",
        panel_warm: "#3c4c63",
        cover: "#2a384e",
        cover_mid: "#35465f",
        cover_veil: "#2a384e",
        lightbox_bg: "#000000",
        line: "#8f6440",
        shadow: "#0f151f",
        scrim: "#12161b",
        deco: "#d9b266",
        deco_soft: "#212d40",
        deco_2: "#afb8c5",
        deco_2_soft: "#47566e",
        shine_from: "#f6e2ae",
        shine_mid: "#d9b266",
        shine_to: "#a87c34",
        wishes: { bubble: "panel", text: "body", accent: "accent", btn: "accent" },
        vars: {
          "--sh-cv-bg-rgb": "#f6f0e4",
          "--sh-cv-bg-2-rgb": "#f1e9db",
          "--sh-cv-glow-a-rgb": "#fffaf1",
          "--sh-cv-glow-b-rgb": "#ece2cf",
          "--sh-cv-ink-rgb": "#2a384e",
          "--sh-cv-muted-rgb": "#6a7789",
          "--sh-cv-amp-rgb": "#8590a1",
          "--sh-cv-btn-rgb": "#fffaf1",
          "--sh-seal-hi-rgb": "#f3dc96",
          "--sh-seal-mid-rgb": "#c99a3e",
          "--sh-seal-lo-rgb": "#8a5f1d",
          "--sh-seal-ink-rgb": "#6a4512",
          "--sh-rose-a-rgb": "#40587b",
          "--sh-rose-b-rgb": "#efe2cf",
          "--sh-rose-c-rgb": "#2a384e",
          "--sh-leaf-rgb": "#a89462",
          "--sh-berry-rgb": "#374b6a",
          "--sh-env-in-a-rgb": "#35465f",
          "--sh-env-in-b-rgb": "#18222f",
          "--sh-alt-bg-rgb": "#f1e9db",
          "--sh-alt-bg-2-rgb": "#f6f0e4",
          "--sh-alt-heading-rgb": "#2a384e",
          "--sh-alt-body-rgb": "#303c4c",
          "--sh-alt-accent-rgb": "#40587b",
          "--sh-alt-accent-soft-rgb": "#ece2cf",
          "--sh-alt-on-accent-rgb": "#fbefe6",
          "--sh-alt-surface-rgb": "#f1e9db",
          "--sh-alt-band-rgb": "#ece2cf",
          "--sh-alt-panel-rgb": "#fffaf1",
          "--sh-alt-panel-warm-rgb": "#fbf5ea",
          "--sh-alt-line-rgb": "#d8c6a6",
          "--sh-alt-deco-rgb": "#46618a",
          "--sh-alt-deco-soft-rgb": "#efe2cf",
          "--sh-alt-deco-2-rgb": "#6a7789",
          "--sh-alt-deco-2-soft-rgb": "#e8dcc6",
        },
      },
      // "Xanh cổ vịt": ứng với "Xanh biển nhạt" — xanh cổ vịt.
      {
        id: "som-hom-xanh-co-vit",
        name: "Xanh cổ vịt",
        dark: true,
        heading: "#fbefe6",
        body: "#cee4e7",
        accent: "#e3c27f",
        accent_soft: "#24545a",
        on_accent: "#193d42",
        on_image: "#ffffff",
        on_lightbox: "#ffffff",
        card_bg: "#193d42",
        page_bg: "#f4eee2",
        surface: "#1f464a",
        band: "#153539",
        panel: "#214a4f",
        panel_warm: "#275156",
        cover: "#193d42",
        cover_mid: "#204b4f",
        cover_veil: "#193d42",
        lightbox_bg: "#000000",
        line: "#8f6440",
        shadow: "#081719",
        scrim: "#0d1819",
        deco: "#d9b266",
        deco_soft: "#133235",
        deco_2: "#9abdc1",
        deco_2_soft: "#315c61",
        shine_from: "#f6e2ae",
        shine_mid: "#d9b266",
        shine_to: "#a87c34",
        wishes: { bubble: "panel", text: "body", accent: "accent", btn: "accent" },
        vars: {
          "--sh-cv-bg-rgb": "#f6f0e4",
          "--sh-cv-bg-2-rgb": "#f1e9db",
          "--sh-cv-glow-a-rgb": "#fffaf1",
          "--sh-cv-glow-b-rgb": "#ece2cf",
          "--sh-cv-ink-rgb": "#193d42",
          "--sh-cv-muted-rgb": "#567c80",
          "--sh-cv-amp-rgb": "#6b969b",
          "--sh-cv-btn-rgb": "#fffaf1",
          "--sh-seal-hi-rgb": "#f3dc96",
          "--sh-seal-mid-rgb": "#c99a3e",
          "--sh-seal-lo-rgb": "#8a5f1d",
          "--sh-seal-ink-rgb": "#6a4512",
          "--sh-rose-a-rgb": "#245f65",
          "--sh-rose-b-rgb": "#efe2cf",
          "--sh-rose-c-rgb": "#193d42",
          "--sh-leaf-rgb": "#a89462",
          "--sh-berry-rgb": "#1f5257",
          "--sh-env-in-a-rgb": "#204c50",
          "--sh-env-in-b-rgb": "#0e2527",
          "--sh-alt-bg-rgb": "#f1e9db",
          "--sh-alt-bg-2-rgb": "#f6f0e4",
          "--sh-alt-heading-rgb": "#193d42",
          "--sh-alt-body-rgb": "#214043",
          "--sh-alt-accent-rgb": "#245f65",
          "--sh-alt-accent-soft-rgb": "#ece2cf",
          "--sh-alt-on-accent-rgb": "#fbefe6",
          "--sh-alt-surface-rgb": "#f1e9db",
          "--sh-alt-band-rgb": "#ece2cf",
          "--sh-alt-panel-rgb": "#fffaf1",
          "--sh-alt-panel-warm-rgb": "#fbf5ea",
          "--sh-alt-line-rgb": "#d8c6a6",
          "--sh-alt-deco-rgb": "#276a71",
          "--sh-alt-deco-soft-rgb": "#efe2cf",
          "--sh-alt-deco-2-rgb": "#567c80",
          "--sh-alt-deco-2-soft-rgb": "#e8dcc6",
        },
      },
      // "Lục bảo": ứng với "Bạc hà" — xanh lục bảo.
      {
        id: "som-hom-luc-bao",
        name: "Lục bảo",
        dark: true,
        heading: "#fbefe6",
        body: "#cee5dc",
        accent: "#e3c27f",
        accent_soft: "#255743",
        on_accent: "#193f30",
        on_image: "#ffffff",
        on_lightbox: "#ffffff",
        card_bg: "#193f30",
        page_bg: "#f4eee2",
        surface: "#204838",
        band: "#16372a",
        panel: "#224c3b",
        panel_warm: "#285442",
        cover: "#193f30",
        cover_mid: "#214c3b",
        cover_veil: "#193f30",
        lightbox_bg: "#000000",
        line: "#8f6440",
        shadow: "#081711",
        scrim: "#0d1713",
        deco: "#d9b266",
        deco_soft: "#133226",
        deco_2: "#99bfb0",
        deco_2_soft: "#325e4c",
        shine_from: "#f6e2ae",
        shine_mid: "#d9b266",
        shine_to: "#a87c34",
        wishes: { bubble: "panel", text: "body", accent: "accent", btn: "accent" },
        vars: {
          "--sh-cv-bg-rgb": "#f6f0e4",
          "--sh-cv-bg-2-rgb": "#f1e9db",
          "--sh-cv-glow-a-rgb": "#fffaf1",
          "--sh-cv-glow-b-rgb": "#ece2cf",
          "--sh-cv-ink-rgb": "#193f30",
          "--sh-cv-muted-rgb": "#577d6e",
          "--sh-cv-amp-rgb": "#6a9986",
          "--sh-cv-btn-rgb": "#fffaf1",
          "--sh-seal-hi-rgb": "#f3dc96",
          "--sh-seal-mid-rgb": "#c99a3e",
          "--sh-seal-lo-rgb": "#8a5f1d",
          "--sh-seal-ink-rgb": "#6a4512",
          "--sh-rose-a-rgb": "#266149",
          "--sh-rose-b-rgb": "#efe2cf",
          "--sh-rose-c-rgb": "#193f30",
          "--sh-leaf-rgb": "#a89462",
          "--sh-berry-rgb": "#20543f",
          "--sh-env-in-a-rgb": "#214c3b",
          "--sh-env-in-b-rgb": "#0e261c",
          "--sh-alt-bg-rgb": "#f1e9db",
          "--sh-alt-bg-2-rgb": "#f6f0e4",
          "--sh-alt-heading-rgb": "#193f30",
          "--sh-alt-body-rgb": "#224034",
          "--sh-alt-accent-rgb": "#266149",
          "--sh-alt-accent-soft-rgb": "#ece2cf",
          "--sh-alt-on-accent-rgb": "#fbefe6",
          "--sh-alt-surface-rgb": "#f1e9db",
          "--sh-alt-band-rgb": "#ece2cf",
          "--sh-alt-panel-rgb": "#fffaf1",
          "--sh-alt-panel-warm-rgb": "#fbf5ea",
          "--sh-alt-line-rgb": "#d8c6a6",
          "--sh-alt-deco-rgb": "#286d51",
          "--sh-alt-deco-soft-rgb": "#efe2cf",
          "--sh-alt-deco-2-rgb": "#577d6e",
          "--sh-alt-deco-2-soft-rgb": "#e8dcc6",
        },
      },
      // "Xanh rêu": ứng với "Sage nhạt" — xanh rêu.
      {
        id: "som-hom-xanh-reu",
        name: "Xanh rêu",
        dark: true,
        heading: "#fbefe6",
        body: "#dbe2d4",
        accent: "#e3c27f",
        accent_soft: "#435231",
        on_accent: "#303b22",
        on_image: "#ffffff",
        on_lightbox: "#ffffff",
        card_bg: "#303b22",
        page_bg: "#f4eee2",
        surface: "#384529",
        band: "#2a341e",
        panel: "#3b492c",
        panel_warm: "#425032",
        cover: "#303b22",
        cover_mid: "#3c4a2c",
        cover_veil: "#303b22",
        lightbox_bg: "#000000",
        line: "#8f6440",
        shadow: "#11170c",
        scrim: "#131610",
        deco: "#d9b266",
        deco_soft: "#262f1a",
        deco_2: "#b0baa3",
        deco_2_soft: "#4c593c",
        shine_from: "#f6e2ae",
        shine_mid: "#d9b266",
        shine_to: "#a87c34",
        wishes: { bubble: "panel", text: "body", accent: "accent", btn: "accent" },
        vars: {
          "--sh-cv-bg-rgb": "#f6f0e4",
          "--sh-cv-bg-2-rgb": "#f1e9db",
          "--sh-cv-glow-a-rgb": "#fffaf1",
          "--sh-cv-glow-b-rgb": "#ece2cf",
          "--sh-cv-ink-rgb": "#303b22",
          "--sh-cv-muted-rgb": "#6e7a60",
          "--sh-cv-amp-rgb": "#869377",
          "--sh-cv-btn-rgb": "#fffaf1",
          "--sh-seal-hi-rgb": "#f3dc96",
          "--sh-seal-mid-rgb": "#c99a3e",
          "--sh-seal-lo-rgb": "#8a5f1d",
          "--sh-seal-ink-rgb": "#6a4512",
          "--sh-rose-a-rgb": "#4a5c34",
          "--sh-rose-b-rgb": "#efe2cf",
          "--sh-rose-c-rgb": "#303b22",
          "--sh-leaf-rgb": "#a89462",
          "--sh-berry-rgb": "#40502d",
          "--sh-env-in-a-rgb": "#3c4a2c",
          "--sh-env-in-b-rgb": "#1c2314",
          "--sh-alt-bg-rgb": "#f1e9db",
          "--sh-alt-bg-2-rgb": "#f6f0e4",
          "--sh-alt-heading-rgb": "#303b22",
          "--sh-alt-body-rgb": "#353e29",
          "--sh-alt-accent-rgb": "#4a5c34",
          "--sh-alt-accent-soft-rgb": "#ece2cf",
          "--sh-alt-on-accent-rgb": "#fbefe6",
          "--sh-alt-surface-rgb": "#f1e9db",
          "--sh-alt-band-rgb": "#ece2cf",
          "--sh-alt-panel-rgb": "#fffaf1",
          "--sh-alt-panel-warm-rgb": "#fbf5ea",
          "--sh-alt-line-rgb": "#d8c6a6",
          "--sh-alt-deco-rgb": "#516738",
          "--sh-alt-deco-soft-rgb": "#efe2cf",
          "--sh-alt-deco-2-rgb": "#6e7a60",
          "--sh-alt-deco-2-soft-rgb": "#e8dcc6",
        },
      },
      // "Xám khói": ứng với "Ngọc trai" — xám khói ấm.
      {
        id: "som-hom-xam-khoi",
        name: "Xám khói",
        dark: true,
        heading: "#fbefe6",
        body: "#e1e0de",
        accent: "#e3c27f",
        accent_soft: "#514d48",
        on_accent: "#3b3734",
        on_image: "#ffffff",
        on_lightbox: "#ffffff",
        card_bg: "#3b3734",
        page_bg: "#f4eee2",
        surface: "#433f3c",
        band: "#34312d",
        panel: "#474340",
        panel_warm: "#4e4a47",
        cover: "#3b3734",
        cover_mid: "#484541",
        cover_veil: "#3b3734",
        lightbox_bg: "#000000",
        line: "#8f6440",
        shadow: "#161513",
        scrim: "#161615",
        deco: "#d9b266",
        deco_soft: "#2f2d2a",
        deco_2: "#b9b6b4",
        deco_2_soft: "#585551",
        shine_from: "#f6e2ae",
        shine_mid: "#d9b266",
        shine_to: "#a87c34",
        wishes: { bubble: "panel", text: "body", accent: "accent", btn: "accent" },
        vars: {
          "--sh-cv-bg-rgb": "#f6f0e4",
          "--sh-cv-bg-2-rgb": "#f1e9db",
          "--sh-cv-glow-a-rgb": "#fffaf1",
          "--sh-cv-glow-b-rgb": "#ece2cf",
          "--sh-cv-ink-rgb": "#3b3734",
          "--sh-cv-muted-rgb": "#787572",
          "--sh-cv-amp-rgb": "#918e8c",
          "--sh-cv-btn-rgb": "#fffaf1",
          "--sh-seal-hi-rgb": "#f3dc96",
          "--sh-seal-mid-rgb": "#c99a3e",
          "--sh-seal-lo-rgb": "#8a5f1d",
          "--sh-seal-ink-rgb": "#6a4512",
          "--sh-rose-a-rgb": "#5b5650",
          "--sh-rose-b-rgb": "#efe2cf",
          "--sh-rose-c-rgb": "#3b3734",
          "--sh-leaf-rgb": "#a89462",
          "--sh-berry-rgb": "#4f4a46",
          "--sh-env-in-a-rgb": "#484541",
          "--sh-env-in-b-rgb": "#23211e",
          "--sh-alt-bg-rgb": "#f1e9db",
          "--sh-alt-bg-2-rgb": "#f6f0e4",
          "--sh-alt-heading-rgb": "#3b3734",
          "--sh-alt-body-rgb": "#3d3a38",
          "--sh-alt-accent-rgb": "#5b5650",
          "--sh-alt-accent-soft-rgb": "#ece2cf",
          "--sh-alt-on-accent-rgb": "#fbefe6",
          "--sh-alt-surface-rgb": "#f1e9db",
          "--sh-alt-band-rgb": "#ece2cf",
          "--sh-alt-panel-rgb": "#fffaf1",
          "--sh-alt-panel-warm-rgb": "#fbf5ea",
          "--sh-alt-line-rgb": "#d8c6a6",
          "--sh-alt-deco-rgb": "#665f59",
          "--sh-alt-deco-soft-rgb": "#efe2cf",
          "--sh-alt-deco-2-rgb": "#787572",
          "--sh-alt-deco-2-soft-rgb": "#e8dcc6",
        },
      },
    ],

    swatches: ["#4e1319", "#7a1c27", "#d9b266", "#e3c27f", "#efdcd5", "#fbefe6", "#f4eee2", "#ffffff"],

    wishes: {
      bubble: "#5c1b23",
      text: "#efdcd5",
      accent: "#e3c27f",
      btn: "#e3c27f",
    },

    // Chuyển động do shMotion() của mẫu lo theo từng phần tử (bay vào + parallax), nên
    // hiệu ứng mục chung trỏ vào id không tồn tại để hai bên không chồng nhau.
    reveal: ["#sh-no-reveal"],
    suggest: "#section-footer",
    skipSteps: [],
    loveStory: "short",
    onOpen: null,
  };

  const _isGroom = isGroomSide();
  const _pad = (n) => String(Math.max(0, n)).padStart(2, "0");

  // ============= MÀN BÌA: MỞ PHONG BÌ =============
  // Nhạc bật NGAY trong cú chạm (cxMusicOnOpen — iOS chỉ cho phát khi có cú chạm), rồi
  // chạy cảnh: dấu sáp tan → ảnh bìa rút lên, hai ảnh nấp xoè ra → phong bì cùng bó hoa
  // chìm xuống; xong mới openInvitation(). Gọi lại openInvitation không bật nhạc lần hai.

  const OPEN_MS = 2600;
  let _coverOpening = false;

  function shOpenCover() {
    if (_coverOpening) return;
    _coverOpening = true;
    window.cxMusicOnOpen?.();
    const cover = document.getElementById("sh-cover");
    if (!cover || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      window.openInvitation();
      return;
    }
    shBurst();
    cover.classList.add("is-open");
    setTimeout(() => window.openInvitation(), OPEN_MS);
  }

  const _rnd = (a, b) => a + Math.random() * (b - a);

  // Cánh hoa bung từ miệng phong bì, xoè hình quạt hướng lên rồi bồng bềnh rơi.
  function shBurst() {
    const box = document.querySelector(".sh-burst");
    if (!box) return;
    const n = 22;
    box.innerHTML = Array.from({ length: n }, (_, i) => {
      const a = ((-165 + (150 * i) / (n - 1)) * Math.PI) / 180;
      const d = _rnd(110, 230);
      return `<i style="--s:${_rnd(8, 16).toFixed(0)}px;--x:${(Math.cos(a) * d).toFixed(0)}px;--y:${(Math.sin(a) * d).toFixed(0)}px;--rot:${_rnd(-220, 220).toFixed(0)}deg;--dl:${_rnd(0, 260).toFixed(0)}ms"></i>`;
    }).join("");
  }

  // Cánh hoa rơi thưa lúc chờ mở bìa. Độ trễ âm để vừa vào đã có cánh giữa màn.
  function shPetals() {
    const box = document.querySelector(".sh-petals");
    if (!box || box.childElementCount) return;
    box.innerHTML = Array.from({ length: 10 }, () => {
      const t = _rnd(11, 18);
      return `<i style="left:${_rnd(0, 100).toFixed(0)}%;--s:${_rnd(8, 14).toFixed(0)}px;--t:${t.toFixed(1)}s;--dl:${(-_rnd(0, t)).toFixed(1)}s;--sw:${_rnd(-40, 40).toFixed(0)}px"></i>`;
    }).join("");
  }

  // Uỷ quyền trên document: <x-button> tự thay mình bằng <button> lúc nạp, gắn thẳng là
  // dính vào thẻ cũ. touchend + preventDefault vì iOS Chrome hay nuốt click.
  const _isOpener = (t) => t?.closest?.("#sh-env, #sh-open-btn");
  document.addEventListener("click", (e) => _isOpener(e.target) && shOpenCover());
  document.addEventListener(
    "touchend",
    (e) => {
      if (!_isOpener(e.target)) return;
      e.preventDefault();
      shOpenCover();
    },
    { passive: false },
  );
  document.addEventListener("keydown", (e) => {
    if ((e.key === "Enter" || e.key === " ") && e.target?.id === "sh-env") {
      e.preventDefault();
      shOpenCover();
    }
  });

  function renderWedding(w) {
    if (!w || !w.is_active) return;

    const side = _isGroom ? "groom" : "bride";
    const gallery = Array.isArray(w.gallery_images) ? w.gallery_images : [];
    const galleryFp = w.image_focal_points?.gallery_images;

    // --- Màn bìa + mở đầu (ảnh màn đầu nhận src TRƯỚC setupMusic) ---
    renderCover(w);
    shPetals();
    renderHero(w, false);
    if (w.story_quote) setText("story-quote", w.story_quote);

    const isVuQuy = !_isGroom && cxEnabled(w.vu_quy_enabled);
    const ceremonyName = isVuQuy ? "Lễ Vu Quy" : w.ceremony_name || "Lễ Thành Hôn";
    const ceremonyTime = isVuQuy ? w.vu_quy_time : w.ceremony_time;
    const ceremonyLoc = isVuQuy ? w.vu_quy_location : w.ceremony_location || "";

    const cd = w.ceremony_date ? new Date(w.ceremony_date + "T00:00:00") : null;
    if (cd && !isNaN(cd)) {
      const dmy = `${_pad(cd.getDate())}.${_pad(cd.getMonth() + 1)}.${cd.getFullYear()}`;
      setText("sh-post-date", ceremonyTime ? `${ceremonyTime} · ${dmy}` : dmy);
      setText("sh-cover-date", dmy);
      setText("sh-date-dot", dmy);
      setText("sh-cer-year", String(cd.getFullYear()));
      setText("sh-cer-month", _pad(cd.getMonth() + 1));
    }

    shFillShots(gallery, galleryFp);

    // --- Nhạc nền ---
    setupMusic(w.music_url, w.enable_music);

    // --- Gia đình ---
    renderCoupleInfo(w);
    cxToggle("section-family", cxEnabled(w.enable_family));

    // --- Thư mời ---
    setText("invite-groom", w.groom_name, "----------");
    setText("invite-bride", w.bride_name, "----------");
    setText("ceremony-event-name", ceremonyName);
    renderCeremonyDate(w.ceremony_date, ceremonyTime, w.ceremony_lunar);
    if (cd && !isNaN(cd)) setText("invite-day", _pad(cd.getDate()));
    if (ceremonyLoc) {
      setText("ceremony-location-text", ceremonyLoc);
      cxToggle("ceremony-location-wrap", true);
    }

    renderMusicSummary(w, {
      ceremonyName,
      ceremonyTime,
      ceremonyLocation: ceremonyLoc,
    });

    // --- Tiệc cưới + lịch tháng đè ảnh ---
    const partyDate = w[`${side}_party_date`];
    setText("party-section-label", "Tiệc Mừng " + ceremonyName);
    renderPartyDate(partyDate, w[`${side}_party_time`], w[`${side}_party_lunar`], w[`${side}_party_location`], "full");
    shRenderCalendar(partyDate || w.ceremony_date, w.ceremony_date);
    cxToggle("section-party", cxEnabled(w.enable_party));

    // --- Xác nhận tham dự ---
    const rsvp = document.getElementById("rsvp-section");
    if (rsvp) rsvp.style.display = cxEnabled(w.rsvp_enabled) ? "flex" : "none";
    if (w.rsvp_message) {
      const msg = document.getElementById("rsvp-custom-message");
      if (msg) {
        msg.textContent = w.rsvp_message;
        msg.classList.remove("hidden");
      }
    }

    // --- Lịch trình ---
    if (cxEnabled(w.enable_timeline)) {
      shRenderTimeline(w.timeline, side, partyDate, ...cxTimelineCeremony(w, ceremonyName));
    }

    // --- Chuyện tình yêu ---
    if (cxEnabled(w.enable_love_story)) {
      shRenderLoveStory(w.love_story);
    } else {
      cxToggle("love-story", false);
    }

    // --- Album ảnh ---
    if (cxEnabled(w.enable_photos)) {
      renderGallery(gallery, galleryFp);
    } else {
      cxToggle("section-photos", false);
    }

    // --- Hộp mừng cưới ---
    renderQRCodes(w);
    cxToggle("section-gift", cxEnabled(w.enable_gift));

    // --- Bản đồ ---
    renderVenueMaps(w, side);

    // --- Lời cảm ơn ---
    if (w.footer_text) setText("footer-text", w.footer_text);
    cxToggle("section-footer", cxEnabled(w.enable_footer));

    shMotion();
    shStripeWatch();
  }

  window.renderWedding = renderWedding;

  // Màu gốc là đỏ rượu (nền tối) nên :root khai sẵn bìa/mục xen kẽ giấy kem. Bộ NỀN SÁNG
  // của danh mục chung chỉ đổi --cx-* → gắn .sh-lite để các biến --sh-* trỏ lại token chung.
  // Bộ riêng có `vars` (kể cả nền sáng như "Hồng phấn") tự khai đủ --sh-* nên không gắn.
  function shLite() {
    const html = document.documentElement;
    const bg = getComputedStyle(html).getPropertyValue("--cx-card-bg-rgb").trim().split(/\s+/).map(Number);
    const lum = (0.2126 * bg[0] + 0.7152 * bg[1] + 0.0722 * bg[2]) / 255;
    const own = !!window.CX_PALETTE_ON?.vars;
    html.classList.toggle("sh-lite", bg.length === 3 && lum > 0.5 && !own);
  }

  // Bộ màu khai `--sh-alt-bg-rgb` khác nền thẻ → mục đang HIỆN thứ 1, 3, 5… (theo flex
  // `order`, khối chèn thêm đánh lại order) nhận .sh-alt, mục còn lại thành thẻ .sh-solid,
  // thẻ cả nhận .sh-striped. Không khai thì gỡ hết.
  function shStripe() {
    const card = document.getElementById("main-card");
    if (!card) return;
    shLite();
    const root = getComputedStyle(document.documentElement);
    const on = root.getPropertyValue("--sh-alt-bg-rgb").trim() !== root.getPropertyValue("--cx-card-bg-rgb").trim();
    const secs = [...card.querySelectorAll(".sh-body > .sh-sec")].map((el, i) => ({ el, i, st: getComputedStyle(el) }));
    const shown = secs
      .filter((s) => s.st.display !== "none")
      .sort((a, b) => (parseInt(a.st.order, 10) || 0) - (parseInt(b.st.order, 10) || 0) || a.i - b.i);
    card.classList.toggle("sh-striped", on);
    secs.forEach((s) => {
      const n = shown.indexOf(s);
      s.el.classList.toggle("sh-alt", on && n >= 0 && n % 2 === 0);
      s.el.classList.toggle("sh-solid", on && n % 2 === 1);
    });
  }

  // Chạy lại khi bộ màu đổi (thẻ <style> trong <head>), khi mục ẩn/hiện hay khối chèn thêm.
  // toggle không đổi gì thì không sinh mutation nên không tự gọi vòng.
  let _stripeMo = null;
  function shStripeWatch() {
    shStripe();
    if (_stripeMo) return;
    let queued = false;
    _stripeMo = new MutationObserver(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        shStripe();
      });
    });
    _stripeMo.observe(document.head, { childList: true, subtree: true, characterData: true });
    const body = document.querySelector("#main-card .sh-body");
    if (body) {
      _stripeMo.observe(body, { childList: true });
      body.querySelectorAll(":scope > .sh-sec").forEach((s) =>
        _stripeMo.observe(s, { attributes: true, attributeFilter: ["class", "style"] }),
      );
    }
  }

  // Ảnh trong #main-card của mẫu có bìa KHÔNG lazy (xem CLAUDE.md).
  function shImg(url, fp) {
    return `<img src="${cxImgSrc(url)}" alt="" class="w-full h-full object-cover"
      style="object-position:${cxFocal(fp)}" />`;
  }

  // Ô [data-sh-shot] (nền lịch tháng) lấy một ảnh album: "last" = ảnh cuối.
  function shFillShots(images, focal) {
    document.querySelectorAll("[data-sh-shot]").forEach((slot) => {
      const key = slot.getAttribute("data-sh-shot");
      if (!images.length) {
        slot.innerHTML = "";
        slot.classList.add("is-empty");
        return;
      }
      const idx = key === "last" ? images.length - 1 : Number(key) % images.length;
      slot.classList.remove("is-empty");
      slot.innerHTML = shImg(images[idx], focal?.[images[idx]]);
    });
  }

  // ============= ALBUM ẢNH — đổ lần lượt vào các hàng [data-sh-take] =============
  // Hàng lấy đủ số ảnh của nó (thiếu thì lấy phần còn lại); khối không còn ảnh nào thì ẩn
  // cả khối kể cả câu thơ. "rest" = mọi ảnh còn dư.

  function renderGallery(images, focalPoints) {
    const section = document.getElementById("section-photos");
    if (!section) return;

    const urls = images?.length
      ? images.map(getImageUrl)
      : Array(4)
          .fill(null)
          .map(() => createPlaceholderSVG("Chưa có ảnh"));

    lightboxImages.length = 0;
    lightboxImages.push(...urls);

    let next = 0;
    section.querySelectorAll(".sh-row").forEach((row) => {
      const want = row.getAttribute("data-sh-take");
      const take = want === "rest" ? urls.length - next : Math.min(Number(want) || 1, urls.length - next);
      row.innerHTML = "";
      row.classList.toggle("hidden", take <= 0);
      row.setAttribute("data-sh-n", String(Math.max(0, take)));
      for (let k = 0; k < take; k++) {
        const i = next++;
        const cell = document.createElement("div");
        cell.className = "sh-cell";
        cell.innerHTML = shImg(urls[i], focalPoints?.[images?.[i]]);
        cell.addEventListener("click", () => openLightbox(i));
        row.appendChild(cell);
      }
    });

    section.querySelectorAll(".sh-blk").forEach((blk) => {
      const has = [...blk.querySelectorAll(".sh-row")].some((r) => !r.classList.contains("hidden"));
      blk.classList.toggle("hidden", !has);
    });
  }

  // ============= LỊCH THÁNG ĐÈ ẢNH =============
  // Tuần bắt đầu Thứ Hai; ngày tiệc + ngày lễ (nếu cùng tháng) khoanh tròn.

  function shRenderCalendar(mainDate, otherDate) {
    const box = document.getElementById("sh-calendar");
    if (!box || !mainDate) return;
    const d = new Date(mainDate + "T00:00:00");
    if (isNaN(d)) return;
    const y = d.getFullYear();
    const m = d.getMonth();
    const marked = new Set([d.getDate()]);
    if (otherDate) {
      const o = new Date(otherDate + "T00:00:00");
      if (o.getFullYear() === y && o.getMonth() === m) marked.add(o.getDate());
    }
    setText("sh-cal-month", `Tháng ${m + 1} · ${y}`);

    const lead = (new Date(y, m, 1).getDay() + 6) % 7;
    const days = new Date(y, m + 1, 0).getDate();
    let html = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((h) => `<div class="sh-cal-h">${h}</div>`).join("");
    html += "<div></div>".repeat(lead);
    for (let i = 1; i <= days; i++) {
      html += `<div class="sh-cal-d${marked.has(i) ? " is-on" : ""}" style="--i:${lead + i}"><span>${i}</span></div>`;
    }
    box.innerHTML = html;
  }

  // ============= LỊCH TRÌNH — dạng chương trình in, mỗi mốc một dòng =============
  // Lọc theo nhà như renderTimeline dùng chung; mỗi nhóm (lễ / tiệc) mở bằng dòng tên +
  // ngày, mốc là "việc ······ giờ" nối bằng đường chấm.

  function shRenderTimeline(items, side, partyDate, ceremonyDate, ceremonyName) {
    const list = document.getElementById("timeline-list-render");
    if (!list || !Array.isArray(items)) return;
    const relevant = items.filter((it) => {
      const t = it.type || "ceremony";
      return t === "ceremony" || (side === "groom" ? t === "party" : t === "bride-party");
    });
    if (!relevant.length) return;

    const groups = cxSortTimelineGroups([
      { label: "Tiệc Cưới", date: partyDate, items: relevant.filter((i) => (i.type || "ceremony") !== "ceremony") },
      { label: ceremonyName, date: ceremonyDate, items: relevant.filter((i) => (i.type || "ceremony") === "ceremony") },
    ]);

    list.innerHTML = groups
      .map((g) => {
        const dt = g.date ? new Date(g.date + "T00:00:00") : null;
        const day = dt && !isNaN(dt) ? `${_pad(dt.getDate())}.${_pad(dt.getMonth() + 1)}` : "";
        const rows = g.items
          .map(
            (it) => `<div class="sh-plan-row">
              <span class="cx-t sh-plan-title">${escapeHtml(it.title || "")}</span>
              <span class="sh-plan-dots"></span>
              <span class="cx-h sh-plan-time">${escapeHtml(it.time || "")}</span>
            </div>`,
          )
          .join("");
        return `<div class="sh-plan-group">
          <div class="cx-t sh-plan-label"><span>${escapeHtml(g.label)}</span>${day ? `<b>${day}</b>` : ""}</div>
          ${rows}
        </div>`;
      })
      .join("");
    cxToggle("section-timeline", true);
  }

  // ============= CHUYỆN TÌNH YÊU — polaroid + năm chữ chìm =============
  // Mốc chẵn ảnh lệch trái, mốc lẻ lệch phải; năm to nằm phía đối diện, sau ảnh.
  // Ngày dài (vd "Tháng 3, 2019") thì thu cỡ chữ chìm để khỏi tràn.

  function shRenderLoveStory(events) {
    const section = document.getElementById("love-story");
    const list = document.getElementById("love-story-list");
    if (!section || !list) return;
    if (!Array.isArray(events) || !events.length) {
      section.style.display = "none";
      return;
    }
    section.style.display = "";
    list.innerHTML = events
      .map((ev, i) => {
        const date = String(ev.date || "");
        const img = ev.image_url
          ? `<div class="sh-snap"><div class="sh-snap-img"><img src="${cxImgSrc(ev.image_url)}" alt="" class="w-full h-full object-cover" style="object-position:${cxFocal(ev.focal_point)}" /></div></div>`
          : "";
        return `<div class="sh-mile${i % 2 ? " is-r" : ""}${img ? "" : " no-img"}">
          ${date ? `<div class="cx-h sh-mile-year${date.length > 6 ? " is-long" : ""}">${escapeHtml(date)}</div>` : ""}
          ${img}
          <div class="sh-mile-text">
            <div class="cx-t sh-mile-no">${_pad(i + 1)}</div>
            ${ev.title ? `<div class="cx-h sh-mile-title">${escapeHtml(ev.title)}</div>` : ""}
            ${ev.content ? `<div class="cx-t sh-mile-body">${escapeHtml(ev.content)}</div>` : ""}
          </div>
        </div>`;
      })
      .join("");
  }

  // ============= CHUYỂN ĐỘNG KHI VUỐT =============
  // Gắn data-fx (kiểu bay vào, CSS ở theme.css) + --d (độ trễ) lên phần tử, cuộn tới thì
  // thêm .is-in một lần. Ảnh trong .sh-par trôi chậm hơn trang (parallax) bằng `translate`
  // — tách khỏi `scale` của hiệu ứng vào nên hai thứ không đè nhau.

  const _reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  let _io = null;
  let _parBound = false;

  // Hàng ảnh theo kiểu → cách từng ô bay vào. Hàng cùng kiểu xuất hiện lần sau thì đảo
  // hướng để nhịp trái/phải xen kẽ.
  const ROW_FX = {
    tall: () => ["rise"],
    wide: (n) => [n % 2 ? "right" : "left"],
    pano: (n) => [n % 2 ? "left" : "right"],
    pano2: () => ["left", "right"],
    pair: (n) => (n % 2 ? ["right", "left"] : ["left", "right"]),
    side: () => ["left"],
    offset: () => ["tilt"],
    quad: () => ["pop", "pop", "pop", "pop"],
    grid: () => ["pop"],
  };
  const PARALLAX = new Set(["tall", "wide", "pano", "pano2", "offset"]);

  function _fx(el, kind, delay) {
    if (!el) return;
    el.classList.add("sh-fx");
    el.setAttribute("data-fx", kind);
    if (delay) el.style.setProperty("--d", `${delay}ms`);
  }

  function shMotion() {
    const card = document.getElementById("main-card");
    if (!card) return;

    _fx(document.querySelector(".sh-kicker"), "fade");
    _fx(document.querySelector(".sh-post-title"), "fade", 80);
    _fx(document.querySelector(".sh-post-meta"), "fade", 160);
    _fx(document.getElementById("story-quote"), "fade", 240);
    const hero = document.querySelector("#section-hero .sh-frame");
    _fx(hero, "rise", 200);
    hero?.classList.add("sh-par");

    card.querySelectorAll("#section-family .sh-couple").forEach((row) => {
      row.querySelectorAll(".sh-person").forEach((p, i) => _fx(p, i ? "right" : "left", i * 120));
    });
    // Chữ nằm trong khối đã có hiệu ứng thì đi theo khối, không gắn lồng thêm.
    card.querySelectorAll(".sh-poem, .sh-date-dot, .sh-tt").forEach((el) => {
      if (!el.parentElement.closest(".sh-fx") && !el.classList.contains("sh-fx")) _fx(el, "fade");
    });
    card.querySelectorAll(".sh-heart").forEach((el) => _fx(el, "zoom"));
    card.querySelectorAll(".sh-ava").forEach((el, i) => _fx(el, "zoom", (i % 2) * 140));
    card.querySelectorAll(".sh-script").forEach((el) => _fx(el, "write", 300));

    const seen = {};
    card.querySelectorAll("#section-photos .sh-row").forEach((row) => {
      const shape = row.getAttribute("data-sh-shape");
      const n = (seen[shape] = (seen[shape] ?? -1) + 1);
      const kinds = (ROW_FX[shape] || ROW_FX.grid)(n);
      row.querySelectorAll(".sh-cell").forEach((cell, i) => {
        _fx(cell, kinds[i % kinds.length], i * 120);
        if (shape === "quad" || shape === "grid") cell.style.setProperty("--r", i % 2 ? "2deg" : "-2deg");
        if (PARALLAX.has(shape)) cell.classList.add("sh-par");
      });
    });

    // Lịch trình: dòng tên nhóm hiện trước, từng mốc nối đuôi nhau, đường chấm kéo dài ra.
    card.querySelectorAll(".sh-plan-group").forEach((g) => {
      _fx(g.querySelector(".sh-plan-label"), "fade");
      g.querySelectorAll(".sh-plan-row").forEach((row, i) => {
        _fx(row, "fade", 80 + i * 70);
        _fx(row.querySelector(".sh-plan-dots"), "line", 200 + i * 70);
      });
    });

    // Chuyện tình: năm chữ chìm lướt ngược phía ảnh, ảnh rơi xuống rồi xoay về độ nghiêng.
    card.querySelectorAll(".sh-mile").forEach((m) => {
      const right = m.classList.contains("is-r");
      _fx(m.querySelector(".sh-mile-year"), right ? "left" : "right");
      const snap = m.querySelector(".sh-snap");
      if (snap) {
        _fx(snap, "pop", 120);
        snap.style.setProperty("--r", right ? "12deg" : "-12deg");
      }
      _fx(m.querySelector(".sh-mile-text"), "fade", 280);
    });

    _fx(document.querySelector(".sh-bd-line"), "line", 150);
    _fx(document.querySelector(".sh-names"), "fade", 100);
    const cal = document.querySelector(".sh-calcard");
    _fx(cal, "rise");
    document.querySelector(".sh-calcard-bg")?.classList.add("sh-par");
    _fx(document.getElementById("sh-calendar"), "days");
    card.querySelectorAll(".sh-rsvp-btns .sh-btn, #section-gift [data-cx-gift] > div").forEach((el, i) =>
      _fx(el, "fade", (i % 2) * 120),
    );
    _fx(document.getElementById("map-link"), "rise");

    const items = card.querySelectorAll(".sh-fx");
    if (_reduced || !("IntersectionObserver" in window)) {
      items.forEach((el) => el.classList.add("is-in"));
      return;
    }
    _io?.disconnect();
    _io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          // Cao 0 = #main-card còn display:none (chưa mở bìa) → chờ lượt báo sau.
          const r = e.boundingClientRect;
          if (!r.height || (!e.isIntersecting && r.top > 0)) return;
          e.target.classList.add("is-in");
          _io.unobserve(e.target);
        });
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    items.forEach((el) => {
      if (!el.classList.contains("is-in")) _io.observe(el);
    });
    _bindParallax();
  }

  // Lệch tối đa 7% chiều cao khung; ảnh cao 116% nên không lộ mép.
  function _bindParallax() {
    if (_parBound || _reduced) return;
    _parBound = true;
    let ticking = false;
    const run = () => {
      ticking = false;
      const vh = window.innerHeight;
      document.querySelectorAll(".sh-par").forEach((box) => {
        const img = box.querySelector("img");
        if (!img) return;
        const r = box.getBoundingClientRect();
        if (!r.height || r.bottom < -100 || r.top > vh + 100) return;
        const k = (r.top + r.height / 2 - vh / 2) / (vh / 2 + r.height / 2);
        img.style.translate = `0 ${(-k * r.height * 0.07).toFixed(1)}px`;
      });
    };
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(run);
    };
    // capture: bắt cả khung cuộn lồng, không chỉ window.
    document.addEventListener("scroll", onScroll, { passive: true, capture: true });
    window.addEventListener("resize", onScroll, { passive: true });
    onScroll();
  }
})();
