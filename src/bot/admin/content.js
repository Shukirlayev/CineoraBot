const { Composer } = require('telegraf');
const Content = require('../../models/Content');
const Season = require('../../models/Season');
const Episode = require('../../models/Episode');
const SearchRequest = require('../../models/SearchRequest');
const { generateUniqueId, getDeepLink } = require('../../utils/helpers');

const composer = new Composer();

// ─── Kontent kartochkasini ko'rsatish ───────────────────────────
async function showContentCard(ctx, content, useEdit = false) {
  const link = getDeepLink(content.uniqueId);
  const typeNames = { movie: '🎬 Kino', serial: '📺 Serial', anime: '🎌 Anime' };

  const text =
    `📦 <b>${content.title}</b>\n` +
    `━━━━━━━━━━━━━━━━\n` +
    `🆔 <code>${content.uniqueId}</code>\n` +
    `🏷 ${typeNames[content.type]}\n` +
    (content.searchTags?.length ? `🔍 ${content.searchTags.join(', ')}\n` : `🔍 Kalit so'zlar yo'q\n`) +
    (content.description ? `📝 ${content.description}\n` : '') +
    (content.year ? `📅 ${content.year}\n` : '') +
    `👁 Ko'rishlar: ${content.viewCount}\n` +
    `📊 ${content.isActive ? '✅ Aktiv' : '❌ Nofaol'}\n` +
    `🔗 ${link}`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: '✏️ Nom', callback_data: `ef_${content.uniqueId}_title` },
        { text: '🔍 Kalit so\'zlar', callback_data: `ef_${content.uniqueId}_tags` }
      ],
      [
        { text: '📝 Tavsif', callback_data: `ef_${content.uniqueId}_desc` },
        { text: '📅 Yil', callback_data: `ef_${content.uniqueId}_year` }
      ],
      [
        {
          text: content.isActive ? '🔴 Nofaol qilish' : '🟢 Faol qilish',
          callback_data: `toggle_${content.uniqueId}`
        },
        { text: "🗑 O'chirish", callback_data: `del_${content.uniqueId}` }
      ],
      [{ text: "🔙 Ro'yxatga qaytish", callback_data: `admin_list_${content.type}_0` }]
    ]
  };

  const opts = { parse_mode: 'HTML', reply_markup: keyboard };
  if (useEdit) {
    try { await ctx.editMessageText(text, opts); } catch (e) { await ctx.reply(text, opts); }
  } else {
    await ctx.reply(text, opts);
  }
}

// ─── Kontent qo'shish ────────────────────────────────────────────
composer.hears("➕ Kontent qo'shish", async (ctx) => {
  if (!ctx.adminRole) return;
  ctx.session.adminState = { step: 'select_type' };
  await ctx.reply('📦 Kontent turini tanlang:', {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '🎬 Kino', callback_data: 'add_type_movie' },
          { text: '📺 Serial', callback_data: 'add_type_serial' }
        ],
        [{ text: '🎌 Anime', callback_data: 'add_type_anime' }],
        [{ text: '❌ Bekor', callback_data: 'add_cancel' }]
      ]
    }
  });
});

composer.action(/^add_type_(movie|serial|anime)$/, async (ctx) => {
  if (!ctx.adminRole) return ctx.answerCbQuery("❌ Ruxsat yo'q");
  const type = ctx.match[1];
  const names = { movie: '🎬 Kino', serial: '📺 Serial', anime: '🎌 Anime' };
  ctx.session.adminState = { step: 'enter_title', contentData: { type } };
  await ctx.answerCbQuery();
  try { await ctx.editMessageText(`✅ Tur: ${names[type]}\n\n📝 Kontent nomini yozing (inglizcha):`); } catch (e) {}
});

composer.action('add_cancel', async (ctx) => {
  ctx.session.adminState = null;
  await ctx.answerCbQuery();
  try { await ctx.editMessageText('❌ Bekor qilindi.'); } catch (e) {}
});

