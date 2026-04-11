// Configuration
const MANAGE_EDGE_URL = "https://lcobawmkywtxhpezndsh.supabase.co/functions/v1/wedding-admin";
const MANAGE_SUPABASE_URL = "https://lcobawmkywtxhpezndsh.supabase.co";
const MANAGE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxjb2Jhd21reXd0eGhwZXpuZHNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4OTA5ODMsImV4cCI6MjA5MTQ2Njk4M30.4BNmxnfixXdHOq0ovtaF_4wQZ9sap3IWbJNJK9H4Mg4";

const params = new URLSearchParams(window.location.search);
const WEDDING_ID = params.get("id");
const DOMAIN = window.location.origin;

// Initialize Supabase client
let manageSupabase;
if (window.supabase) {
  manageSupabase = window.supabase.createClient(MANAGE_SUPABASE_URL, MANAGE_ANON_KEY);
}

// ============= TIME INPUT VALIDATION =============

function handleTimeInput(event) {
  const char = String.fromCharCode(event.which);
  const input = event.target;
  const value = input.value;
  
  // Chỉ cho phép số và dấu :
  if (!/[0-9:]/.test(char)) {
    event.preventDefault();
    return false;
  }
  
  // Tự động thêm dấu : sau khi nhập 2 số đầu
  if (value.length === 2 && char !== ':') {
    input.value = value + ':';
  }
  
  return true;
}

function validateTimeFormat(input) {
  const value = input.value.trim();
  
  if (!value) return; // Cho phép để trống
  
  // Kiểm tra format HH:MM
  const timeRegex = /^([0-1][0-9]|2[0-3]):([0-5][0-9])$/;
  
  if (!timeRegex.test(value)) {
    showToast("❌ Giờ không hợp lệ! Vui lòng nhập theo định dạng HH:MM (00:00 - 23:59)");
    input.value = "";
    input.focus();
    return false;
  }
  
  return true;
}

// ============= LUNAR CALENDAR FUNCTIONS =============
// Thuật toán chuyển đổi âm lịch của Hồ Ngọc Đức

function jdFromDate(dd, mm, yy) {
  const a = Math.floor((14 - mm) / 12);
  const y = yy + 4800 - a;
  const m = mm + 12 * a - 3;
  let jd = dd + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
  if (jd < 2299161) {
    jd = dd + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - 32083;
  }
  return jd;
}

function getNewMoonDay(k, timeZone) {
  const T = k / 1236.85;
  const T2 = T * T;
  const T3 = T2 * T;
  const dr = Math.PI / 180;
  let Jd1 = 2415020.75933 + 29.53058868 * k + 0.0001178 * T2 - 0.000000155 * T3;
  Jd1 = Jd1 + 0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * dr);
  const M = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3;
  const Mpr = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3;
  const F = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3;
  let C1 = (0.1734 - 0.000393 * T) * Math.sin(M * dr) + 0.0021 * Math.sin(2 * dr * M);
  C1 = C1 - 0.4068 * Math.sin(Mpr * dr) + 0.0161 * Math.sin(dr * 2 * Mpr);
  C1 = C1 - 0.0004 * Math.sin(dr * 3 * Mpr);
  C1 = C1 + 0.0104 * Math.sin(dr * 2 * F) - 0.0051 * Math.sin(dr * (M + Mpr));
  C1 = C1 - 0.0074 * Math.sin(dr * (M - Mpr)) + 0.0004 * Math.sin(dr * (2 * F + M));
  C1 = C1 - 0.0004 * Math.sin(dr * (2 * F - M)) - 0.0006 * Math.sin(dr * (2 * F + Mpr));
  C1 = C1 + 0.0010 * Math.sin(dr * (2 * F - Mpr)) + 0.0005 * Math.sin(dr * (2 * Mpr + M));
  let deltat;
  if (T < -11) {
    deltat = 0.001 + 0.000839 * T + 0.0002261 * T2 - 0.00000845 * T3 - 0.000000081 * T * T3;
  } else {
    deltat = -0.000278 + 0.000265 * T + 0.000262 * T2;
  }
  const JdNew = Jd1 + C1 - deltat;
  return Math.floor(JdNew + 0.5 + timeZone / 24);
}

