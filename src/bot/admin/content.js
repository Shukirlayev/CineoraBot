const { Composer } = require('telegraf');
const Content = require('../../models/Content');
const Season = require('../../models/Season');
const Episode = require('../../models/Episode');
const { generateUniqueId, getDeepLink } = require('../../utils/helpers');

const composer = new Composer();

// Kontent qo'shish
composer.hears("➕ Kontent qo'shish", async (ctx) => {
  if (!ctx.adminRole) return;
  ctx.session = ctx.session || {};
  ctx.session.adminState = { step: 'select_type' };

  await ctx.reply('📦 Kontent turini tanlang:', {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '🎬 Kino', callback_data: 'add_type_movie' },
          { text: '📺 Serial', callback_data: 'add_type_serial' }
        ],
        [{ text: '🎌 Anime', callback_data: 'add_type_anime' }],
        [{ text: '❌ Bekor qilish', callback_data: 'add_cancel' }]
      ]
    }
  });
});

composer.action(/^add_type_(movie|serial|anime)$/, async (ctx) => {
  if (!ctx.adminRole) return ctx.answerCbQuery('❌ Ruxsat yo\'q');
  const type = ctx.match[1];
  ctx.session = ctx.session || {};
  ctx.session.adminState = { step: 'enter_title', contentData: { type } };
  const names = { movie: '🎬 Kino', serial: '📺 Serial', anime: '🎌 Anime' };
  await ctx.answerCbQuery();
  try {
    await ctx.editMessageText(`✅ Tur: ${names[type]}\n\n📝 Kontent nomini yozing:`);
  } catch (e) {}
});

composer.action('add_cancel', async (ctx) => {
  if (ctx.session) ctx.session.adminState = null;
  await ctx.answerCbQuery();
  try {
    await ctx.editMessageText('❌ Bekor qilindi.');
  } catch (e) {}
});

// Tilni saqlash
composer.action(/^lang_(uz|ru|original|bluray)$/, async (ctx) => {
  if (!ctx.adminRole) return;
  const state = ctx.session?.adminState;
  if (!state) return;
  const lang = ctx.match[1];
  if (!state.contentData.languages) state.contentData.languages = [];
  if (state.contentData.languages.includes(lang)) {
    state.contentData.languages = state.contentData.languages.filter(l => l !== lang);
    await ctx.answerCbQuery(`❌ ${lang} olib tashlandi`);
  } else {
    state.contentData.languages.push(lang);
    await ctx.answerCbQuery(`✅ ${lang} qo'shildi`);
  }
});

const langKeyboard = {
  inline_keyboard: [
    [
      { text: "🇺🇿 O'zbek", callback_data: 'lang_uz' },
      { text: '🇷🇺 Rus', callback_data: 'lang_ru' }
    ],
    [
      { text: '🌍 Original', callback_data: 'lang_original' },
      { text: '💿 Blu-ray', callback_data: 'lang_bluray' }
    ],
    [{ text: '✅ Tayyor', callback_data: 'lang_done' }]
  ]
};

composer.action('lang_done', async (ctx) => {
  if (!ctx.adminRole) return;
  const state = ctx.session?.adminState;
  if (!state) return;
  await ctx.answerCbQuery();

  if (state.contentData.type === 'movie') {
    state.step = 'send_file';
    await ctx.reply('🎥 Kino faylini yuboring (video):');
  } else {
    state.step = 'enter_season_number';
    await ctx.reply('📁 Fasl raqamini yozing (masalan: 1):');
  }
});

// Matn handleri
composer.on('text', async (ctx, next) => {
  if (!ctx.adminRole) return next();
  const state = ctx.session?.adminState;
  if (!state) return next();

  const text = ctx.message.text.trim();

  if (text === '❌ Bekor qilish') {
    ctx.session.adminState = null;
    return ctx.reply('❌ Bekor qilindi.');
  }

  switch (state.step) {
    case 'enter_title': {
      state.contentData.title = text;
      state.step = 'enter_description';
      await ctx.reply('📝 Tavsif yozing (yoki /skip):');
      break;
    }
    case 'enter_description': {
      if (text !== '/skip') state.contentData.description = text;
      state.step = 'enter_year';
      await ctx.reply('📅 Yilni yozing (masalan: 2023) yoki /skip:');
      break;
    }
    case 'enter_year': {
      if (text !== '/skip') {
        const y = parseInt(text);
        if (!isNaN(y)) state.contentData.year = y;
      }
      state.step = 'enter_language';
      await ctx.reply('🌐 Tillarni tanlang (bir nechtasini tanlash mumkin):', { reply_markup: langKeyboard });
      break;
    }
    case 'enter_season_number': {
      const n = parseInt(text);
      if (isNaN(n)) return ctx.reply('❌ Raqam kiriting:');
      state.contentData.seasonNumber = n;
      state.step = 'enter_episode_number';
      await ctx.reply(`📺 ${n}-Fasldagi necha-qismni yuklayapsiz?`);
      break;
    }
    case 'enter_episode_number': {
      const n = parseInt(text);
      if (isNaN(n)) return ctx.reply('❌ Raqam kiriting:');
      state.contentData.episodeNumber = n;
      state.step = 'send_file';
      await ctx.reply(
        `🎥 ${state.contentData.seasonNumber}-Fasl, ${n}-Qism uchun video yuboring:`
      );
      break;
    }
    default:
      return next();
  }
});

