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
  // `select`/`insert` trên storage.objects (changelogs/RC1.15) nên trình duyệt
  // không xoá được file — và đó là điều mình muốn: xoá ảnh đi qua Edge Function
  // `wedding-admin` (payload `deleted_images`), nơi service_role kiểm ảnh có
  // thuộc đúng thiệp rồi mới xoá. Thêm hàm xoá ở đây là mở lại đường ghi thẳng.

  getPublicUrl(filename) {
    if (!filename) return "";

    // If already a full URL, return as-is
    if (filename.startsWith("http://") || filename.startsWith("https://")) {
      return filename;
    }

    // Build URL using Cloudflare Worker proxy
    return `${this.storageBaseUrl}/${filename}`;
  }
}

// Export for use in other files
if (typeof window !== "undefined") {
  window.StorageDAL = StorageDAL;
}