function getSunLongitude(jdn, timeZone) {
  const T = (jdn - 2451545.5 - timeZone / 24) / 36525;
  const T2 = T * T;
  const dr = Math.PI / 180;
  const M = 357.52910 + 35999.05030 * T - 0.0001559 * T2 - 0.00000048 * T * T2;
  const L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T2;
  let DL = (1.914600 - 0.004817 * T - 0.000014 * T2) * Math.sin(dr * M);
  DL = DL + (0.019993 - 0.000101 * T) * Math.sin(dr * 2 * M) + 0.000290 * Math.sin(dr * 3 * M);
  let L = L0 + DL;
  L = L * dr;
  L = L - Math.PI * 2 * (Math.floor(L / (Math.PI * 2)));
  return Math.floor(L / Math.PI * 6);
}

function getLunarMonth11(yy, timeZone) {
  const off = jdFromDate(31, 12, yy) - 2415021;
  const k = Math.floor(off / 29.530588853);
  let nm = getNewMoonDay(k, timeZone);
  const sunLong = getSunLongitude(nm, timeZone);
  if (sunLong >= 9) {
    nm = getNewMoonDay(k - 1, timeZone);
  }
  return nm;
}

function getLeapMonthOffset(a11, timeZone) {
  const k = Math.floor((a11 - 2415021.076998695) / 29.530588853 + 0.5);
  let last = 0;
  let i = 1;
  let arc = getSunLongitude(getNewMoonDay(k + i, timeZone), timeZone);
  do {
    last = arc;
    i++;
    arc = getSunLongitude(getNewMoonDay(k + i, timeZone), timeZone);
  } while (arc != last && i < 14);
  return i - 1;
}

function convertSolar2Lunar(dd, mm, yy, timeZone = 7) {
  const dayNumber = jdFromDate(dd, mm, yy);
  const k = Math.floor((dayNumber - 2415021.076998695) / 29.530588853);
  let monthStart = getNewMoonDay(k + 1, timeZone);
  if (monthStart > dayNumber) {
    monthStart = getNewMoonDay(k, timeZone);
  }
  let a11 = getLunarMonth11(yy, timeZone);
  let b11 = a11;
  let lunarYear;
  if (a11 >= monthStart) {
    lunarYear = yy;
    a11 = getLunarMonth11(yy - 1, timeZone);
  } else {
    lunarYear = yy + 1;
    b11 = getLunarMonth11(yy + 1, timeZone);
  }
  const lunarDay = dayNumber - monthStart + 1;
  const diff = Math.floor((monthStart - a11) / 29);
  let lunarLeap = 0;
  let lunarMonth = diff + 11;
  if (b11 - a11 > 365) {
    const leapMonthDiff = getLeapMonthOffset(a11, timeZone);
    if (diff >= leapMonthDiff) {
      lunarMonth = diff + 10;
      if (diff == leapMonthDiff) {
        lunarLeap = 1;
      }
    }
  }
  if (lunarMonth > 12) {
    lunarMonth = lunarMonth - 12;
  }
  if (lunarMonth >= 11 && diff < 4) {
    lunarYear -= 1;
  }
  return { day: lunarDay, month: lunarMonth, year: lunarYear, leap: lunarLeap };
}

function getCanChi(year) {
  const can = ["Canh", "Tân", "Nhâm", "Quý", "Giáp", "Ất", "Bính", "Đinh", "Mậu", "Kỷ"];
  const chi = ["Thân", "Dậu", "Tuất", "Hợi", "Tý", "Sửu", "Dần", "Mão", "Thìn", "Tỵ", "Ngọ", "Mùi"];
  return can[(year + 6) % 10] + " " + chi[(year + 8) % 12];
}

function formatLunarDate(solarDateString) {
  if (!solarDateString) return "";
  
  try {
    const solarDate = new Date(solarDateString);
    const dd = solarDate.getDate();
    const mm = solarDate.getMonth() + 1;
    const yy = solarDate.getFullYear();
    
    const lunar = convertSolar2Lunar(dd, mm, yy, 7);
    const canChi = getCanChi(lunar.year);
    
    // Format: "19 tháng 9 năm Giáp Thìn"
    return `${lunar.day} tháng ${lunar.month} năm ${canChi}`;
  } catch (error) {
    console.error('Error converting to lunar date:', error);
    return "";
  }
}

// ============= HELPER FUNCTIONS =============

function generateUUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Resize image if too large
async function resizeImage(file, maxSizeMB = 1, maxWidth = 1920, maxHeight = 1920, quality = 0.85) {
  return new Promise((resolve, reject) => {
    console.log(`Processing ${file.name}: ${(file.size / 1024 / 1024).toFixed(2)}MB`);

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // Calculate new dimensions
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            if (width > maxWidth) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }
        }

        // Create canvas and resize
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // Try to compress to target size
        let currentQuality = quality;
        const tryCompress = (q) => {
          canvas.toBlob(
            (blob) => {
              if (blob) {
                const sizeMB = blob.size / 1024 / 1024;
                console.log(`Compressed with quality ${q.toFixed(2)}: ${sizeMB.toFixed(2)}MB`);
                
                // If still too large and quality can be reduced, try again
                if (sizeMB > maxSizeMB && q > 0.3) {
                  tryCompress(q - 0.1);
                } else {
                  const resizedFile = new File([blob], file.name, {
                    type: file.type,
                    lastModified: Date.now(),
                  });
                  console.log(`Final size: ${(resizedFile.size / 1024 / 1024).toFixed(2)}MB`);
                  resolve(resizedFile);
                }
              } else {
                reject(new Error('Failed to resize image'));
              }
            },
            file.type,
            q
          );
        };

        tryCompress(currentQuality);
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

function showToast(msg) {
  const toast = document.getElementById("toast");
  const toastText = document.getElementById("toast-text");
  if (toast && toastText) {
    toastText.textContent = msg;
    toast.style.opacity = "1";
    toast.style.transform = "translate(-50%, 0)";
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translate(-50%, 10px)";
    }, 3000);
  }
}

function showLoading(show, message = null) {
  const overlay = document.getElementById("loading-overlay");
  if (!overlay) return;
  
  if (show) {
    overlay.classList.remove("hidden");
    overlay.classList.add("flex");
    
    // Update message if provided
    if (message) {
      const messageEl = document.getElementById("loading-message");
      if (messageEl) {
        messageEl.textContent = message;
      }
    }
  } else {
    overlay.classList.add("hidden");
    overlay.classList.remove("flex");
    const progress = document.getElementById("upload-progress");
    if (progress) progress.textContent = "0%";
    
    // Reset message to default
    const messageEl = document.getElementById("loading-message");
    if (messageEl) {
      messageEl.textContent = "Đang xử lý...";
    }
  }
}

// ============= IMAGE PREVIEW FUNCTIONS =============

function showImagePreview(fieldName, url) {
  const prefix = fieldName.replace("_url", "").replace("_image", "");
  const uploadArea = document.getElementById(`${prefix}-upload-area`);
  const preview = document.getElementById(`${prefix}-preview`);
  const previewImg = document.getElementById(`${prefix}-preview-img`);

  if (uploadArea && preview && previewImg) {
    uploadArea.classList.add("hidden");
    preview.classList.remove("hidden");
    previewImg.src = url;
  }
}

function renderGalleryGrid() {
  const container = document.getElementById("gallery-container");
  if (!container) return;

  container.innerHTML = "";

  // Render existing images
  pendingUploads.galleryImages.forEach((file, index) => {
    const url = URL.createObjectURL(file);
    const div = document.createElement("div");
    div.className = "relative aspect-square rounded-lg overflow-hidden border border-gray-200 shadow-sm group bg-gray-100";
    div.innerHTML = `
      <img src="${url}" alt="Gallery ${index + 1}" class="w-full h-full object-contain" />
      <button onclick="removeGalleryImage(${index})" class="absolute top-1 right-1 bg-red-500 rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600 transition-colors shadow-md p-1">
        <img src="assets/icons/bin.png" alt="Delete" class="w-full h-full" />
      </button>
    `;
    container.appendChild(div);
  });

  // Render upload button if not at max
  if (pendingUploads.galleryImages.length < MAX_GALLERY_IMAGES) {
    const uploadBtn = document.createElement("div");
    uploadBtn.className = "aspect-square rounded-lg border border-dashed border-gray-300 bg-gray-50 hover:border-rose-400 hover:bg-rose-50 transition-all cursor-pointer flex items-center justify-center";
    uploadBtn.style.borderWidth = "1px";
    uploadBtn.style.borderStyle = "dashed";
    uploadBtn.onclick = () => document.getElementById("gallery-file-input").click();
    uploadBtn.innerHTML = `
      <div class="text-center">
        <div class="text-3xl text-gray-400 mb-1">+</div>
        <p class="text-xs text-gray-500">${pendingUploads.galleryImages.length}/${MAX_GALLERY_IMAGES}</p>
      </div>
    `;
    container.appendChild(uploadBtn);
  }
}

