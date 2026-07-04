/**
 * BL (Business Logic Layer) - Wedding
 * Xử lý logic nghiệp vụ, validation, transform data
 */

class WeddingBL {
  constructor(weddingDAL, storageDAL) {
    this.dal = weddingDAL;
    this.storage = storageDAL;
  }

  /**
   * Get wedding data by slug with validation
   * @param {string} slug - Wedding slug
   * @returns {Promise<Object>} Processed wedding data
   */
  async getWeddingBySlug(slug) {
    if (!slug) {
      throw new Error("Slug is required");
    }

    const data = await this.dal.getWeddingBySlug(slug);

    if (!data) {
      throw new Error("Wedding not found");
    }

    return this.processWeddingData(data);
  }

  /**
   * Get wedding data by ID with validation
   * @param {string} id - Wedding UUID
   * @returns {Promise<Object>} Processed wedding data
   */
  async getWeddingById(id) {
    if (!id) {
      throw new Error("ID is required");
    }

    const data = await this.dal.getWeddingById(id);

    if (!data) {
      throw new Error("Wedding not found");
    }

    return this.processWeddingData(data);
  }

  /**
   * Process wedding data (transform filenames to URLs)
   * @param {Object} data - Raw wedding data
   * @returns {Object} Processed data
   */
  processWeddingData(data) {
    const processed = { ...data };

    // Transform image filenames to full URLs
    const imageFields = [
      "cover_image_url",
      "groom_image_url",
      "bride_image_url",
      "groom_qr_url",
      "bride_qr_url",
    ];

    imageFields.forEach((field) => {
      if (processed[field]) {
        processed[field] = this.storage.getPublicUrl(processed[field]);
      }
    });

    // Transform gallery images
    if (Array.isArray(processed.gallery_images)) {
      processed.gallery_images = processed.gallery_images.map((filename) =>
        this.storage.getPublicUrl(filename),
      );
    }

    // Transform music URL
    if (processed.music_url) {
      processed.music_url = this.storage.getPublicUrl(processed.music_url);
    }

    return processed;
  }

  /**
   * Update wedding with validation
   * @param {Object} payload - Update payload
   * @returns {Promise<Object>} Updated data
   */
  async updateWedding(payload) {
    if (!payload.id) {
      throw new Error("Wedding ID is required");
    }

    // Validate required fields if provided
    if (payload.slug) {
      payload.slug = this.validateSlug(payload.slug);
    }

    if (payload.groom_name !== undefined && !payload.groom_name.trim()) {
      throw new Error("Tên chú rể không được để trống");
    }

    if (payload.bride_name !== undefined && !payload.bride_name.trim()) {
      throw new Error("Tên cô dâu không được để trống");
    }

    return await this.dal.updateWedding(payload);
  }

  /**
   * Create new wedding with validation
   * @param {Object} payload - Wedding data
   * @returns {Promise<Object>} Created data
   */
  async createWedding(payload) {
    // Validate required fields
    if (!payload.contact) {
      throw new Error("Contact is required");
    }

    if (payload.slug) {
      payload.slug = this.validateSlug(payload.slug);
    }

    return await this.dal.createWedding(payload);
  }

  /**
   * Validate and normalize slug
   * @param {string} slug - Raw slug
   * @returns {string} Normalized slug
   */
  validateSlug(slug) {
    if (!slug) {
      throw new Error("Slug cannot be empty");
    }

    const normalized = slug
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    if (!normalized) {
      throw new Error("Invalid slug format");
    }

    return normalized;
  }

  /**
   * Check if wedding is active
   * @param {Object} wedding - Wedding data
   * @returns {boolean}
   */
  isActive(wedding) {
    return wedding && wedding.is_active === true;
  }
}

// Export for use in other files
if (typeof window !== "undefined") {
  window.WeddingBL = WeddingBL;
}
