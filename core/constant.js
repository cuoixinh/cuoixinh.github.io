/** Hằng số dùng chung toàn app. Nạp sớm, trước các file dùng tới. */
(function (global) {
  "use strict";

  // 10 câu mẫu chia sẻ thiệp. Biến trộn: ##Relationship## (xưng hô của khách: Bạn, Anh, Chị…), ##link## (link thiệp riêng).
  // Dùng cho nút "Chèn mẫu" ở tab Cấu hình.
  global.SHARE_MESSAGE_TEMPLATES = [
    "##Relationship## ơi, mình sắp về chung một nhà rồi! Trân trọng mời ##Relationship## đến chung vui cùng gia đình mình nhé. Thiệp mời tại: ##link##",
    "Gửi ##Relationship##, chúng mình sắp tổ chức đám cưới và rất mong có ##Relationship## góp mặt chia vui. Xem thiệp mời tại đây nha: ##link##",
    "##Relationship## thân mến, ngày trọng đại của mình đã đến rất gần. Mình xin gửi ##Relationship## tấm thiệp mời, rất mong ##Relationship## đến chung vui: ##link##",
    "Tin vui đây ##Relationship##! Mình chuẩn bị lên xe hoa rồi. Trân trọng kính mời ##Relationship## tới dự tiệc cưới của tụi mình nhé: ##link##",
    "##Relationship## ơi, sự hiện diện của ##Relationship## trong ngày cưới sẽ là niềm hạnh phúc lớn của tụi mình. Thiệp mời ở đây nha: ##link##",
    "Thân gửi ##Relationship##, tụi mình sắp tổ chức lễ thành hôn. Mời ##Relationship## bấm vào xem thiệp và đến chung vui cùng nhé: ##link##",
    "##Relationship## à, có một ngày rất đặc biệt sắp tới của tụi mình. Rất mong được đón tiếp ##Relationship## tại tiệc cưới. Thiệp mời: ##link##",
    "Trân trọng kính mời ##Relationship## đến dự lễ cưới của chúng mình. Sự góp mặt của ##Relationship## là món quà ý nghĩa nhất. Chi tiết tại: ##link##",
    "##Relationship## ơi, tụi mình cưới rồi nè! Mời ##Relationship## ghé xem thiệp và đến chung vui, chúc phúc cho tụi mình nhé: ##link##",
    "Gửi ##Relationship## lời mời thân thương nhất. Mong ##Relationship## sắp xếp thời gian đến dự đám cưới của tụi mình. Thiệp mời tại: ##link##",
  ];
})(window);
