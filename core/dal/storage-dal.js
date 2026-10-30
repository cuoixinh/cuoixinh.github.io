/** DAL — Storage: upload / delete file trên Supabase Storage. */

class StorageDAL {
  constructor(supabaseClient, config) {
    this.supabase = supabaseClient;
    this.bucket = "wedding-images";
    this.storageBaseUrl = config.cloudflare.imageProxy || config.supabase.storageUrl;
  }

  // supabase-js không có hạn chờ: mạng rớt giữa chừng hoặc tab khác giữ khoá phiên
  // (getSession chạy ngầm trước mỗi upload) là promise treo mãi, kéo theo màn chờ.
  // Hết UPLOAD_TIMEOUT_MS thì coi là lỗi; nếu file vẫn lên muộn thì thành ảnh mồ côi,
  // tab "Dọn dữ liệu" của admin gom được.
  async uploadFile(filename, file) {
    // Đọc thử byte đầu trước khi gửi: trình duyệt mất dữ liệu ảnh thì supabase-js vẫn gửi
    // một request rỗng (400 "No content provided") mà không ai biết. Ảnh đã được chép vào
    // bộ nhớ từ lúc chọn/khôi phục (CXImagePick) nên đọc thử là đủ, khỏi nhân bản cả file.
    // code UNREADABLE = ảnh hỏng hẳn, nơi gọi bỏ khỏi hàng chờ thay vì thử lại.
    let readable = false;
    try {
      readable = file.size > 0 && (await file.slice(0, 1).arrayBuffer()).byteLength > 0;
    } catch (e) {
      console.warn("Không đọc được ảnh trước khi upload:", e);
    }
    if (!readable) {
      const err = new Error("Ảnh không còn đọc được, bạn chọn lại ảnh này");
      err.code = "UNREADABLE";
      throw err;
    }

    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(
        () => reject(new Error("Quá thời gian chờ, kiểm tra kết nối mạng")),
        StorageDAL.UPLOAD_TIMEOUT_MS,
      );
    });
    const upload = this.supabase.storage
      .from(this.bucket)
      .upload(filename, file, {
        cacheControl: "3600",
        upsert: false,
      });
    let data, error;
    try {
      ({ data, error } = await Promise.race([upload, timeout]));
    } finally {
      clearTimeout(timer);
    }

    if (error) {
      throw new Error(`Upload failed: ${error.message}`);
    }

    return filename;
  }

  // CỐ Ý KHÔNG có deleteFile/deleteFiles ở đây. Role `authenticated` chỉ được
  // `select`/`insert` trên storage.objects (changelogs/RC01/manual/dqvinh_001_storage_policies.sql) nên trình duyệt
  // không xoá được file — và đó là điều mình muốn: xoá ảnh đi qua Edge Function
  // `wedding-admin` (payload `deleted_images`), nơi khoá service role kiểm ảnh có
  // thuộc đúng thiệp rồi mới xoá. Thêm hàm xoá ở đây là mở lại đường ghi thẳng.

  // TÊN FILE trong bucket → URL xem được. Chỉ ghép khi đầu vào ĐÚNG là tên file:
  // giá trị đã là địa chỉ hoàn chỉnh (`http(s):`, `blob:`, `data:`, `//host`) hay
  // đường dẫn của trang (`/`, `./`, `../`) đều trả nguyên. Đây là chốt cuối —
  // ghép một `blob:` vào sẽ ra URL kiểu `…/wedding-images/blob:https://…`: ảnh vỡ
  // mà phải soi tận URL mới thấy. Nơi gọi không cần tự lọc trước.
  getPublicUrl(filename) {
    const v = typeof filename === "string" ? filename.trim() : "";
    if (!v) return "";

    if (
      /^[a-z][a-z0-9+.-]*:/i.test(v) || // có scheme: http(s), blob, data…
      v.startsWith("//") ||
      v.startsWith("/") ||
      v.startsWith("./") ||
      v.startsWith("../")
    ) {
      return v;
    }

    return `${this.storageBaseUrl}/${v}`;
  }
}

StorageDAL.UPLOAD_TIMEOUT_MS = 90000;

// Export for use in other files
if (typeof window !== "undefined") {
  window.StorageDAL = StorageDAL;
}
