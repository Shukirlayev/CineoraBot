const mainMenu = {
  reply_markup: {
    keyboard: [
      ['🔍 Qidirish'],
      ['🎬 Kinolar', '📺 Seriallar'],
      ['🎌 Anime', '❤️ Sevimlilar']
    ],
    resize_keyboard: true
  }
};

const adminMainMenu = {
  reply_markup: {
    keyboard: [
      ["➕ Kontent qo'shish", '📋 Kontentlar'],
      ['📢 Kanallar', '👥 Adminlar'],
      ['📊 Statistika', '⚙️ Sozlamalar'],
      ['📣 Broadcast', '🔙 Foydalanuvchi menyusi']
    ],
    resize_keyboard: true
  }
};

module.exports = { mainMenu, adminMainMenu };
