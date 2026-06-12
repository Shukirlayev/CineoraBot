const mainMenu = {
  reply_markup: {
    keyboard: [
      ['🔍 Qidirish'],
      ['🎬 Kinolar', '📺 Seriallar'],
      ['🎌 Anime', '🎲 Tasodifiy'],
      ['❤️ Sevimlilar']
    ],
    resize_keyboard: true
  }
};

const adminMainMenu = {
  reply_markup: {
    keyboard: [
      ["➕ Kontent qo'shish", '📋 Kontentlar'],
      ['📣 Broadcast', '📊 Statistika'],
      ['📢 Kanallar', '👥 Adminlar'],
      ['📬 So\'rovlar', '⚙️ Sozlamalar'],
      ['🔙 Foydalanuvchi menyusi']
    ],
    resize_keyboard: true
  }
};

module.exports = { mainMenu, adminMainMenu };