function renderSingleImageUpload(fieldName) {
  // Map field names to container IDs
  const containerMap = {
    'cover_image_url': 'cover',
    'groom_image_url': 'groom',
    'bride_image_url': 'bride',
    'groom_qr_url': 'groom-qr',
    'bride_qr_url': 'bride-qr'
  };
  
  const prefix = containerMap[fieldName];
  if (!prefix) {
    console.error(`Unknown field name: ${fieldName}`);
    return;
  }
  
  const container = document.getElementById(`${prefix}-container`);
  
  if (!container) {
    console.error(`Container not found: ${prefix}-container`);
    return;
  }

  container.innerHTML = "";

  // Determine size and object-fit based on field
  let sizeClass, objectFit;
  if (fieldName === "cover_image_url") {
    sizeClass = "aspect-[3/4]"; // Khung dọc cho cover
    objectFit = "object-cover";
  } else if (fieldName === "groom_image_url" || fieldName === "bride_image_url") {
    sizeClass = "h-52"; // h-52 = 208px, width sẽ set inline
    objectFit = "object-cover";
  } else if (fieldName === "groom_qr_url" || fieldName === "bride_qr_url") {
    sizeClass = "aspect-square"; // QR code hình vuông
    objectFit = "object-contain";
  } else {
    sizeClass = "aspect-square";
    objectFit = "object-contain";
  }

  if (pendingUploads.singleImages[fieldName]) {
    // Has image, show preview
    const url = URL.createObjectURL(pendingUploads.singleImages[fieldName]);
    const div = document.createElement("div");
    div.className = `relative ${sizeClass} rounded-lg overflow-hidden border border-gray-200 shadow-sm group bg-gray-100`;
    if (fieldName === "groom_image_url" || fieldName === "bride_image_url") {
      div.style.width = "183px";
    }
    div.innerHTML = `
      <img src="${url}" alt="Preview" class="w-full h-full ${objectFit}" />
      <button onclick="removeImage('${fieldName}')" class="absolute top-1 right-1 bg-red-500 rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600 transition-colors shadow-md p-1">
        <img src="assets/icons/bin.png" alt="Delete" class="w-full h-full" />
      </button>
    `;
    container.appendChild(div);
  } else {
    // No image, show upload button
    const uploadBtn = document.createElement("div");
    uploadBtn.className = `${sizeClass} rounded-lg border border-dashed border-gray-300 bg-gray-50 hover:border-rose-400 hover:bg-rose-50 transition-all cursor-pointer flex items-center justify-center`;
    uploadBtn.style.borderWidth = "1px";
    uploadBtn.style.borderStyle = "dashed";
    if (fieldName === "groom_image_url" || fieldName === "bride_image_url") {
      uploadBtn.style.width = "183px";
    }
    uploadBtn.onclick = () => document.getElementById(`${prefix}-file-input`).click();
    uploadBtn.innerHTML = `
      <div class="text-center">
        <div class="text-3xl text-gray-400 mb-1">+</div>
        <p class="text-xs text-gray-500">Chọn ảnh</p>
      </div>
    `;
    container.appendChild(uploadBtn);
  }
}

// ============= PENDING UPLOADS STORAGE =============

const MAX_GALLERY_IMAGES = 7;

const pendingUploads = {
  singleImages: {}, // { fieldName: File }
  galleryImages: []  // [File, File, ...]
};

// ============= PREVIEW FUNCTIONS (LOCAL) =============

async function handleImageUpload(event, fieldName) {
  const file = event.target.files[0];
  if (!file) return;

  console.log(`Selected image for ${fieldName}: ${file.name}, size: ${(file.size / 1024 / 1024).toFixed(2)}MB`);

  if (!file.type.startsWith("image/")) {
    showToast("❌ Chỉ chấp nhận file ảnh!");
    return;
  }

  showLoading(true, "Ảnh vượt quá dung lượng cho phép, đang nén ảnh lại...");

  try {
    // Resize image locally
    const processedFile = await resizeImage(file, 1, 1920, 1920);
    
    // Store file for later upload
    pendingUploads.singleImages[fieldName] = processedFile;
    
    // Render UI
    renderSingleImageUpload(fieldName);
    
    showToast("✅ Đã chọn ảnh (chưa lưu)");
  } catch (error) {
    console.error("Error processing image:", error);
    showToast("❌ Lỗi xử lý ảnh: " + error.message);
  } finally {
    showLoading(false);
  }
}

