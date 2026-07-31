// Ô chọn ngân hàng có tìm kiếm, quote ngẫu nhiên, kiểm tra ô nhập giờ.
//
// Tách từ index.js (dòng 1851–2070 bản gốc). Thứ tự nạp khai báo ở loader.js.

// ============= BANK SEARCHABLE SELECT =============

const BANK_LIST = [
  "Vietcombank - Ngân hàng TMCP Ngoại thương Việt Nam",
  "VietinBank - Ngân hàng TMCP Công Thương Việt Nam",
  "BIDV - Ngân hàng TMCP Đầu tư và Phát triển Việt Nam",
  "Agribank - Ngân hàng Nông nghiệp và Phát triển Nông thôn Việt Nam",
  "MB Bank - Ngân hàng TMCP Quân đội",
  "Techcombank - Ngân hàng TMCP Kỹ Thương Việt Nam",
  "ACB - Ngân hàng TMCP Á Châu",
  "VPBank - Ngân hàng TMCP Việt Nam Thịnh Vượng",
  "TPBank - Ngân hàng TMCP Tiên Phong",
  "Sacombank - Ngân hàng TMCP Sài Gòn Thương Tín",
  "HDBank - Ngân hàng TMCP Phát triển TP.HCM",
  "VIB - Ngân hàng TMCP Quốc tế Việt Nam",
  "SHB - Ngân hàng TMCP Sài Gòn - Hà Nội",
  "Eximbank - Ngân hàng TMCP Xuất Nhập khẩu Việt Nam",
  "MSB - Ngân hàng TMCP Hàng Hải Việt Nam",
  "OCB - Ngân hàng TMCP Phương Đông",
  "SeABank - Ngân hàng TMCP Đông Nam Á",
  "VietCapital Bank - Ngân hàng TMCP Bản Việt",
  "SCB - Ngân hàng TMCP Sài Gòn",
  "VietBank - Ngân hàng TMCP Việt Nam Thương Tín",
  "LienVietPostBank - Ngân hàng TMCP Bưu Điện Liên Việt",
  "PVcomBank - Ngân hàng TMCP Đại Chúng Việt Nam",
  "BacABank - Ngân hàng TMCP Bắc Á",
  "VietABank - Ngân hàng TMCP Việt Á",
  "NCB - Ngân hàng TMCP Quốc Dân",
  "SaigonBank - Ngân hàng TMCP Sài Gòn Công Thương",
  "ABBank - Ngân hàng TMCP An Bình",
  "Nam A Bank - Ngân hàng TMCP Nam Á",
  "PGBank - Ngân hàng TMCP Xăng dầu Petrolimex",
  "BaoViet Bank - Ngân hàng TMCP Bảo Việt",
  "GPBank - Ngân hàng TMCP Dầu khí Toàn Cầu",
  "OceanBank - Ngân hàng TMCP Đại Dương",
  "CBBank - Ngân hàng TMCP Xây dựng Việt Nam",
  "KienLongBank - Ngân hàng TMCP Kiên Long",
  "DongA Bank - Ngân hàng TMCP Đông Á",
  "UOB - Ngân hàng United Overseas Bank",
  "Standard Chartered - Ngân hàng Standard Chartered Việt Nam",
  "HSBC - Ngân hàng HSBC Việt Nam",
  "Shinhan Bank - Ngân hàng TNHH MTV Shinhan Việt Nam",
  "Woori Bank - Ngân hàng TNHH MTV Woori Việt Nam",
  "Hong Leong Bank - Ngân hàng TNHH MTV Hong Leong Việt Nam",
  "CIMB - Ngân hàng TNHH MTV CIMB Việt Nam",
  "Public Bank - Ngân hàng TNHH MTV Public Việt Nam",
];

