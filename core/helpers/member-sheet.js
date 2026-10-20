// Popup "Chia sẻ quyền quản lý": chủ thiệp mời 1 người (vd người bạn đời) cùng quản lý khách
// mời bằng email, xem trạng thái, gỡ. Dưới sm dính đáy màn, từ sm là hộp 480px giữa màn
// (.cx-mem* ở styles/_common.css). Quyền + giới hạn bên do guest-handler giữ. Dùng ở
// /guest-list/; cần nạp trước: core/utils.js (escapeHtml), core/helpers/alert.js
// (showToast), guestDAL (core/dal/guest-dal.js + core/supabase.js), lucide.

const CX_MEMBER_SIDES = [
  { id: "groom", label: "Nhà trai", chip: "Khách nhà trai", icon: "mars" },
  { id: "bride", label: "Nhà gái", chip: "Khách nhà gái", icon: "venus" },
  { id: "", label: "Cả hai", chip: "Cả hai bên", icon: "users" },
];

const _CX_MEM_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const _cxMemIco = (name, size = 18) =>
  `<i data-lucide="${name}" style="width:${size}px;height:${size}px"></i>`;

const _cxMemRights = `
  <div class="cx-mem-rights">
    <div class="cx-mem-right cx-mem-right--yes">
      <p class="cx-mem-right-h">Được làm</p>
      <p class="cx-mem-right-t">Thêm, sửa, xoá khách<br>Nhập Excel, nhập bằng AI<br>Xem ai đã xem, sẽ đến</p>
    </div>
    <div class="cx-mem-right cx-mem-right--no">
      <p class="cx-mem-right-h">Không được</p>
      <p class="cx-mem-right-t">Sửa nội dung thiệp<br>Thanh toán, nâng gói<br>Xoá thiệp</p>
    </div>
  </div>`;

// Khung xương lúc đọc thành viên: dáng của form mời (trường hợp hay gặp nhất) — ô email,
// ba ô chọn bên, hai ô quyền hạn, nút chính.
const _cxMemSkeleton = `
  <div class="cx-mem-pad cx-mem-stack cx-mem-sk-wrap" aria-hidden="true">
    <div class="cx-mem-field">
      <span class="cx-mem-sk" style="width:140px;height:14px"></span>
      <span class="cx-mem-sk" style="height:52px;border-radius:14px"></span>
      <span class="cx-mem-sk" style="width:85%;height:12px"></span>
    </div>
    <div class="cx-mem-field">
      <span class="cx-mem-sk" style="width:160px;height:14px"></span>
      <div class="cx-mem-sides">
        <span class="cx-mem-sk" style="height:88px;border-radius:16px"></span>
        <span class="cx-mem-sk" style="height:88px;border-radius:16px"></span>
        <span class="cx-mem-sk" style="height:88px;border-radius:16px"></span>
      </div>
    </div>
    <div class="cx-mem-rights">
      <span class="cx-mem-sk" style="height:96px;border-radius:14px"></span>
      <span class="cx-mem-sk" style="height:96px;border-radius:14px"></span>
    </div>
    <span class="cx-mem-sk" style="height:52px"></span>
  </div>
  <p class="sr-only" role="status">Đang tải</p>`;