async function handleGalleryUpload(event) {
  const files = Array.from(event.target.files);
  if (files.length === 0) return;

  // Check limit
  const remainingSlots = MAX_GALLERY_IMAGES - pendingUploads.galleryImages.length;
  if (remainingSlots <= 0) {
    showToast(`❌ Đã đạt giới hạn ${MAX_GALLERY_IMAGES} ảnh`);
    return;
  }

  const filesToProcess = files.slice(0, remainingSlots);
  if (files.length > remainingSlots) {
    showToast(`⚠️ Chỉ chọn được ${remainingSlots} ảnh nữa`);
  }

  console.log(`Selected ${filesToProcess.length} gallery images`);
  showLoading(true, "Ảnh vượt quá dung lượng cho phép, đang nén ảnh lại...");
  const errors = [];

  try {
    for (let i = 0; i < filesToProcess.length; i++) {
      const file = filesToProcess[i];
      
      if (!file.type.startsWith("image/")) {
        errors.push(`${file.name} không phải ảnh`);
        continue;
      }

      try {
        // Resize image locally
        const processedFile = await resizeImage(file, 1, 1920, 1920);
        pendingUploads.galleryImages.push(processedFile);

        // Update progress
        const progress = Math.round(((i + 1) / filesToProcess.length) * 100);
        const progressEl = document.getElementById("upload-progress");
        if (progressEl) progressEl.textContent = `${progress}%`;
      } catch (error) {
        console.error(`Error processing ${file.name}:`, error);
        errors.push(`${file.name}: ${error.message}`);
      }
    }

    // Render grid
    renderGalleryGrid();

    const successCount = filesToProcess.length - errors.length;
    if (successCount > 0) {
      showToast(`✅ Đã chọn ${successCount} ảnh (chưa lưu)`);
    }

    if (errors.length > 0) {
      console.error("Selection errors:", errors);
      showToast(`⚠️ ${errors.length} ảnh lỗi`);
    }
  } catch (error) {
    console.error("Gallery selection error:", error);
    showToast("❌ Lỗi chọn ảnh: " + error.message);
  } finally {
    showLoading(false);
    // Reset input to allow selecting same files again
    event.target.value = "";
  }
}

// ============= ACTUAL UPLOAD FUNCTIONS =============

async function uploadSingleImage(fieldName, file) {
  const extension = file.name.split(".").pop();
  const imageId = generateUUID();
  const filePath = `${imageId}.${extension}`;

  console.log(`Uploading ${fieldName} to: ${filePath}`);

  const { data, error } = await manageSupabase.storage
    .from("wedding-images")
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: false,
    });

  if (error) throw error;

  const { data: urlData } = manageSupabase.storage
    .from("wedding-images")
    .getPublicUrl(filePath);

  return urlData.publicUrl;
}

async function uploadAllPendingImages() {
  const uploadedUrls = {};
  const errors = [];

  // Upload single images
  for (const [fieldName, file] of Object.entries(pendingUploads.singleImages)) {
    try {
      const url = await uploadSingleImage(fieldName, file);
      uploadedUrls[fieldName] = url;
      console.log(`Uploaded ${fieldName}: ${url}`);
    } catch (error) {
      console.error(`Error uploading ${fieldName}:`, error);
      errors.push(`${fieldName}: ${error.message}`);
    }
  }

  // Upload gallery images
  const galleryUrls = [];
  for (let i = 0; i < pendingUploads.galleryImages.length; i++) {
    const file = pendingUploads.galleryImages[i];
    try {
      const url = await uploadSingleImage(`gallery-${i}`, file);
      galleryUrls.push(url);
      console.log(`Uploaded gallery image ${i + 1}: ${url}`);
    } catch (error) {
      console.error(`Error uploading gallery image ${i + 1}:`, error);
      errors.push(`Gallery ${i + 1}: ${error.message}`);
    }
  }

  if (galleryUrls.length > 0) {
    uploadedUrls.gallery_images = galleryUrls;
  }

  return { uploadedUrls, errors };
}

