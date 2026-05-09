/**
 * SUPABASE.JS - Database Layer Initialization
 * Khởi tạo các instance DAL và BL để sử dụng trong toàn bộ app
 */

// ===== INITIALIZE SUPABASE CLIENT =====
let supabaseClient = null;
if (typeof window.supabase !== "undefined") {
  supabaseClient = window.supabase.createClient(
    CONFIG.supabase.url,
    CONFIG.supabase.anonKey,
  );
}

// ===== INITIALIZE DAL INSTANCES =====
const weddingDAL = new WeddingDAL(CONFIG);
const storageDAL = new StorageDAL(supabaseClient, CONFIG);

// ===== INITIALIZE BL INSTANCES =====
const weddingBL = new WeddingBL(weddingDAL, storageDAL);
const imageBL = new ImageBL(storageDAL);

// ===== EXPORT TO GLOBAL SCOPE =====
window.weddingDAL = weddingDAL;
window.storageDAL = storageDAL;
window.weddingBL = weddingBL;
window.imageBL = imageBL;
window.supabaseClient = supabaseClient;
