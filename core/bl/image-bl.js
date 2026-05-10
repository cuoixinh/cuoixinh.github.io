/**
 * BL (Business Logic Layer) - Image Processing
 * Xử lý logic upload, resize, validate ảnh
 */

class ImageBL {
  constructor(storageDAL) {
    this.storage = storageDAL;
    this.maxSizeMB = 1;
    this.maxWidth = 1920;
    this.maxHeight = 1920;
    this.quality = 0.85;
  }

  /**
   * Validate image file
   * @param {File} file - File object
   * @throws {Error} If validation fails
   */
  validateImageFile(file) {
    if (!file) {
      throw new Error("File is required");
    }

    if (!file.type.startsWith("image/")) {
      throw new Error("Chỉ chấp nhận file ảnh");
    }

    // Max 50MB before resize (increased to handle large photos from cameras)
    const maxBeforeResize = 50 * 1024 * 1024;
    if (file.size > maxBeforeResize) {
      throw new Error("File quá lớn (tối đa 50MB)");
    }
  }

  /**
   * Resize image if needed
   * @param {File} file - Original file
   * @returns {Promise<File>} Resized file
   */
  async resizeImage(file) {
    this.validateImageFile(file);

    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        const img = new Image();

        img.onload = () => {
          // Calculate new dimensions
          let width = img.width;
          let height = img.height;

          if (width > this.maxWidth || height > this.maxHeight) {
            if (width > height) {
              if (width > this.maxWidth) {
                height = Math.round((height * this.maxWidth) / width);
                width = this.maxWidth;
              }
            } else {
              if (height > this.maxHeight) {
                width = Math.round((width * this.maxHeight) / height);
                height = this.maxHeight;
              }
            }
          }

          // Create canvas and resize
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);

          // Compress to target size
          this._compressCanvas(canvas, file, this.quality, resolve, reject);
        };

        img.onerror = () => reject(new Error("Failed to load image"));
        img.src = e.target.result;
      };

      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });
  }

  /**
   * Compress canvas to target size
   * @private
   */
  _compressCanvas(canvas, originalFile, quality, resolve, reject) {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Failed to compress image"));
          return;
        }

        const sizeMB = blob.size / 1024 / 1024;

        // If still too large and quality can be reduced, try again
        if (sizeMB > this.maxSizeMB && quality > 0.3) {
          this._compressCanvas(
            canvas,
            originalFile,
            quality - 0.1,
            resolve,
            reject,
          );
        } else {
          const resizedFile = new File([blob], originalFile.name, {
            type: originalFile.type,
            lastModified: Date.now(),
          });
          resolve(resizedFile);
        }
      },
      originalFile.type,
      quality,
    );
  }

  /**
   * Upload single image
   * @param {string} weddingId - Wedding UUID
   * @param {string} fieldName - Field name (e.g., "cover_image_url")
   * @param {File} file - File object
   * @returns {Promise<string>} Uploaded filename
   */
  async uploadSingleImage(weddingId, fieldName, file) {
    // Resize first
    const resizedFile = await this.resizeImage(file);

    // Generate filename
    const extension = file.name.split(".").pop();
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    const filename = `${weddingId}-${fieldName}-${timestamp}-${random}.${extension}`;

    // Upload to storage
    return await this.storage.uploadFile(filename, resizedFile);
  }

  /**
   * Upload multiple images (gallery)
   * @param {string} weddingId - Wedding UUID
   * @param {Array<File>} files - Array of files
   * @returns {Promise<Object>} Result with filenames and errors
   */
  async uploadMultipleImages(weddingId, files) {
    const filenames = [];
    const errors = [];

    for (let i = 0; i < files.length; i++) {
      try {
        const filename = await this.uploadSingleImage(
          weddingId,
          `gallery-${i}`,
          files[i],
        );
        filenames.push(filename);
      } catch (error) {
        errors.push({
          index: i,
          filename: files[i].name,
          error: error.message,
        });
      }
    }

    return { filenames, errors };
  }

  /**
   * Delete images from storage
   * @param {Array<string>} filenames - Array of filenames
   * @returns {Promise<Array>} Results
   */
  async deleteImages(filenames) {
    if (!filenames || filenames.length === 0) {
      return [];
    }

    // Filter out full URLs (only delete filenames)
    const filenamesToDelete = filenames.filter(
      (f) => f && !f.startsWith("http://") && !f.startsWith("https://"),
    );

    if (filenamesToDelete.length === 0) {
      return [];
    }

    return await this.storage.deleteFiles(filenamesToDelete);
  }

  /**
   * Generate UUID for filename
   * @returns {string} UUID
   */
  generateUUID() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
      /[xy]/g,
      function (c) {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      },
    );
  }
}

// Export for use in other files
if (typeof window !== "undefined") {
  window.ImageBL = ImageBL;
}
