/**
 * cxDeviceId() — mã thiết bị ngẫu nhiên giữ trong localStorage (`cx_did`), gửi
 * kèm mọi request AI làm CHIỀU ĐẾM THỨ HAI của hạn mức khách chưa đăng nhập:
 * đổi VPN/wifi thì IP đổi nhưng mã này không, nên vẫn hết lượt.
 *
 * Không phải danh tính, không gắn với tài khoản, không gửi đi đâu ngoài hai Edge
 * Function AI. Trình duyệt chặn storage → trả "" và server lùi về đếm theo IP.
 * Trang nào gọi ai-dal / ai-chat-dal đều phải nạp file này TRƯỚC.
 */
window.cxDeviceId = function cxDeviceId() {
  try {
    let id = localStorage.getItem("cx_did");
    if (!/^[a-z0-9-]{8,64}$/.test(id || "")) {
      id = (crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`)
        .toLowerCase();
      localStorage.setItem("cx_did", id);
    }
    return id;
  } catch {
    return "";
  }
};