function setupBankSearchableSelect(inputId, dropdownId, hiddenInputId) {
  const input = document.getElementById(inputId);
  const dropdown = document.getElementById(dropdownId);
  const hiddenInput = document.getElementById(hiddenInputId);

  if (!input || !dropdown || !hiddenInput) return;

  let selectedIndex = -1;

  // Render dropdown options
  function renderOptions(banks) {
    if (banks.length === 0) {
      dropdown.innerHTML =
        '<div class="px-4 py-3 text-sm text-gray-500">Không tìm thấy ngân hàng</div>';
      dropdown.classList.remove("hidden");
      return;
    }

    dropdown.innerHTML = banks
      .map(
        (bank, index) => `
      <div class="bank-option px-4 py-3 hover:bg-rose-50 cursor-pointer transition-colors text-sm border-b border-gray-100 last:border-b-0 ${index === selectedIndex ? "bg-rose-50" : ""}" data-value="${bank}">
        ${bank}
      </div>
    `,
      )
      .join("");

    dropdown.classList.remove("hidden");

    // Add click handlers
    dropdown.querySelectorAll(".bank-option").forEach((option) => {
      option.addEventListener("click", () => {
        const value = option.dataset.value;
        input.value = value;
        hiddenInput.value = value;
        // Gán .value bằng code KHÔNG tự phát sự kiện → phát thủ công để autosave (form nghe "input") chạy,
        // nếu không, chọn ngân hàng xong F5 sẽ mất (khác với gõ text vốn tự phát input).
        hiddenInput.dispatchEvent(new Event("input", { bubbles: true }));
        dropdown.classList.add("hidden");
        selectedIndex = -1;
      });
    });
  }

  // Filter banks
  function filterBanks(query) {
    if (!query.trim()) {
      renderOptions(BANK_LIST);
      return;
    }

    const normalizedQuery = query.toLowerCase().trim();
    const filtered = BANK_LIST.filter((bank) =>
      bank.toLowerCase().includes(normalizedQuery),
    );

    renderOptions(filtered);
  }

  // Input event
  input.addEventListener("input", (e) => {
    selectedIndex = -1;
    hiddenInput.value = e.target.value; // Update hidden input as user types
    filterBanks(e.target.value);
  });

  // Focus event
  input.addEventListener("focus", () => {
    filterBanks(input.value);
  });

  // Keyboard navigation
  input.addEventListener("keydown", (e) => {
    const options = dropdown.querySelectorAll(".bank-option");

    if (e.key === "ArrowDown") {
      e.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, options.length - 1);
      updateSelection(options);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, -1);
      updateSelection(options);
    } else if (
      e.key === "Enter" &&
      selectedIndex >= 0 &&
      options[selectedIndex]
    ) {
      e.preventDefault();
      options[selectedIndex].click();
    } else if (e.key === "Escape") {
      dropdown.classList.add("hidden");
      selectedIndex = -1;
    }
  });

  function updateSelection(options) {
    options.forEach((opt, idx) => {
      if (idx === selectedIndex) {
        opt.classList.add("bg-rose-50");
        opt.scrollIntoView({ block: "nearest" });
      } else {
        opt.classList.remove("bg-rose-50");
      }
    });
  }

  // Click outside to close
  document.addEventListener("click", (e) => {
    if (!input.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.classList.add("hidden");
      selectedIndex = -1;
    }
  });
}

// ============= QUOTE RANDOM =============

const QUOTE_LIST = [
  "Cảm ơn em đã đến bên đời nhau, cùng nhau viết nên câu chuyện của riêng chúng ta.",
  "Tình yêu không phải là nhìn nhau, mà là cùng nhau nhìn về một hướng.",
  "Hạnh phúc là khi có một người để yêu, một nơi để về và một lý do để tin.",
  "Từ hôm nay, anh/em không còn là một, mà là hai người cùng chung một trái tim.",
  "Yêu nhau không chỉ là nói lời yêu, mà là ở bên nhau mỗi ngày.",
  "Tình yêu đích thực là khi hai người cùng nhau trưởng thành.",
  "Hôn nhân không phải là điểm kết thúc, mà là khởi đầu của một hành trình mới.",
  "Tình yêu là khi hai trái tim cùng đập chung một nhịp.",
  "Hạnh phúc nhất là được sống bên người mình yêu mỗi ngày.",
  "Yêu là cho đi không cần đòi hỏi, là chia sẻ không cần tính toán.",
];

function randomQuote() {
  const textarea = document.getElementById("story-quote-textarea");
  if (!textarea) return;

  const randomIndex = Math.floor(Math.random() * QUOTE_LIST.length);
  textarea.value = QUOTE_LIST[randomIndex];
  // Gán .value bằng code không tự phát sự kiện → phát "input" để autosave lưu + x-input đồng bộ
  textarea.dispatchEvent(new Event("input", { bubbles: true }));

  // Add a little animation
  textarea.classList.add("ring-4", "ring-purple-500/20");
  setTimeout(() => {
    textarea.classList.remove("ring-4", "ring-purple-500/20");
  }, 500);
}

// ============= AI: TẠO NỘI DUNG THIỆP =============
// (Đã tách sang ai-modal.js + styles/_ai-modal.css để index.js gọn hơn.)

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
  if (value.length === 2 && char !== ":") {
    input.value = value + ":";
  }

  return true;
}