// opts.names: "Minh Anh & Quốc Huy" — dòng phụ của tiêu đề + lời nhắn sao chép.
async function cxOpenMemberSheet(weddingId, opts = {}) {
  if (document.getElementById("cx-mem")) return;
  const names = opts.names || "";
  const root = document.createElement("div");
  root.id = "cx-mem";
  root.className = "cx-mem";
  root.innerHTML = `
    <section class="cx-mem-box" role="dialog" aria-modal="true" aria-labelledby="cx-mem-title">
      <span class="cx-mem-grab" aria-hidden="true"></span>
      <header class="cx-mem-head">
        <span class="cx-mem-badge">${_cxMemIco("user-plus", 22)}</span>
        <div class="min-w-0 flex-1">
          <h2 id="cx-mem-title" class="cx-mem-title">Chia sẻ quyền quản lý</h2>
          ${names ? `<p class="cx-mem-sub">Thiệp ${escapeHtml(names)}</p>` : ""}
        </div>
        <button type="button" class="cx-mem-x" data-mem-close aria-label="Đóng">${_cxMemIco("x")}</button>
      </header>
      <div class="cx-mem-body">${_cxMemSkeleton}</div>
    </section>`;
  document.body.appendChild(root);
  // Khoá trang bằng position:fixed chứ không chỉ overflow:hidden — iOS bỏ qua overflow
  // khi bàn phím bung: trang phía sau trôi theo cú vuốt, ẩn bàn phím xong kẹt ở chỗ lệch
  // và popup không cuộn lại được nữa. Đóng popup thì trả trang về đúng chỗ cũ.
  const body = document.body;
  const scrollY = window.scrollY;
  const prev = { position: body.style.position, top: body.style.top, left: body.style.left, right: body.style.right, overflow: body.style.overflow };
  Object.assign(body.style, { position: "fixed", top: `-${scrollY}px`, left: "0", right: "0", overflow: "hidden" });
  window.lucide?.createIcons({ root });

  // Bàn phím vừa ẩn (ô nhập mất focus): kéo khung nhìn về 0 — iOS đẩy nó lên lúc bung
  // bàn phím và không tự trả về.
  const onBlur = () => setTimeout(() => window.scrollTo(0, 0), 60);
  root.addEventListener("focusout", onBlur);

  const close = () => {
    document.removeEventListener("keydown", onKey, true);
    Object.assign(body.style, prev);
    window.scrollTo(0, scrollY);
    root.remove();
  };
  const onKey = (e) => {
    if (e.key === "Escape") close();
  };
  document.addEventListener("keydown", onKey, true);
  root.addEventListener("click", (e) => {
    if (e.target === root || e.target.closest("[data-mem-close]")) close();
  });

  const ctx = { weddingId, names, body: root.querySelector(".cx-mem-body"), box: root.querySelector(".cx-mem-box"), close };
  try {
    _cxMemRender(ctx, await guestDAL.getMember(weddingId));
  } catch (e) {
    _cxMemResize(ctx.box, () => {
      ctx.body.innerHTML = `<p class="cx-mem-loading cx-mem-loading--err">${escapeHtml(e.message || "Không tải được thông tin chia sẻ")}</p>`;
    });
  }
}

function _cxMemRender(ctx, member) {
  _cxMemResize(ctx.box, () => {
    if (member) _cxMemRenderMember(ctx, member);
    else _cxMemRenderForm(ctx);
    window.lucide?.createIcons({ root: ctx.body });
  });
}

// Đổi ruột popup (khung xương → form / thẻ thành viên, mở khung xác nhận gỡ…) mà
// không giật: đo chiều cao trước và sau `change`, rồi cho hộp trượt giữa hai số. Hết
// chuyển động thì trả height về tự do (max-height của .cx-mem-box vẫn chặn trần).
function _cxMemResize(box, change) {
  const from = box.getBoundingClientRect().height;
  change();
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  box.style.transition = "none";
  box.style.height = "auto";
  const to = box.getBoundingClientRect().height;
  if (Math.abs(to - from) < 2) {
    box.style.height = "";
    box.style.transition = "";
    return;
  }
  box.style.height = `${from}px`;
  box.getBoundingClientRect(); // chốt mốc đầu trước khi bật transition
  box.style.transition = "height 0.28s cubic-bezier(0.4, 0, 0.2, 1)";
  box.style.height = `${to}px`;
  const run = (box._cxResizeRun = (box._cxResizeRun || 0) + 1);
  const done = (e) => {
    if (e && e.target !== box) return;
    if (run !== box._cxResizeRun) return; // lượt đổi mới hơn đã thay lượt này
    box.removeEventListener("transitionend", done);
    box.style.height = "";
    box.style.transition = "";
  };
  box.addEventListener("transitionend", done);
  setTimeout(done, 400); // transitionend có lúc không tới (tab ẩn, hộp bị gỡ)
}