// Video/document handleri
composer.on(['video', 'document'], async (ctx, next) => {
  if (!ctx.adminRole) return next();
  const state = ctx.session?.adminState;
  if (!state || state.step !== 'send_file') return next();

  const fileId = ctx.message.video?.file_id || ctx.message.document?.file_id;
  if (!fileId) return next();

  const data = state.contentData;

  if (data.type === 'movie') {
    let uniqueId, existing;
    do {
      uniqueId = generateUniqueId();
      existing = await Content.findOne({ uniqueId });
    } while (existing);

    await Content.create({
      uniqueId,
      title: data.title,
      description: data.description,
      type: data.type,
      year: data.year,
      languages: data.languages || [],
      fileId,
      createdBy: ctx.from.id
    });

    ctx.session.adminState = null;
    const link = getDeepLink(uniqueId);

    await ctx.reply(
      `✅ <b>${data.title}</b> saqlandi!\n\n` +
      `🆔 ID: <code>${uniqueId}</code>\n` +
      `🔗 Link:\n${link}`,
      { parse_mode: 'HTML' }
    );
  } else {
    let content = await Content.findOne({ title: data.title, type: data.type });

    if (!content) {
      let uniqueId, existing;
      do {
        uniqueId = generateUniqueId();
        existing = await Content.findOne({ uniqueId });
      } while (existing);

      content = await Content.create({
        uniqueId,
        title: data.title,
        description: data.description,
        type: data.type,
        year: data.year,
        languages: data.languages || [],
        createdBy: ctx.from.id
      });
    }

    let season = await Season.findOne({ contentId: content._id, seasonNumber: data.seasonNumber });
    if (!season) {
      season = await Season.create({
        contentId: content._id,
        seasonNumber: data.seasonNumber,
        title: `${data.seasonNumber}-Fasl`
      });
    }

    await Episode.create({
      contentId: content._id,
      seasonId: season._id,
      episodeNumber: data.episodeNumber,
      fileId,
      language: data.languages?.[0] || ''
    });

    const link = getDeepLink(content.uniqueId);

    ctx.session.adminState = {
      step: 'ask_more',
      contentData: {
        ...data,
        contentId: content._id,
        seasonId: season._id
      }
    };

    await ctx.reply(
      `✅ ${data.seasonNumber}-Fasl, ${data.episodeNumber}-Qism saqlandi!\n\n` +
      `🔗 Link:\n${link}\n\nDavom etasizmi?`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '➕ Keyingi qism', callback_data: 'ep_next' },
              { text: '📁 Yangi fasl', callback_data: 'ep_new_season' }
            ],
            [{ text: '✅ Tugatish', callback_data: 'ep_done' }]
          ]
        }
      }
    );
  }
});

composer.action('ep_next', async (ctx) => {
  if (!ctx.adminRole) return;
  const state = ctx.session?.adminState;
  if (!state) return;
  state.contentData.episodeNumber += 1;
  state.step = 'send_file';
  await ctx.answerCbQuery();
  await ctx.reply(
    `🎥 ${state.contentData.seasonNumber}-Fasl, ${state.contentData.episodeNumber}-Qism uchun video yuboring:`
  );
});

composer.action('ep_new_season', async (ctx) => {
  if (!ctx.adminRole) return;
  const state = ctx.session?.adminState;
  if (!state) return;
  state.contentData.seasonNumber += 1;
  state.contentData.episodeNumber = 1;
  state.step = 'send_file';
  await ctx.answerCbQuery();
  await ctx.reply(
    `🎥 ${state.contentData.seasonNumber}-Fasl, 1-Qism uchun video yuboring:`
  );
});

composer.action('ep_done', async (ctx) => {
  if (!ctx.adminRole) return;
  if (ctx.session) ctx.session.adminState = null;
  await ctx.answerCbQuery();
  await ctx.reply('✅ Kontent yuklash yakunlandi!');
});

// Kontentlar ro'yxati
composer.hears('📋 Kontentlar', async (ctx) => {
  if (!ctx.adminRole) return;

  await ctx.reply("📋 Kontent turini tanlang:", {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '🎬 Kinolar', callback_data: 'admin_list_movie_0' },
          { text: '📺 Seriallar', callback_data: 'admin_list_serial_0' }
        ],
        [{ text: '🎌 Anime', callback_data: 'admin_list_anime_0' }]
      ]
    }
  });
});

