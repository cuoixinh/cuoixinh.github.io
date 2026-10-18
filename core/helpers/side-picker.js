// Popover chọn Nhà trai / Nhà gái — MỘT bản dùng chung: nút Xem trước của trang
// Thiết lập, Xem/Sao chép link ở "Quản lý thiệp" và "Khách mời". Nạp sau x-popover.js.
// Link nhà trai mang ?isGroom=true, nhà gái ?isGroom=false (isGroomSide ở utils.js).

function cxSideUrl(url, side) {
  return `${url}?isGroom=${side === "groom"}`;
}

// onPick nhận "groom" | "bride". opts: placement (mặc định bottom), active (bên
// đang chọn → có dấu ✓), only (gói Miễn phí chỉ mở một bên → không hỏi, đi thẳng bên
// đó). Bấm lại đúng nút đang mở thì đóng.
function cxPickSide(anchor, onPick, opts = {}) {
  if (opts.only === "groom" || opts.only === "bride") return onPick(opts.only);
  let pop = document.getElementById("cx-side-pop");
  if (!pop) {
    pop = document.createElement("x-popover");
    pop.id = "cx-side-pop";
    pop.setAttribute("arrow", "");
    document.body.appendChild(pop);
  }
  if (pop.isOpen && pop._anchorEl === anchor) return pop.close();

  pop.setAttribute("placement", opts.placement || "bottom");
  const ico = (name) => `<i data-lucide="${name}" style="width:16px;height:16px"></i>`;
  pop.setItems([
    { icon: ico("house"), label: "Thiệp nhà trai", active: opts.active === "groom", onClick: () => onPick("groom") },
    { icon: ico("heart"), label: "Thiệp nhà gái", active: opts.active === "bride", onClick: () => onPick("bride") },
  ]);
  window.lucide?.createIcons({ root: pop });
  pop.open(anchor);
}
