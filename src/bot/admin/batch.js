const { Composer } = require('telegraf');
const Content = require('../../models/Content');
const Season = require('../../models/Season');
const Episode = require('../../models/Episode');
const { generateUniqueId, getDeepLink } = require('../../utils/helpers');

const composer = new Composer();

// Media group larni buffer qilish uchun
const mediaGroupBuffer = new Map(); // groupId → { adminId, timer, fileIds[] }

// ── /batch command ────────────────────────────────────────────────
composer.command('batch', async (ctx) => {
  if (!ctx.adminRole) return;

  const arg = ctx.message.text.split(' ')[1]?.toLowerCase();
  const validTypes = { movie: '🎬 Kino', serial: '📺 Serial', anime: '🎌 Anime' };

  if (!arg || !validTypes[arg]) {
    return ctx.reply(
      '📦 Foydalanish:\n\n' +
      '/batch movie — kinolar\n' +
      '/batch serial — seriallar\n' +
      '/batch anime — animlar'
    );
  }

  if (arg === 'serial' || arg === 'anime') {
    ctx.session.batchState = { type: arg, step: 'enter_serial_name', videos: [] };
    return ctx.reply(
      `${validTypes[arg]} nomi (inglizcha):`,
      { reply_markup: { inline_keyboard: [[{ text: '❌ Bekor', callback_data: 'batch_cancel' }]] } }
    );
  }

  ctx.session.batchState = { type: arg, step: 'collecting', videos: [] };

  await ctx.reply(
    `✅ ${validTypes[arg]} batch rejimi yoqildi!\n\n` +
    `🎥 Videolarni yuboring — hammasini birdan tanlang va yuboring\n\n` +
    `Tugatgach "✅ Tugatdim" bosing:`,
    {
      reply_markup: {
        inline_keyboard: [[
          { text: '✅ Tugatdim', callback_data: 'batch_done' },
          { text: '❌ Bekor', callback_data: 'batch_cancel' }
        ]]
      }
    }
  );
});

// ── Video qabul qilish (media group + oddiy) ──────────────────────
composer.on(['video', 'document'], async (ctx, next) => {
  if (!ctx.adminRole) return next();
  const state = ctx.session?.batchState;
  if (!state || state.step !== 'collecting') return next();

  const fileId = ctx.message.video?.file_id || ctx.message.document?.file_id;
  if (!fileId) return next();

  const mediaGroupId = ctx.message.media_group_id;

  if (mediaGroupId) {
    // Media group — buffer ga qo'shish
    if (!mediaGroupBuffer.has(mediaGroupId)) {
      mediaGroupBuffer.set(mediaGroupId, {
        userId: ctx.from.id,
        chatId: ctx.chat.id,
        fileIds: [],
        timer: null
      });
    }

    const group = mediaGroupBuffer.get(mediaGroupId);
    group.fileIds.push(fileId);

    // Avvalgi timerni bekor qilish
    if (group.timer) clearTimeout(group.timer);

    // 2 soniya kutib, guruhni yopish
    group.timer = setTimeout(async () => {
      const g = mediaGroupBuffer.get(mediaGroupId);
      if (!g) return;
      mediaGroupBuffer.delete(mediaGroupId);

      // Sessionni yangilash
      const currentState = ctx.session?.batchState;
      if (!currentState || currentState.step !== 'collecting') return;

      for (const fid of g.fileIds) {
        currentState.videos.push({ fileId: fid, title: null, searchTags: null });
      }

      // Xabar yuborish va 5s da o'chirish
      const count = currentState.videos.length;
      try {
        const sent = await ctx.telegram.sendMessage(
          g.chatId,
          `✅ ${g.fileIds.length} ta qabul qilindi (jami: ${count} ta)`
        );
        setTimeout(async () => {
          try { await ctx.telegram.deleteMessage(g.chatId, sent.message_id); } catch (e) {}
        }, 5000);
      } catch (e) {}

    }, 2000);

  } else {
    // Oddiy bitta video
    state.videos.push({ fileId, title: null, searchTags: null });
    const count = state.videos.length;

    // 5s da o'chib ketadigan xabar
    try {
      const sent = await ctx.reply(`✅ ${count} ta video qabul qilindi`);
      setTimeout(async () => {
        try { await ctx.telegram.deleteMessage(ctx.chat.id, sent.message_id); } catch (e) {}
      }, 5000);
    } catch (e) {}
  }
});