// ============= REMOVE FUNCTIONS =============

function removeImage(fieldName) {
  // Remove from pending uploads
  delete pendingUploads.singleImages[fieldName];
  
  const input = document.querySelector(`input[name="${fieldName}"]`);
  if (input) input.value = "";

  // Render UI
  renderSingleImageUpload(fieldName);

  showToast("🗑️ Đã xóa ảnh");
}

function removeGalleryImage(index) {
  // Remove from pending uploads
  pendingUploads.galleryImages.splice(index, 1);
  
  // Render grid
  renderGalleryGrid();

  showToast("🗑️ Đã xóa ảnh");
}

// ============= DATA FUNCTIONS =============

async function loadData() {
  try {
    const res = await fetch(`${MANAGE_EDGE_URL}?id=${WEDDING_ID}`, {
      headers: { Authorization: `Bearer ${MANAGE_ANON_KEY}` },
    });
    if (!res.ok) throw new Error("Không tải được dữ liệu");
    const data = await res.json();
    fillForm(data);
  } catch (error) {
    showToast("❌ " + error.message);
  }
}

function fillForm(data) {
  const form = document.getElementById("wedding-form");
  if (!form) return;

  Object.keys(data).forEach((key) => {
    const el = form.querySelector(`[name="${key}"]`);
    if (!el || data[key] == null) return;

    if (key === "gallery_images") {
      const textarea = form.querySelector('[name="gallery_images_raw"]');
      if (textarea) {
        textarea.value = data[key].join("\n");
        renderGalleryGrid();
      }
    } else {
      el.value = data[key];

      // For single image fields, render the UI
      if (key === "cover_image_url" || key === "groom_image_url" || key === "bride_image_url" || key === "groom_qr_url" || key === "bride_qr_url") {
        if (data[key]) {
          // Create a fake file object for existing URL (we'll just store the URL in hidden input)
          // For now, just render empty upload button - user can upload new image
          renderSingleImageUpload(key);
        }
      } else if (key.includes("_url") && data[key]) {
        showImagePreview(key, data[key]);
      }
    }
  });
}

async function saveAll() {
  const btn = document.getElementById("save-btn");
  if (!btn) return;

  const originalText = btn.innerHTML;
  btn.innerHTML = '<span class="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span> Đang lưu...';
  btn.disabled = true;

  try {
    // Step 1: Upload pending images
    showLoading(true, "Đang tải ảnh lên server...");
    const { uploadedUrls, errors } = await uploadAllPendingImages();
    showLoading(false);

    if (errors.length > 0) {
      console.error("Upload errors:", errors);
      showToast(`⚠️ ${errors.length} ảnh lỗi khi upload`);
    }

    // Step 2: Prepare form data
    const form = document.getElementById("wedding-form");
    const formData = new FormData(form);
    const payload = { id: WEDDING_ID };

    formData.forEach((value, key) => {
      if (key === "gallery_images_raw") {
        // Skip, will handle separately
      } else if (value.trim()) {
        payload[key] = value.trim();
      }
    });

    // Step 3: Add uploaded URLs to payload
    for (const [fieldName, url] of Object.entries(uploadedUrls)) {
      if (fieldName === "gallery_images") {
        // Get existing gallery images from form
        const textarea = document.querySelector('textarea[name="gallery_images_raw"]');
        const existingUrls = textarea ? textarea.value.trim().split("\n").filter(Boolean) : [];
        
        // Merge with newly uploaded
        payload.gallery_images = [...existingUrls, ...url];
      } else {
        payload[fieldName] = url;
      }
    }

    // Handle gallery images if no new uploads
    if (!uploadedUrls.gallery_images) {
      const textarea = document.querySelector('textarea[name="gallery_images_raw"]');
      if (textarea) {
        payload.gallery_images = textarea.value.trim().split("\n").filter(Boolean);
      }
    }

    // Step 4: Save to database
    const res = await fetch(`${MANAGE_EDGE_URL}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${MANAGE_ANON_KEY}`,
      },
      body: JSON.stringify(payload),
    });
    
    if (!res.ok) throw new Error("Lỗi lưu dữ liệu");

    // Step 5: Clear pending uploads
    pendingUploads.singleImages = {};
    pendingUploads.galleryImages = [];

    showToast("✅ Đã lưu thành công!");
    
    // Reload to show saved data
    setTimeout(() => loadData(), 500);
  } catch (e) {
    console.error("Save error:", e);
    showToast("❌ Lỗi: " + e.message);
  } finally {
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
}