// Chưa mời ai: email + chọn bên (không chọn sẵn — người lập thiệp có thể là cô dâu hay
// chú rể, đoán là dễ giao nhầm cả danh sách bên mình) + quyền hạn. Nút chỉ sáng khi đủ.
function _cxMemRenderForm(ctx) {
  ctx.body.innerHTML = `
    <form class="cx-mem-form" novalidate>
      <div class="cx-mem-pad cx-mem-stack">
        <div class="cx-mem-field">
          <label for="cx-mem-email" class="cx-mem-label">Email người được mời</label>
          <div class="cx-mem-input">
            ${_cxMemIco("mail")}
            <input id="cx-mem-email" type="email" inputmode="email" autocomplete="email"
              placeholder="email@vidu.com" />
          </div>
          <p class="cx-mem-help">Người này đăng nhập CuoiXinh bằng đúng email trên là thấy thiệp ở mục Khách mời.</p>
        </div>
        <fieldset class="cx-mem-field">
          <legend class="cx-mem-label">Được quản lý khách của</legend>
          <div class="cx-mem-sides" role="radiogroup">
            ${CX_MEMBER_SIDES.map((s) => `
              <button type="button" role="radio" aria-checked="false" class="cx-mem-side" data-side="${s.id}">
                <span class="cx-mem-side-ico">${_cxMemIco(s.icon)}</span>
                <span class="cx-mem-side-label">${s.label}</span>
              </button>`).join("")}
          </div>
        </fieldset>
        ${_cxMemRights}
        <p class="cx-mem-err hidden" role="alert"></p>
      </div>
      <footer class="cx-mem-foot">
        <button type="submit" class="cx-mem-cta" disabled>${_cxMemIco("send")}Mời cùng quản lý</button>
        <p class="cx-mem-foot-note">Mỗi thiệp mời được 1 người</p>
      </footer>
    </form>`;

  const form = ctx.body.querySelector("form");
  const input = form.querySelector("#cx-mem-email");
  const box = form.querySelector(".cx-mem-input");
  const cta = form.querySelector(".cx-mem-cta");
  const err = form.querySelector(".cx-mem-err");
  let side = null;
  const sync = () => {
    const email = input.value.trim();
    box.classList.toggle("is-bad", !!email && !_CX_MEM_EMAIL_RE.test(email));
    cta.disabled = !(_CX_MEM_EMAIL_RE.test(email) && side !== null);
  };
  input.addEventListener("input", sync);
  form.querySelectorAll(".cx-mem-side").forEach((b) =>
    b.addEventListener("click", () => {
      side = b.dataset.side;
      form.querySelectorAll(".cx-mem-side").forEach((o) => {
        const on = o === b;
        o.classList.toggle("is-on", on);
        o.setAttribute("aria-checked", String(on));
      });
      sync();
    }),
  );
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (cta.disabled) return;
    cta.disabled = true;
    err.classList.add("hidden");
    try {
      const m = await guestDAL.addMember(ctx.weddingId, input.value.trim(), side || null);
      showToast("Đã chia sẻ quyền quản lý", "success");
      _cxMemRender(ctx, m);
    } catch (ex) {
      err.textContent = ex.message || "Không chia sẻ được quyền quản lý";
      err.classList.remove("hidden");
      cta.disabled = false;
    }
  });
  setTimeout(() => input.focus(), 50);
}