// ── Matn handleri ─────────────────────────────────────────────────
composer.on('text', async (ctx, next) => {
  if (!ctx.adminRole) return next();
  const state = ctx.session?.batchState;
  if (!state) return next();

  const text = ctx.message.text.trim();

  switch (state.step) {

    case 'enter_serial_name': {
      state.serialTitle = text;
      state.step = 'enter_season_number';
      await ctx.reply(
        `📁 "${text}" — fasl raqami:`,
        { reply_markup: { inline_keyboard: [[{ text: '❌ Bekor', callback_data: 'batch_cancel' }]] } }
      );
      break;
    }

    case 'enter_season_number': {
      const n = parseInt(text);
      if (isNaN(n)) return ctx.reply('❌ Raqam kiriting:');
      state.seasonNumber = n;
      state.step = 'collecting';
      await ctx.reply(
        `✅ "${state.serialTitle}" — ${n}-Fasl\n\n` +
        `🎥 Qismlarni tartib bilan yuboring:\n` +
        `Tugatgach "✅ Tugatdim" bosing:`,
        {
          reply_markup: {
            inline_keyboard: [[
              { text: '✅ Tugatdim', callback_data: 'batch_done' },
              { text: '❌ Bekor', callback_data: 'batch_cancel' }
            ]]
          }
        }
      );
      break;
    }

    case 'naming_title': {
      state.videos[state.currentIndex].title = text;
      state.step = 'naming_tags';
      await ctx.reply(
        `🔍 Kalit so'zlar (vergul bilan):\n\n` +
        `Misol: <code>Normal, normal film, 2025</code>`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [[{ text: '⏭ O\'tkazib yuborish', callback_data: 'batch_skip_tags' }]]
          }
        }
      );
      break;
    }

    case 'naming_tags': {
      const tags = text.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
      state.videos[state.currentIndex].searchTags = tags;
      await goNextVideo(ctx, state);
      break;
    }

    default:
      return next();
  }
});

// ── Kalit so'zlarni o'tkazib yuborish ────────────────────────────
composer.action('batch_skip_tags', async (ctx) => {
  if (!ctx.adminRole) return ctx.answerCbQuery('❌');
  const state = ctx.session?.batchState;
  if (!state) return ctx.answerCbQuery('❌');

  state.videos[state.currentIndex].searchTags = [];
  await ctx.answerCbQuery('⏭ O\'tkazildi');
  try { await ctx.deleteMessage(); } catch (e) {}
  await goNextVideo(ctx, state);
});

// ── Video o'tkazib yuborish ───────────────────────────────────────
composer.action('batch_skip', async (ctx) => {
  if (!ctx.adminRole) return ctx.answerCbQuery('❌');
  const state = ctx.session?.batchState;
  if (!state) return ctx.answerCbQuery('❌');

  state.videos.splice(state.currentIndex, 1);
  await ctx.answerCbQuery('⏭ Video o\'tkazildi');
  try { await ctx.deleteMessage(); } catch (e) {}

  if (state.videos.length === 0) {
    ctx.session.batchState = null;
    return ctx.reply('❌ Barcha videolar o\'tkazildi.');
  }

  if (state.currentIndex >= state.videos.length) {
    await saveAllBatch(ctx);
  } else {
    state.step = 'naming_title';
    await ctx.reply(
      `📝 ${state.currentIndex + 1}/${state.videos.length} — Nom:`,
      { reply_markup: { inline_keyboard: [[{ text: '⏭ Bu videoni o\'tkazish', callback_data: 'batch_skip' }]] } }
    );
  }
});

// ── Keyingi videoga o'tish ────────────────────────────────────────
async function goNextVideo(ctx, state) {
  state.currentIndex++;

  if (state.currentIndex < state.videos.length) {
    state.step = 'naming_title';
    const remaining = state.videos.length - state.currentIndex;
    await ctx.reply(
      `✅ Saqlandi! (${remaining} ta qoldi)\n\n` +
      `📝 ${state.currentIndex + 1}/${state.videos.length} — Nom:`,
      {
        reply_markup: {
          inline_keyboard: [[{ text: '⏭ Bu videoni o\'tkazish', callback_data: 'batch_skip' }]]
        }
      }
    );
  } else {
    await saveAllBatch(ctx);
  }
}

// ── Tugatdim ──────────────────────────────────────────────────────
composer.action('batch_done', async (ctx) => {
  if (!ctx.adminRole) return ctx.answerCbQuery('❌');
  const state = ctx.session?.batchState;

  if (!state) return ctx.answerCbQuery('❌ Batch topilmadi', { show_alert: true });

  if (state.videos.length === 0) {
    return ctx.answerCbQuery('❌ Hech qanday video qabul qilinmadi! Biroz kuting...', { show_alert: true });
  }

  await ctx.answerCbQuery(`✅ ${state.videos.length} ta video qabul qilindi!`);
  try { await ctx.deleteMessage(); } catch (e) {}

  if (state.type === 'movie') {
    state.step = 'naming_title';
    state.currentIndex = 0;

    await ctx.reply(
      `📦 ${state.videos.length} ta video qabul qilindi!\n\n` +
      `📝 Endi har biriga nom berasiz:\n\n` +
      `1/${state.videos.length} — Nomini yozing:`,
      {
        reply_markup: {
          inline_keyboard: [[{ text: '⏭ Bu videoni o\'tkazish', callback_data: 'batch_skip' }]]
        }
      }
    );
  } else {
    await saveSerialBatch(ctx);
  }
});

