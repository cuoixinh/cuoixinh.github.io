/**
 * DAL (Data Access Layer) - Storage
 * Chỉ chứa các hàm upload/delete file từ Supabase Storage
 */

class StorageDAL {
  constructor(supabaseClient, config) {
    this.supabase = supabaseClient;
    this.bucket = "wedding-images";
    this.storageBaseUrl = config.cloudflare.imageProxy || config.supabase.storageUrl;
  }

  /**
   * Upload single file to storage
   * @param {string} filename - Target filename
   * @param {File} file - File object
   * @returns {Promise<string>} Uploaded filename
   */
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

  /**
   * Delete file from storage
   * @param {string} filename - Filename to delete
   * @returns {Promise<void>}
   */
  async deleteFile(filename) {
    const { error } = await this.supabase.storage
      .from(this.bucket)
      .remove([filename]);

    if (error) {
      throw new Error(`Delete failed: ${error.message}`);
    }
  }

  /**
   * Delete multiple files from storage
   * @param {Array<string>} filenames - Array of filenames
   * @returns {Promise<Array>} Results
   */
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

  /**
   * Get public URL for a file
   * @param {string} filename - Filename
   * @returns {string} Public URL
   */
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
