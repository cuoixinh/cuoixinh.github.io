/** Khởi tạo các instance DAL và BL dùng chung toàn app. */

// Ưu tiên dùng lại client của AuthUI: hai client trên cùng một trang là hai phiên
// + hai listener song song ("Multiple GoTrueClient instances"), trạng thái đăng
// nhập dễ lệch nhau.
let supabaseClient = window.AuthUI?.supabase || null;
if (!supabaseClient && typeof window.supabase !== "undefined") {
  supabaseClient = window.supabase.createClient(
    CONFIG.supabase.url,
    CONFIG.supabase.anonKey,
  );
}

// ===== INITIALIZE DAL INSTANCES =====
const weddingDAL = new WeddingDAL(CONFIG);
const storageDAL = new StorageDAL(supabaseClient, CONFIG);
const guestDAL = typeof GuestDAL !== 'undefined' ? new GuestDAL() : null;

// ===== INITIALIZE BL INSTANCES =====
const weddingBL = new WeddingBL(weddingDAL, storageDAL);
const imageBL = new ImageBL(storageDAL);
const guestBL = typeof GuestBL !== 'undefined' ? new GuestBL(guestDAL) : null;

// ===== EXPORT TO GLOBAL SCOPE =====
window.weddingDAL = weddingDAL;
window.storageDAL = storageDAL;
window.guestDAL = guestDAL;
window.weddingBL = weddingBL;
window.imageBL = imageBL;
window.guestBL = guestBL;
window.supabaseClient = supabaseClient;