function copyText(inputId) {
  const input = document.getElementById(inputId);
  if (!input) return;
  
  navigator.clipboard.writeText(input.value);
  showToast("📋 Đã copy link!");
}

// ============= DRAG & DROP =============

function setupDragDrop(areaId, inputId, fieldName) {
  const area = document.getElementById(areaId);
  if (!area) return;

  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  ["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
    area.addEventListener(eventName, preventDefaults, false);
  });

  ["dragenter", "dragover"].forEach((eventName) => {
    area.addEventListener(eventName, () => area.classList.add("dragover"), false);
  });

  ["dragleave", "drop"].forEach((eventName) => {
    area.addEventListener(eventName, () => area.classList.remove("dragover"), false);
  });

  area.addEventListener("drop", (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length > 0) {
      const input = document.getElementById(inputId);
      if (input) {
        input.files = files;
        if (fieldName === "gallery") {
          handleGalleryUpload({ target: input });
        } else {
          handleImageUpload({ target: input }, fieldName);
        }
      }
    }
  }, false);
}

// ============= INITIALIZATION =============

function setupLunarDateListeners() {
  // Lễ thành hôn (chung)
  const ceremonyDate = document.querySelector('input[name="ceremony_date"]');
  const ceremonyLunar = document.querySelector('input[name="ceremony_lunar"]');
  
  if (ceremonyDate && ceremonyLunar) {
    ceremonyDate.addEventListener('change', (e) => {
      if (e.target.value) {
        ceremonyLunar.value = formatLunarDate(e.target.value);
      }
    });
  }
  
  // Tiệc cưới nhà trai
  const groomPartyDate = document.querySelector('input[name="groom_party_date"]');
  const groomPartyLunar = document.querySelector('input[name="groom_party_lunar"]');
  
  if (groomPartyDate && groomPartyLunar) {
    groomPartyDate.addEventListener('change', (e) => {
      if (e.target.value) {
        groomPartyLunar.value = formatLunarDate(e.target.value);
      }
    });
  }
  
  // Tiệc cưới nhà gái
  const bridePartyDate = document.querySelector('input[name="bride_party_date"]');
  const bridePartyLunar = document.querySelector('input[name="bride_party_lunar"]');
  
  if (bridePartyDate && bridePartyLunar) {
    bridePartyDate.addEventListener('change', (e) => {
      if (e.target.value) {
        bridePartyLunar.value = formatLunarDate(e.target.value);
      }
    });
  }
}

function initializePage() {
  const idLabel = document.getElementById("wedding-id-label");
  const groomLink = document.getElementById("link-groom");
  const brideLink = document.getElementById("link-bride");

  if (idLabel) idLabel.textContent = `ID: ${WEDDING_ID}`;
  if (groomLink) groomLink.value = `${DOMAIN}/index.html?id=${WEDDING_ID}&isGroom=true`;
  if (brideLink) brideLink.value = `${DOMAIN}/index.html?id=${WEDDING_ID}&isGroom=false`;

  // Initialize single image uploads
  renderSingleImageUpload("cover_image_url");
  renderSingleImageUpload("groom_image_url");
  renderSingleImageUpload("bride_image_url");
  renderSingleImageUpload("groom_qr_url");
  renderSingleImageUpload("bride_qr_url");

  // Initialize gallery grid
  renderGalleryGrid();
  
  // Setup lunar date auto-fill
  setupLunarDateListeners();

  if (WEDDING_ID) {
    loadData();
  } else {
    showToast("❌ Không tìm thấy ID thiệp cưới!");
  }
}

// ============= EXPOSE TO GLOBAL SCOPE =============

window.handleTimeInput = handleTimeInput;
window.validateTimeFormat = validateTimeFormat;
window.handleImageUpload = handleImageUpload;
window.handleGalleryUpload = handleGalleryUpload;
window.removeImage = removeImage;
window.removeGalleryImage = removeGalleryImage;
window.saveAll = saveAll;
window.copyText = copyText;

// ============= START =============

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializePage);
} else {
  initializePage();
}
