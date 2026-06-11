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
  inline_keyboard: [
    [
      { text: "➕ Kontent qo'shish", callback_data: 'admin_add_content' },
      { text: '📋 Kontentlar boshqaruvi', callback_data: 'admin_list_types' }
    ],
    [
      { text: '📢 Kanallar (Majburiy)', callback_data: 'admin_channels_menu' },
      { text: '👥 Adminlarni boshqarish', callback_data: 'admin_manage_menu' }
    ],
    [
      { text: '📊 Tizim Statistikasi', callback_data: 'admin_stats_view' },
      { text: '⚙️ Sozlamalar', callback_data: 'admin_settings_menu' }
    ],
    [
      { text: '👤 Foydalanuvchi menyusiga qaytish', callback_data: 'main_menu' }
    ]
  ]
};

module.exports = { mainMenu, adminMainMenu };
