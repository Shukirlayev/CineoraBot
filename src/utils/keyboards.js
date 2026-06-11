const mainMenu = {
  reply_markup: {
    keyboard: [
      ['🎬 Kinolar', '📺 Seriallar'],
      ['🎌 Anime', '🔍 Qidirish'],
      ['📊 Statistika']
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
      ['🔙 Foydalanuvchi menyusi']
    ],
    resize_keyboard: true
  }
};

module.exports = { mainMenu, adminMainMenu };
