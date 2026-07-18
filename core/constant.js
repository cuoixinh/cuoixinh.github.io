/**
 * constant.js — Hằng số dùng chung toàn app.
 *
 * Nạp sớm (trước các file dùng tới) qua <script src="core/constant.js">.
 */
(function (global) {
  "use strict";

  // 10 câu mẫu chia sẻ thiệp. Biến trộn: ##Danh xưng## (tên khách), ##link## (link thiệp riêng).
  // Dùng cho nút "Chèn mẫu" ở tab Cấu hình.
  global.SHARE_MESSAGE_TEMPLATES = [
    "##Danh xưng## ơi, mình sắp về chung một nhà rồi! Trân trọng mời ##Danh xưng## đến chung vui cùng gia đình mình nhé. Thiệp mời tại: ##link##",
    "Gửi ##Danh xưng##, chúng mình sắp tổ chức đám cưới và rất mong có ##Danh xưng## góp mặt chia vui. Xem thiệp mời tại đây nha: ##link##",
    "##Danh xưng## thân mến, ngày trọng đại của mình đã đến rất gần. Mình xin gửi ##Danh xưng## tấm thiệp mời, rất mong ##Danh xưng## đến chung vui: ##link##",
    "Tin vui đây ##Danh xưng##! Mình chuẩn bị lên xe hoa rồi. Trân trọng kính mời ##Danh xưng## tới dự tiệc cưới của tụi mình nhé: ##link##",
    "##Danh xưng## ơi, sự hiện diện của ##Danh xưng## trong ngày cưới sẽ là niềm hạnh phúc lớn của tụi mình. Thiệp mời ở đây nha: ##link##",
    "Thân gửi ##Danh xưng##, tụi mình sắp tổ chức lễ thành hôn. Mời ##Danh xưng## bấm vào xem thiệp và đến chung vui cùng nhé: ##link##",
    "##Danh xưng## à, có một ngày rất đặc biệt sắp tới của tụi mình. Rất mong được đón tiếp ##Danh xưng## tại tiệc cưới. Thiệp mời: ##link##",
    "Trân trọng kính mời ##Danh xưng## đến dự lễ cưới của chúng mình. Sự góp mặt của ##Danh xưng## là món quà ý nghĩa nhất. Chi tiết tại: ##link##",
    "##Danh xưng## ơi, tụi mình cưới rồi nè! Mời ##Danh xưng## ghé xem thiệp và đến chung vui, chúc phúc cho tụi mình nhé: ##link##",
    "Gửi ##Danh xưng## lời mời thân thương nhất. Mong ##Danh xưng## sắp xếp thời gian đến dự đám cưới của tụi mình. Thiệp mời tại: ##link##",
  ];
})(window);
