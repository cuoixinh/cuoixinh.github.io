/** BL — Wedding: validation, transform, business rules. */

// Trần độ dài slug (xem validateSlug). Nơi nào tự ghép hậu tố vào slug phải chừa
// chỗ trong mức này, không thì validateSlug cắt mất hậu tố lúc lưu.
const SLUG_MAX_LENGTH = 50;

class WeddingBL {
  constructor(weddingDAL, storageDAL) {
    this.dal = weddingDAL;
    this.storage = storageDAL;
  }

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

  /** Transform dữ liệu thô: đổi tên file ảnh thành URL đầy đủ. */
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
   * Chuẩn hoá + validate slug. Đây là NƠI DUY NHẤT định nghĩa luật đặt slug —
   * chỗ nào cần sinh/kiểm slug đều phải gọi vào đây, tự viết lại là hai bên lệch
   * nhau rồi slug đem đi kiểm trùng khác slug thực sự lưu → ăn 409.
   * Kết quả luôn khớp /^[a-z0-9]+(-[a-z0-9]+)*$/ và dài tối đa SLUG_MAX_LENGTH:
   * có dấu thì bỏ dấu ("Hoàng Lan" → "hoang-lan"), không băm thành "ho-ng".
   * Hàm luỹ đẳng: gọi lại trên kết quả cũ vẫn ra chính nó.
   */
  validateSlug(slug) {
    if (!slug) {
      throw new Error("Slug cannot be empty");
    }

    let normalized = String(slug)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // dấu thanh/dấu mũ (viết dạng \u để không hỏng khi file bị đổi encoding)
      .replace(/đ/gi, "d") // đ/Đ không tách dấu bằng NFD nên phải thay tay
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-") // khoảng trắng & ký tự lạ đều thành "-", gộp liền nhau
      .replace(/^-|-$/g, "");

    if (normalized.length > SLUG_MAX_LENGTH) {
      const cut = normalized.slice(0, SLUG_MAX_LENGTH);
      const lastDash = cut.lastIndexOf("-");
      // Cắt tại gạch nối cho khỏi đứt giữa từ. Trừ khi gạch nối nằm quá sớm (một
      // từ dài chiếm gần hết) — giữ lại mẩu vụn còn tệ hơn là cắt cứng giữa từ.
      normalized =
        lastDash >= SLUG_MAX_LENGTH / 2 ? cut.slice(0, lastDash) : cut.replace(/-$/, "");
    }

    if (!normalized) {
      throw new Error("Invalid slug format");
    }

    return normalized;
  }

  isActive(wedding) {
    return wedding && wedding.is_active === true;
  }
}

// Export for use in other files
if (typeof window !== "undefined") {
  window.WeddingBL = WeddingBL;
  window.SLUG_MAX_LENGTH = SLUG_MAX_LENGTH;
}
