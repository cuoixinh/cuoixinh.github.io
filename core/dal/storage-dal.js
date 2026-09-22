/** DAL — Storage: upload / delete file trên Supabase Storage. */

class StorageDAL {
  constructor(supabaseClient, config) {
    this.supabase = supabaseClient;
    this.bucket = "wedding-images";
    this.storageBaseUrl = config.cloudflare.imageProxy || config.supabase.storageUrl;
  }

  async uploadFile(filename, file) {
    const { data, error } = await this.supabase.storage
      .from(this.bucket)
      .upload(filename, file, {
        cacheControl: "3600",
        upsert: false,
      });

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

// Export for use in other files
if (typeof window !== "undefined") {
  window.StorageDAL = StorageDAL;
}
