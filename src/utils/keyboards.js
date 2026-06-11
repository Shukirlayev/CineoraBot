const mainMenu = {
  inline_keyboard: [
    [
      { text: '🎬 Kinolar', callback_data: 'menu_movie' },
      { text: '📺 Seriallar', callback_data: 'menu_serial' }
    ],
    [
      { text: '🎌 Anime', callback_data: 'menu_anime' },
      { text: '🔍 Qidirish', callback_data: 'menu_search' }
    ]
  ]
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
