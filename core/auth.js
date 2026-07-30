/**
 * AUTH.JS — Nguồn sự thật DUY NHẤT cho câu hỏi "đang đăng nhập hay chưa".
 *
 * Trước đây mỗi trang tự trả lời một kiểu: invitation-setup parse localStorage
 * bằng tay, payment.js / home-payment.js / auth-nav.js / theme-template mỗi nơi
 * cache một biến riêng từ getSession(). Hành vi lệch nhau và sửa một lỗi phải
 * sửa 6 chỗ → gom hết về đây.
 *
 * Nạp SAU core/config.js + supabase-js (và core/auth-ui.js nếu trang có), TRƯỚC
 * mọi file gọi CXAuth. Client được lấy lười (lazy) nên không cần chặt hơn thế.
 *
 *   CXAuth.isLoggedIn()   → boolean NGAY LẬP TỨC — dùng để vẽ UI lần đầu
 *   CXAuth.getUserSync()  → user | null, cùng nguồn với isLoggedIn()
 *   CXAuth.getUser()      → Promise<user|null> — hỏi supabase (tự refresh token)
 *   CXAuth.accessToken()  → Promise<string|null> — JWT cho request cần quyền
 *   CXAuth.onChange(cb)   → theo dõi phiên, trả về hàm huỷ đăng ký
 *
 * QUY TẮC: vẽ UI thì dùng bản SYNC (khỏi nhấp nháy); mọi quyết định GHI (lưu DB,
 * xuất bản, gọi API cần quyền) phải `await` bản ASYNC — access token hết hạn vẫn
 * refresh lại được, nên chỉ supabase mới biết chắc phiên còn hay đã mất.
 */
(function () {
  let _client = null;
  let _user = null; // bản mới nhất supabase trả về
  let _syncedOnce = false; // đã hỏi supabase lần nào chưa (chưa thì đọc storage)
  let _watching = false;
  const _subs = new Set();

  // Dùng chung client của AuthUI / core/supabase.js. Tự tạo client thứ hai là
  // supabase-js kêu "Multiple GoTrueClient instances" và listener chạy lệch nhau.
  function client() {
    if (_client) return _client;
    _client = window.AuthUI?.supabase || window.supabaseClient || null;
    _watch();
    return _client;
  }

  function _watch() {
    // Chỉ bật cờ khi CHẮC CHẮN gắn được listener — bật trước rồi optional-chaining
    // nuốt lỗi thì phiên đổi về sau không còn ai cập nhật, mà cũng không thử lại.
    if (_watching || !_client?.auth?.onAuthStateChange) return;
    _watching = true;
    _client.auth.onAuthStateChange((event, session) => {
      _setUser(session?.user ?? null, event);
    });
  }

  function _setUser(user, event) {
    const changed = (_user?.id ?? null) !== (user?.id ?? null);
    _user = user;
    _syncedOnce = true;
    if (changed) {
      _subs.forEach((cb) => {
        try {
          cb(_user, event);
        } catch (e) {
          console.error("CXAuth.onChange:", e);
        }
      });
    }
  }

  // Đọc phiên thẳng từ localStorage cho câu trả lời TỨC THÌ (lúc trang vừa mở,
  // getSession() còn đang chạy). KHÔNG JSON.parse thô: supabase-js v2 có thể lưu
  // dạng "base64-<b64(json)>" → parse thẳng sẽ ném lỗi và coi nhầm là chưa đăng nhập.
  function _readStored() {
    try {
      const key = Object.keys(localStorage).find(
        (k) => k.startsWith("sb-") && k.endsWith("-auth-token"),
      );
      if (!key) return null;
      let raw = localStorage.getItem(key);
      if (!raw) return null;
      if (raw.startsWith("base64-")) {
        raw = decodeURIComponent(escape(atob(raw.slice(7))));
      }
      return JSON.parse(raw) || null;
    } catch (e) {
      return null;
    }
  }

  function _storedUser() {
    const session = _readStored();
    if (!session?.user) return null;
    // access_token hết hạn KHÔNG có nghĩa là mất phiên: còn refresh_token thì
    // supabase tự làm mới. Chỉ coi là hết phiên khi hết hạn mà không còn gì để refresh.
    const expired =
      session.expires_at && session.expires_at * 1000 <= Date.now();
    if (expired && !session.refresh_token) return null;
    return session.user;
  }

  function getUserSync() {
    if (!_syncedOnce) {
      client(); // chạm để gắn listener sớm nhất có thể
      _user = _storedUser(); // chưa hỏi supabase → storage là bản tốt nhất đang có
    }
    return _user;
  }

  function isLoggedIn() {
    return !!getUserSync();
  }

  async function getUser() {
    const sb = client();
    if (!sb) return getUserSync(); // supabase-js chưa tải được → cố hết sức
    try {
      const { data } = await sb.auth.getSession();
      _setUser(data?.session?.user ?? null);
    } catch (e) {
      // Lỗi mạng: giữ nguyên bản đang có, đừng tự ý đá người dùng ra ngoài
      console.error("CXAuth.getUser:", e);
      return getUserSync();
    }
    return _user;
  }

  async function accessToken() {
    const sb = client();
    if (!sb) return null;
    try {
      const { data } = await sb.auth.getSession();
      _setUser(data?.session?.user ?? null);
      return data?.session?.access_token ?? null;
    } catch (e) {
      return null;
    }
  }

  // cb(user, event) chạy mỗi khi phiên ĐỔI (đăng nhập, đăng xuất, kể cả ở tab
  // khác). event là sự kiện gốc của supabase ("SIGNED_IN", "SIGNED_OUT"…) khi có.
  function onChange(cb) {
    _subs.add(cb);
    client();
    return () => _subs.delete(cb);
  }

  // Lấy mốc từ storage NGAY khi nạp: nếu để _user = null thì sự kiện đầu tiên
  // supabase bắn ra (INITIAL_SESSION / TOKEN_REFRESHED của người đang đăng nhập)
  // bị hiểu nhầm là "vừa đăng nhập" và báo đổi phiên oan cho mọi nơi đang nghe.
  _user = _storedUser();

  window.CXAuth = {
    client,
    getUserSync,
    isLoggedIn,
    getUser,
    accessToken,
    onChange,
  };
})();