composer.action(/^admin_list_(movie|serial|anime)_(\d+)$/, async (ctx) => {
  if (!ctx.adminRole) return ctx.answerCbQuery('❌');
  const type = ctx.match[1];
  const page = parseInt(ctx.match[2]);
  const limit = 8;

  const contents = await Content.find({ type })
    .sort({ createdAt: -1 })
    .skip(page * limit)
    .limit(limit);

  const total = await Content.countDocuments({ type });

  if (contents.length === 0) return ctx.answerCbQuery("Kontent yo'q");

  const buttons = contents.map(c => [
    {
      text: `${c.isActive ? '✅' : '❌'} ${c.title} [${c.uniqueId}]`,
      callback_data: `admin_content_${c.uniqueId}`
    }
  ]);

  const nav = [];
  if (page > 0) nav.push({ text: '⬅️', callback_data: `admin_list_${type}_${page - 1}` });
  if ((page + 1) * limit < total) nav.push({ text: '➡️', callback_data: `admin_list_${type}_${page + 1}` });
  if (nav.length) buttons.push(nav);

  await ctx.answerCbQuery();
  try {
    await ctx.editMessageText(`📋 ${type} ro'yxati (${total} ta):`, {
      reply_markup: { inline_keyboard: buttons }
    });
  } catch (e) {
    // Agar xabar o'zgarmagan bo'lsa chat qulashini oldini oladi
    if (!e.message.includes('message is not modified')) {
      await ctx.reply(`📋 ${type} ro'yxati (${total} ta):`, {
        reply_markup: { inline_keyboard: buttons }
      });
    }
  }
});

composer.action(/^admin_content_(.+)$/, async (ctx) => {
  if (!ctx.adminRole) return ctx.answerCbQuery('❌');
  const uniqueId = ctx.match[1];
  const content = await Content.findOne({ uniqueId });
  if (!content) return ctx.answerCbQuery('❌ Topilmadi');

  const link = getDeepLink(uniqueId);

  await ctx.answerCbQuery();
  try {
    await ctx.editMessageText(
      `📦 <b>${content.title}</b>\n\n` +
      `🆔 ID: <code>${uniqueId}</code>\n` +
      `🔗 Link: ${link}\n` +
      `👁 Ko'rishlar: ${content.viewCount}\n` +
      `📊 Status: ${content.isActive ? '✅ Aktiv' : '❌ Nofaol'}`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: content.isActive ? "🔴 O'chirish" : '🟢 Yoqish',
                callback_data: `toggle_${uniqueId}`
              },
              { text: '🗑 O\'chirish', callback_data: `del_${uniqueId}` }
            ],
            [{ text: '🔙 Orqaga', callback_data: `admin_list_${content.type}_0` }]
          ]
        }
      }
    );
  } catch (e) {}
});

composer.action(/^toggle_(.+)$/, async (ctx) => {
  if (!ctx.adminRole) return ctx.answerCbQuery('❌');
  const uniqueId = ctx.match[1];
  const content = await Content.findOne({ uniqueId });
  if (!content) return ctx.answerCbQuery('❌');

  content.isActive = !content.isActive;
  await content.save();

  const link = getDeepLink(uniqueId);
  await ctx.answerCbQuery(content.isActive ? '✅ Yoqildi' : '🔴 Nofaol');
  try {
    await ctx.editMessageText(
      `📦 <b>${content.title}</b>\n\n` +
      `🆔 ID: <code>${uniqueId}</code>\n` +
      `🔗 Link: ${link}\n` +
      `👁 Ko'rishlar: ${content.viewCount}\n` +
      `📊 Status: ${content.isActive ? '✅ Aktiv' : '❌ Nofaol'}`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: content.isActive ? "🔴 O'chirish" : '🟢 Yoqish',
                callback_data: `toggle_${uniqueId}`
              },
              { text: '🗑 O\'chirish', callback_data: `del_${uniqueId}` }
            ],
            [{ text: '🔙 Orqaga', callback_data: `admin_list_${content.type}_0` }]
          ]
        }
      }
    );
  } catch (e) {}
});

composer.action(/^del_(.+)$/, async (ctx) => {
  if (!ctx.adminRole) return ctx.answerCbQuery('❌');
  const uniqueId = ctx.match[1];
  await ctx.answerCbQuery();
  try {
    await ctx.editMessageText("⚠️ Haqiqatan ham o'chirmoqchimisiz?", {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '✅ Ha', callback_data: `confirm_del_${uniqueId}` },
            { text: "❌ Yo'q", callback_data: `admin_content_${uniqueId}` }
          ]
        ]
      }
    });
  } catch (e) {}
});

composer.action(/^confirm_del_(.+)$/, async (ctx) => {
  if (!ctx.adminRole) return ctx.answerCbQuery('❌');
  const uniqueId = ctx.match[1];
  const content = await Content.findOne({ uniqueId });

  if (content) {
    await Episode.deleteMany({ contentId: content._id });
    await Season.deleteMany({ contentId: content._id });
    await Content.deleteOne({ uniqueId });
  }

  await ctx.answerCbQuery("🗑 O'chirildi");
  try {
    await ctx.editMessageText("✅ Kontent o'chirildi.");
  } catch (e) {}
});

module.exports = composer;
