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

  async deleteFile(filename) {
    const { error } = await this.supabase.storage
      .from(this.bucket)
      .remove([filename]);

    if (error) {
      throw new Error(`Delete failed: ${error.message}`);
    }
  }

  async deleteFiles(filenames) {
    const results = [];

    for (const filename of filenames) {
      try {
        await this.deleteFile(filename);
        results.push({ filename, success: true });
      } catch (error) {
        results.push({ filename, success: false, error: error.message });
      }
    }

    return results;
  }

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