// ─── Matn handleri ───────────────────────────────────────────────
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

    // ── Yangi kontent qo'shish steplari
    case 'enter_title': {
      state.contentData.title = text;
      state.step = 'enter_tags';
      await ctx.reply(
        '🔍 Qidiruv kalit so\'zlarini yozing (vergul bilan):\n\n' +
        'Misol: <code>Inception, muqaddima, insepton</code>',
        { parse_mode: 'HTML' }
      );
      break;
    }

    case 'enter_tags': {
      const tags = text.split(',').map(t => t.trim().toLowerCase()).filter(t => t.length > 0);
      state.contentData.searchTags = tags;

      if (state.contentData.type === 'movie') {
        state.step = 'send_file';
        await ctx.reply('🎥 Video yuboring:');
      } else {
        state.step = 'enter_season_number';
        await ctx.reply('📁 Fasl raqami:');
      }
      break;
    }

    case 'enter_season_number': {
      const n = parseInt(text);
      if (isNaN(n)) return ctx.reply('❌ Raqam kiriting:');
      state.contentData.seasonNumber = n;
      state.step = 'enter_episode_number';
      await ctx.reply(`📺 ${n}-Fasl, qism raqami:`);
      break;
    }

    case 'enter_episode_number': {
      const n = parseInt(text);
      if (isNaN(n)) return ctx.reply('❌ Raqam kiriting:');
      state.contentData.episodeNumber = n;
      state.step = 'send_file';
      await ctx.reply(`🎥 ${state.contentData.seasonNumber}-Fasl, ${n}-Qism uchun video yuboring:`);
      break;
    }

    // ── Tahrirlash steplari
    case 'edit_title': {
      await Content.findByIdAndUpdate(state.editId, { title: text });
      const updated = await Content.findById(state.editId);
      ctx.session.adminState = null;
      await ctx.reply(`✅ Nom yangilandi: <b>${text}</b>`, { parse_mode: 'HTML' });
      await showContentCard(ctx, updated);
      break;
    }

    case 'edit_tags': {
      const tags = text.split(',').map(t => t.trim().toLowerCase()).filter(t => t.length > 0);
      await Content.findByIdAndUpdate(state.editId, { searchTags: tags });
      const updated = await Content.findById(state.editId);
      ctx.session.adminState = null;
      await ctx.reply(`✅ Kalit so'zlar yangilandi!`);
      await showContentCard(ctx, updated);
      break;
    }

    case 'edit_desc': {
      const desc = text === '/skip' ? '' : text;
      await Content.findByIdAndUpdate(state.editId, { description: desc });
      const updated = await Content.findById(state.editId);
      ctx.session.adminState = null;
      await ctx.reply('✅ Tavsif yangilandi!');
      await showContentCard(ctx, updated);
      break;
    }

    case 'edit_year': {
      const y = parseInt(text);
      if (isNaN(y)) return ctx.reply('❌ Raqam kiriting (masalan: 2024):');
      await Content.findByIdAndUpdate(state.editId, { year: y });
      const updated = await Content.findById(state.editId);
      ctx.session.adminState = null;
      await ctx.reply(`✅ Yil yangilandi: <b>${y}</b>`, { parse_mode: 'HTML' });
      await showContentCard(ctx, updated);
      break;
    }

    default:
      return next();
  }
});