// ── Bekor qilish ──────────────────────────────────────────────────
composer.action('batch_cancel', async (ctx) => {
  if (!ctx.adminRole) return ctx.answerCbQuery('❌');
  ctx.session.batchState = null;
  await ctx.answerCbQuery('❌ Bekor qilindi');
  try { await ctx.editMessageText('❌ Batch rejimi bekor qilindi.'); } catch (e) {}
});

composer.command('cancel', async (ctx) => {
  if (!ctx.adminRole) return;
  ctx.session.batchState = null;
  ctx.session.adminState = null;
  await ctx.reply('❌ Bekor qilindi.');
});

// ── Kinolarni saqlash ─────────────────────────────────────────────
async function saveAllBatch(ctx) {
  const state = ctx.session.batchState;
  const saved = [];

  for (const video of state.videos) {
    if (!video.title) continue;

    try {
      let uniqueId, existing;
      do {
        uniqueId = generateUniqueId();
        existing = await Content.findOne({ uniqueId });
      } while (existing);

      await Content.create({
        uniqueId,
        title: video.title,
        type: state.type,
        searchTags: video.searchTags || [],
        fileId: video.fileId,
        createdBy: ctx.from.id
      });

      saved.push({ title: video.title, uniqueId });
    } catch (e) {
      console.error('Batch saqlash xatosi:', e.message);
    }
  }

  ctx.session.batchState = null;

  if (saved.length === 0) {
    return ctx.reply('❌ Hech narsa saqlanmadi.');
  }

  // Linklar ro'yxatini yuborish (uzun bo'lsa bo'lib yuborish)
  const lines = saved.map((c, i) => {
    return `${i + 1}. 🎬 <b>${c.title}</b>\n${getDeepLink(c.uniqueId)}`;
  });

  const header = `✅ <b>Batch yakunlandi! ${saved.length} ta saqlandi</b>\n━━━━━━━━━━━━━━━━\n\n`;
  let chunk = header;

  for (const line of lines) {
    if ((chunk + line + '\n\n').length > 4000) {
      await ctx.reply(chunk, { parse_mode: 'HTML', disable_web_page_preview: true });
      chunk = line + '\n\n';
    } else {
      chunk += line + '\n\n';
    }
  }

  if (chunk) {
    await ctx.reply(chunk, { parse_mode: 'HTML', disable_web_page_preview: true });
  }
}

// ── Serial/Anime qismlarini saqlash ──────────────────────────────
async function saveSerialBatch(ctx) {
  const state = ctx.session.batchState;

  let content = await Content.findOne({ title: state.serialTitle, type: state.type });

  if (!content) {
    let uniqueId, existing;
    do {
      uniqueId = generateUniqueId();
      existing = await Content.findOne({ uniqueId });
    } while (existing);

    content = await Content.create({
      uniqueId,
      title: state.serialTitle,
      type: state.type,
      searchTags: [],
      createdBy: ctx.from.id
    });
  }

  let season = await Season.findOne({ contentId: content._id, seasonNumber: state.seasonNumber });
  if (!season) {
    season = await Season.create({
      contentId: content._id,
      seasonNumber: state.seasonNumber,
      title: `${state.seasonNumber}-Fasl`
    });
  }

  const existingEpCount = await Episode.countDocuments({ seasonId: season._id });
  let savedCount = 0;

  for (let i = 0; i < state.videos.length; i++) {
    try {
      await Episode.create({
        contentId: content._id,
        seasonId: season._id,
        episodeNumber: existingEpCount + i + 1,
        fileId: state.videos[i].fileId
      });
      savedCount++;
    } catch (e) {}
  }

  ctx.session.batchState = null;
  const link = getDeepLink(content.uniqueId);
  const typeEmoji = { serial: '📺', anime: '🎌' };

  await ctx.reply(
    `✅ <b>Batch yakunlandi!</b>\n` +
    `━━━━━━━━━━━━━━━━\n\n` +
    `${typeEmoji[content.type]} <b>${state.serialTitle}</b>\n` +
    `📁 ${state.seasonNumber}-Fasl\n` +
    `📺 ${savedCount} ta qism (${existingEpCount + 1}—${existingEpCount + savedCount})\n\n` +
    `🔗 ${link}`,
    { parse_mode: 'HTML', disable_web_page_preview: true }
  );
}

module.exports = composer;