// Đã mời: thẻ người đó + trạng thái. Chờ đăng nhập → nút chính sao chép lời nhắn (hệ
// thống không gửi thư mời); đã tham gia → quyền hạn + Xong. Gỡ hỏi lại ngay trong popup.
function _cxMemRenderMember(ctx, member) {
  const side = CX_MEMBER_SIDES.find((s) => s.id === (member.side || "")) || CX_MEMBER_SIDES[2];
  const status = member.joined
    ? `<div class="cx-mem-status cx-mem-status--ok">${_cxMemIco("check")}<p><b>Đã tham gia</b> · đang quản lý ${side.chip.toLowerCase()}</p></div>`
    : `<div class="cx-mem-status cx-mem-status--wait"><span class="cx-mem-dot"></span><p><b>Chờ đăng nhập.</b> Nhắn người này đăng nhập CuoiXinh bằng đúng email trên để bắt đầu.</p></div>`;
  const actions = member.joined
    ? `<div class="cx-mem-row">
        <button type="button" class="cx-mem-link" data-mem-remove>Gỡ người này</button>
        <button type="button" class="cx-mem-cta cx-mem-cta--fit" data-mem-close>Xong</button>
      </div>`
    : `<button type="button" class="cx-mem-cta" data-mem-copy>${_cxMemIco("copy")}Sao chép lời nhắn gửi Zalo</button>
       <button type="button" class="cx-mem-link cx-mem-link--center" data-mem-remove>Gỡ người này</button>`;

  ctx.body.innerHTML = `
    <div class="cx-mem-pad cx-mem-stack cx-mem-pad--end">
      <div class="cx-mem-card">
        <div class="cx-mem-who">
          <span class="cx-mem-ava">${escapeHtml(member.email.charAt(0).toUpperCase())}</span>
          <div class="min-w-0 flex-1">
            <p class="cx-mem-email">${escapeHtml(member.email)}</p>
            <span class="cx-mem-chip">${side.chip}</span>
          </div>
        </div>
        ${status}
      </div>
      ${member.joined ? _cxMemRights : ""}
      <div class="cx-mem-confirm" style="display:none;">
        <p><b>Gỡ ${escapeHtml(member.email)}?</b> Người này sẽ không quản lý được khách mời nữa. Danh sách khách vẫn giữ nguyên.</p>
        <div class="cx-mem-confirm-btns">
          <button type="button" class="cx-mem-ghost" data-mem-cancel>Huỷ</button>
          <button type="button" class="cx-mem-danger" data-mem-confirm>Gỡ</button>
        </div>
      </div>
      <div class="cx-mem-actions">${actions}</div>
    </div>`;

  const confirmBox = ctx.body.querySelector(".cx-mem-confirm");
  const actionsBox = ctx.body.querySelector(".cx-mem-actions");
  // style.display chứ không phải class "hidden": hai khối có display riêng ở CSS.
  const toggleConfirm = (on) =>
    _cxMemResize(ctx.box, () => {
      confirmBox.style.display = on ? "" : "none";
      actionsBox.style.display = on ? "none" : "";
    });
  ctx.body.querySelector("[data-mem-remove]").addEventListener("click", () => toggleConfirm(true));
  ctx.body.querySelector("[data-mem-cancel]").addEventListener("click", () => toggleConfirm(false));
  ctx.body.querySelector("[data-mem-confirm]").addEventListener("click", async (e) => {
    e.currentTarget.disabled = true;
    try {
      await guestDAL.removeMember(ctx.weddingId);
      showToast("Đã gỡ quyền quản lý", "success");
      _cxMemRender(ctx, null);
    } catch (ex) {
      e.currentTarget.disabled = false;
      showToast(ex.message || "Không gỡ được quyền quản lý", "error");
    }
  });
  ctx.body.querySelector("[data-mem-copy]")?.addEventListener("click", () => {
    const msg =
      `Mình đã mời bạn cùng quản lý khách mời thiệp cưới${ctx.names ? ` ${ctx.names}` : ""} trên CuoiXinh. ` +
      `Bạn đăng nhập bằng email ${member.email} tại ${location.origin}/guest-list/ nhé.`;
    navigator.clipboard
      .writeText(msg)
      .then(() => showToast("Đã sao chép lời nhắn", "success"))
      .catch(() => showToast("Không sao chép được lời nhắn", "error"));
  });
}