// ─── Video / Document handleri ──────────────────────────────────
composer.on(['video', 'document'], async (ctx, next) => {
  if (!ctx.adminRole) return next();
  const state = ctx.session?.adminState;
  if (!state || state.step !== 'send_file') return next();

  const fileId = ctx.message.video?.file_id || ctx.message.document?.file_id;
  if (!fileId) return next();

  const data = state.contentData;

  if (data.type === 'movie') {
    let uniqueId, existing;
    do { uniqueId = generateUniqueId(); existing = await Content.findOne({ uniqueId }); } while (existing);

    const content = await Content.create({
      uniqueId, title: data.title, type: data.type,
      searchTags: data.searchTags || [], fileId, createdBy: ctx.from.id
    });

    ctx.session.adminState = null;
    const link = getDeepLink(uniqueId);
    await ctx.reply(
      `✅ <b>${data.title}</b> saqlandi!\n\n🆔 <code>${uniqueId}</code>\n🔗 ${link}`,
      { parse_mode: 'HTML' }
    );

    // Kutgan foydalanuvchilarga xabar
    await notifyPendingSearches(ctx, content);

  } else {
    // Serial / Anime
    let content = await Content.findOne({ title: data.title, type: data.type });

    if (!content) {
      let uniqueId, existing;
      do { uniqueId = generateUniqueId(); existing = await Content.findOne({ uniqueId }); } while (existing);
      content = await Content.create({
        uniqueId, title: data.title, type: data.type,
        searchTags: data.searchTags || [], createdBy: ctx.from.id
      });
      await notifyPendingSearches(ctx, content);
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
      contentId: content._id, seasonId: season._id,
      episodeNumber: data.episodeNumber, fileId
    });

    const link = getDeepLink(content.uniqueId);
    ctx.session.adminState = {
      step: 'ask_more',
      contentData: { ...data, contentId: content._id, seasonId: season._id }
    };

    await ctx.reply(
      `✅ ${data.seasonNumber}-Fasl, ${data.episodeNumber}-Qism saqlandi!\n🔗 ${link}\n\nDavom etasizmi?`,
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

// Kutgan userlarga xabar yuborish
async function notifyPendingSearches(ctx, content) {
  try {
    const keywords = [
      content.title.toLowerCase(),
      ...(content.searchTags || []).map(t => t.toLowerCase().trim())
    ];
    const pending = await SearchRequest.find({ notified: false });

    for (const req of pending) {
      const query = req.query.toLowerCase().trim();
      const matches = keywords.some(k => k.includes(query) || query.includes(k));
      if (matches) {
        try {
          const typeEmoji = { movie: '🎬', serial: '📺', anime: '🎌' };
          await ctx.telegram.sendMessage(
            req.userId,
            `🎉 Siz qidirgan "<b>${req.query}</b>" botga qo'shildi!\n\n${typeEmoji[content.type]} <b>${content.title}</b>`,
            { parse_mode: 'HTML' }
          );
          await SearchRequest.findByIdAndUpdate(req._id, { notified: true });
        } catch (e) {}
      }
    }
  } catch (e) {
    console.error('notifyPendingSearches xatosi:', e.message);
  }
}

// ─── Episode davomi ──────────────────────────────────────────────
composer.action('ep_next', async (ctx) => {
  if (!ctx.adminRole) return;
  const state = ctx.session?.adminState;
  if (!state) return;
  state.contentData.episodeNumber += 1;
  state.step = 'send_file';
  await ctx.answerCbQuery();
  await ctx.reply(`🎥 ${state.contentData.seasonNumber}-Fasl, ${state.contentData.episodeNumber}-Qism uchun video yuboring:`);
});

composer.action('ep_new_season', async (ctx) => {
  if (!ctx.adminRole) return;
  const state = ctx.session?.adminState;
  if (!state) return;
  state.contentData.seasonNumber += 1;
  state.contentData.episodeNumber = 1;
  state.step = 'send_file';
  await ctx.answerCbQuery();
  await ctx.reply(`🎥 ${state.contentData.seasonNumber}-Fasl, 1-Qism uchun video yuboring:`);
});

composer.action('ep_done', async (ctx) => {
  if (!ctx.adminRole) return;
  ctx.session.adminState = null;
  await ctx.answerCbQuery();
  await ctx.reply('✅ Kontent yuklash yakunlandi!');
});

// ─── Kontentlar ro'yxati ─────────────────────────────────────────
composer.hears('📋 Kontentlar', async (ctx) => {
  if (!ctx.adminRole) return;
  await ctx.reply('📋 Turni tanlang:', {
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

  const contents = await Content.find({ type }).sort({ title: 1 }).skip(page * limit).limit(limit);
  const total = await Content.countDocuments({ type });

  if (contents.length === 0) return ctx.answerCbQuery("Kontent yo'q");

  const buttons = contents.map(c => [{
    text: `${c.isActive ? '✅' : '❌'} ${c.title}`,
    callback_data: `admin_content_${c.uniqueId}`
  }]);

  const nav = [];
  if (page > 0) nav.push({ text: '⬅️', callback_data: `admin_list_${type}_${page - 1}` });
  if ((page + 1) * limit < total) nav.push({ text: '➡️', callback_data: `admin_list_${type}_${page + 1}` });
  if (nav.length) buttons.push(nav);

  const totalPages = Math.ceil(total / limit);
  await ctx.answerCbQuery();
  try {
    await ctx.editMessageText(`📋 ${page + 1}/${totalPages} sahifa (${total} ta):`, {
      reply_markup: { inline_keyboard: buttons }
    });
  } catch (e) {
    await ctx.reply(`📋 ${page + 1}/${totalPages} sahifa (${total} ta):`, {
      reply_markup: { inline_keyboard: buttons }
    });
  }
});

// ─── Kontent kartochkasi ─────────────────────────────────────────
composer.action(/^admin_content_(.+)$/, async (ctx) => {
  if (!ctx.adminRole) return ctx.answerCbQuery('❌');
  const content = await Content.findOne({ uniqueId: ctx.match[1] });
  if (!content) return ctx.answerCbQuery('❌ Topilmadi');
  await ctx.answerCbQuery();
  await showContentCard(ctx, content, true);
});

// ─── Maydon tahrirlash ───────────────────────────────────────────
composer.action(/^ef_([A-Z0-9]+)_(title|tags|desc|year)$/, async (ctx) => {
  if (!ctx.adminRole) return ctx.answerCbQuery('❌');
  const uniqueId = ctx.match[1];
  const field = ctx.match[2];
  const content = await Content.findOne({ uniqueId });
  if (!content) return ctx.answerCbQuery('❌ Topilmadi');

  const prompts = {
    title: `✏️ Yangi nomni yozing:\n\nHozirgi: <b>${content.title}</b>`,
    tags: `🔍 Yangi kalit so'zlarni yozing (vergul bilan):\n\nHozirgi: <code>${content.searchTags?.join(', ') || 'yo\'q'}</code>`,
    desc: `📝 Yangi tavsifni yozing (o'chirish uchun /skip):\n\nHozirgi: ${content.description || 'yo\'q'}`,
    year: `📅 Yangi yilni yozing:\n\nHozirgi: ${content.year || "yo'q"}`
  };

  ctx.session.adminState = { step: `edit_${field}`, editId: content._id };
  await ctx.answerCbQuery();
  try { await ctx.editMessageText(prompts[field], { parse_mode: 'HTML' }); } catch (e) {}
});

// ─── Toggle / O'chirish ──────────────────────────────────────────
composer.action(/^toggle_([A-Z0-9]+)$/, async (ctx) => {
  if (!ctx.adminRole) return ctx.answerCbQuery('❌');
  const content = await Content.findOne({ uniqueId: ctx.match[1] });
  if (!content) return ctx.answerCbQuery('❌');
  content.isActive = !content.isActive;
  await content.save();
  await ctx.answerCbQuery(content.isActive ? '✅ Yoqildi' : '🔴 Nofaol qilindi');
  await showContentCard(ctx, content, true);
});

composer.action(/^del_([A-Z0-9]+)$/, async (ctx) => {
  if (!ctx.adminRole) return ctx.answerCbQuery('❌');
  await ctx.answerCbQuery();
  try {
    await ctx.editMessageText("⚠️ Haqiqatan ham o'chirmoqchimisiz?", {
      reply_markup: {
        inline_keyboard: [[
          { text: '✅ Ha', callback_data: `confirm_del_${ctx.match[1]}` },
          { text: "❌ Yo'q", callback_data: `admin_content_${ctx.match[1]}` }
        ]]
      }
    });
  } catch (e) {}
});

composer.action(/^confirm_del_([A-Z0-9]+)$/, async (ctx) => {
  if (!ctx.adminRole) return ctx.answerCbQuery('❌');
  const content = await Content.findOne({ uniqueId: ctx.match[1] });
  if (content) {
    await Episode.deleteMany({ contentId: content._id });
    await Season.deleteMany({ contentId: content._id });
    await Content.deleteOne({ uniqueId: ctx.match[1] });
  }
  await ctx.answerCbQuery("🗑 O'chirildi");
  try { await ctx.editMessageText("✅ Kontent o'chirildi."); } catch (e) {}
});

module.exports = composer;
