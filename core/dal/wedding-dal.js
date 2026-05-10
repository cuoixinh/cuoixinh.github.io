/**
 * DAL (Data Access Layer) - Wedding
 * Chỉ chứa các hàm truy vấn database, không có logic nghiệp vụ
 */

class WeddingDAL {
  constructor(config) {
    this.edgeUrl = config.supabase.edgeUrl;
    this.anonKey = config.supabase.anonKey;
    this.workerUrl = config.cloudflare.cacheProxy;
  }

  /**
   * Fetch wedding data by slug
   * @param {string} slug - Wedding slug
   * @returns {Promise<Object>} Wedding data
   */
  async getWeddingBySlug(slug) {
    const apiUrl = this.workerUrl || this.edgeUrl;
    const response = await fetch(`${apiUrl}?slug=${encodeURIComponent(slug)}`, {
      headers: {
        Authorization: `Bearer ${this.anonKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error);
    }

    return data;
  }

  /**
   * Fetch wedding data by ID
   * @param {string} id - Wedding UUID
   * @returns {Promise<Object>} Wedding data
   */
  async getWeddingById(id) {
    const response = await fetch(
      `${this.edgeUrl}?id=${encodeURIComponent(id)}`,
      {
        headers: {
          Authorization: `Bearer ${this.anonKey}`,
        },
      },
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error);
    }

    return data;
  }

  /**
   * Update wedding data
   * @param {Object} payload - Data to update (must include id)
   * @returns {Promise<Object>} Updated wedding data
   */
  async updateWedding(payload) {
    const apiUrl = this.workerUrl || this.edgeUrl;
    const response = await fetch(apiUrl, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.anonKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    return await response.json();
  }

  /**
   * Create new wedding
   * @param {Object} payload - Wedding data
   * @returns {Promise<Object>} Created wedding data
   */
  async createWedding(payload) {
    const response = await fetch(this.edgeUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.anonKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    return await response.json();
  }

  /**
   * Delete wedding
   * @param {string} id - Wedding UUID
   * @param {string} token - Admin token
   * @returns {Promise<void>}
   */
  async deleteWedding(id, token) {
    const response = await fetch(`${this.edgeUrl}?id=${id}&token=${token}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${this.anonKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  }

  /**
   * List all weddings (admin only)
   * @param {string} token - Admin token
   * @returns {Promise<Array>} List of weddings
   */
  async listWeddings(token) {
    const response = await fetch(`${this.edgeUrl}?list=true&token=${token}`, {
      headers: {
        Authorization: `Bearer ${this.anonKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Mark wedding as viewed (tracking)
   * @param {string} sheetUrl - Google Sheet URL
   * @param {string} link - Full wedding link
   * @returns {Promise<void>}
   */
  async markViewed(sheetUrl, link) {
    await fetch(sheetUrl, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({
        action: "markViewed",
        link: link,
      }),
    });
  }

  /**
   * Get guest name from Google Sheet
   * @param {string} scriptUrl - Google Apps Script URL
   * @param {string} slug - Wedding slug
   * @returns {Promise<Object>} Guest data
   */
  async getGuestName(scriptUrl, slug) {
    const response = await fetch(`${scriptUrl}?slug=${slug}`);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Fetch all guests from Google Sheet
   * @param {string} sheetUrl - Google Sheet URL
   * @returns {Promise<Array>} List of guests
   */
  async getAllGuests(sheetUrl) {
    const response = await fetch(`${sheetUrl}?action=getAllGuests`);

    if (!response.ok) {
      throw new Error("Không thể kết nối đến Google Sheets");
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message || "Lỗi lấy dữ liệu từ Google Sheets");
    }

    return data.guests || [];
  }

  /**
   * Batch update links to Google Sheet
   * @param {string} sheetUrl - Google Sheet URL
   * @param {Array} updates - Array of {row, link}
   * @returns {Promise<Object>} Result
   */
  async batchUpdateLinks(sheetUrl, updates) {
    await fetch(sheetUrl, {
      method: "POST",
      mode: "no-cors",
      headers: {
        "Content-Type": "text/plain",
      },
      body: JSON.stringify({
        action: "batchUpdateLinks",
        updates: updates,
      }),
    });

    // no-cors mode doesn't allow reading response
    return { success: true, count: updates.length };
  }
}

// Export for use in other files
if (typeof window !== "undefined") {
  window.WeddingDAL = WeddingDAL;
}
