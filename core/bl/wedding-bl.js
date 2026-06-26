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

  /**
   * Track wedding view
   * @param {Object} wedding - Wedding data
   * @param {boolean} isGroom - Is groom side
   * @param {Object} urlParams - URL parameters
   * @returns {Promise<void>}
   */
  async trackView(wedding, isGroom, urlParams) {
    const sheetUrl = isGroom
      ? wedding.groom_google_sheet_url
      : wedding.bride_google_sheet_url;

    const hasPersonalLink =
      urlParams.get("name") && urlParams.get("relationship");

    if (sheetUrl && hasPersonalLink) {
      try {
        await this.dal.markViewed(sheetUrl, window.location.href);
      } catch (error) {
        console.log("Cannot mark as viewed:", error);
      }
    }
  }

  /**
   * Get guest name from Google Sheet
   * @param {string} scriptUrl - Google Apps Script URL
   * @param {string} slug - Wedding slug
   * @returns {Promise<string|null>} Guest name or null
   */
  async getGuestName(scriptUrl, slug) {
    if (!scriptUrl || !slug) {
      return null;
    }

    try {
      const data = await this.dal.getGuestName(scriptUrl, slug);
      return data && data.guest_name ? data.guest_name : null;
    } catch (error) {
      console.log("Cannot load guest name:", error);
      return null;
    }
  }

  /**
   * Generate personalized links for guests
   * @param {string} weddingId - Wedding UUID
   * @param {string} side - "groom" or "bride"
   * @param {Function} encryptFn - Encryption function
   * @returns {Promise<Object>} Result with count
   */
  async generatePersonalizedLinks(weddingId, side, encryptFn) {
    if (!weddingId || !side) {
      throw new Error("Wedding ID and side are required");
    }

    if (!encryptFn || typeof encryptFn !== "function") {
      throw new Error("Encryption function is required");
    }

    // Get wedding data
    const wedding = await this.dal.getWeddingById(weddingId);

    const sheetUrl =
      side === "groom"
        ? wedding.groom_google_sheet_url
        : wedding.bride_google_sheet_url;

    if (!sheetUrl || !sheetUrl.includes("script.google.com")) {
      throw new Error("Google Sheet URL không hợp lệ");
    }

    // Fetch guests + headers in one request
    const { guests, headers } = await this.dal.getAllGuests(sheetUrl);

    // Validate headers client-side
    const EXPECTED = ["Họ và tên", "Tên hiển thị", "Quan hệ", "Link thiệp", "Đã xem thiệp", "Xác nhận tham dự", "Lời chúc", "Thời gian xác nhận"];
    if (headers.length > 0) {
      const errors = EXPECTED.map((expected, i) => {
        const actual = (headers[i] || "").toString().trim().split("\n")[0].trim();
        if (actual !== expected) {
          return `Cột ${String.fromCharCode(65 + i)}: cần "${expected}", đang là "${actual || "(trống)"}"`;
        }
        return null;
      }).filter(Boolean);

      if (errors.length > 0) {
        if (typeof showAlert === "function") {
          showAlert("Cấu trúc Google Sheet không đúng", errors.join("\n"), "error");
        }
        throw new Error("Cấu trúc Google Sheet không đúng");
      }
    }

    if (!guests || guests.length === 0) {
      throw new Error("Không tìm thấy khách mời nào");
    }

    // Generate links
    const domain = window.location.origin;
    const isGroom = side === "groom";
    const updates = [];
    let skipped = 0;

    for (const guest of guests) {
      // Skip if no relationship or already has link
      if (!guest.relationship || guest.link) {
        skipped++;
        continue;
      }

      try {
        const encryptedName = encryptFn(guest.displayName || "");
        const encryptedRelationship = encryptFn(guest.relationship);

        const link = `${domain}/${wedding.slug}?isGroom=${isGroom}&name=${encryptedName}&relationship=${encryptedRelationship}`;

        updates.push({ row: guest.row, link });
      } catch (error) {
        console.error(`Error generating link for row ${guest.row}:`, error);
      }
    }

    if (updates.length === 0) {
      return {
        success: false,
        message:
          skipped > 0
            ? "Tất cả khách đã có link hoặc chưa có quan hệ"
            : "Không có khách mời nào để tạo link",
        count: 0,
        skipped,
      };
    }

    // Batch update
    await this.dal.batchUpdateLinks(sheetUrl, updates);

    return {
      success: true,
      count: updates.length,
      skipped,
    };
  }
}

// Export for use in other files
if (typeof window !== "undefined") {
  window.WeddingBL = WeddingBL;
}
