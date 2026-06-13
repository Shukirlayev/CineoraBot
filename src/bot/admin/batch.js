const { Composer } = require('telegraf');
const Content = require('../../models/Content');
const Season = require('../../models/Season');
const Episode = require('../../models/Episode');
const { generateUniqueId, getDeepLink } = require('../../utils/helpers');

const composer = new Composer();

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

  // Serial/Anime uchun avval nom va fasl so'rash
  if (arg === 'serial' || arg === 'anime') {
    ctx.session.batchState = {
      type: arg,
      step: 'enter_serial_name',
      videos: []
    };
    return ctx.reply(
      `${validTypes[arg]} nomi (inglizcha):`,
      {
        reply_markup: {
          inline_keyboard: [[
            { text: '❌ Bekor', callback_data: 'batch_cancel' }
          ]]
        }
      }
    );
  }

  // Kino uchun to'g'ridan video qabul qilish
  ctx.session.batchState = {
    type: arg,
    step: 'collecting',
    videos: []
  };

  await ctx.reply(
    `✅ ${validTypes[arg]} batch rejimi yoqildi!\n\n` +
    `🎥 Videolarni yuboring (xohlagancha)\n` +
    `Tugatgach "✅ Tugatdim" tugmasini bosing:`,
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

// ── Matn handleri (serial nomi, fasl raqami, nom, kalit so'zlar) ──
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
        {
          reply_markup: {
            inline_keyboard: [[
              { text: '❌ Bekor', callback_data: 'batch_cancel' }
            ]]
          }
        }
      );
      break;
    }

    case 'enter_season_number': {
      const n = parseInt(text);
      if (isNaN(n)) return ctx.reply('❌ Raqam kiriting:');
      state.seasonNumber = n;
      state.step = 'collecting';
      await ctx.reply(
        `✅ ${state.type === 'anime' ? '🎌' : '📺'} "${state.serialTitle}" — ${n}-Fasl\n\n` +
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
        `🔍 Kalit so'zlar (vergul bilan):\n\nMisol: <code>Fight Club, jang klubi, fayt klab</code>`,
        { parse_mode: 'HTML' }
      );
      break;
    }

    case 'naming_tags': {
      const tags = text.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
      state.videos[state.currentIndex].searchTags = tags;

      // Keyingi videoga o'tish
      state.currentIndex++;

      if (state.currentIndex < state.videos.length) {
        state.step = 'naming_title';
        const remaining = state.videos.length - state.currentIndex;
        await ctx.reply(
          `✅ Saqlandi! (${remaining} ta qoldi)\n\n` +
          `📝 ${state.currentIndex + 1}/${state.videos.length} — Nom:`,
          {
            reply_markup: {
              inline_keyboard: [[
                { text: '⏭ Bu videoni o\'tkazib yuborish', callback_data: 'batch_skip' }
              ]]
            }
          }
        );
      } else {
        // Hammasi nomlandi — saqlash
        await saveAllBatch(ctx);
      }
      break;
    }

    default:
      return next();
  }
});

// ── Video qabul qilish ────────────────────────────────────────────
composer.on(['video', 'document'], async (ctx, next) => {
  if (!ctx.adminRole) return next();
  const state = ctx.session?.batchState;
  if (!state || state.step !== 'collecting') return next();

  const fileId = ctx.message.video?.file_id || ctx.message.document?.file_id;
  if (!fileId) return next();

  state.videos.push({ fileId, title: null, searchTags: null });

  // Har 5 ta videoda eslatma
  if (state.videos.length % 5 === 0) {
    await ctx.reply(
      `📦 ${state.videos.length} ta video qabul qilindi. Davom eting yoki "✅ Tugatdim" bosing.`,
      {
        reply_markup: {
          inline_keyboard: [[
            { text: '✅ Tugatdim', callback_data: 'batch_done' },
            { text: '❌ Bekor', callback_data: 'batch_cancel' }
          ]]
        }
      }
    );
  } else {
    // Oddiy tasdiqlash (reaction kabi)
    try {
      await ctx.telegram.sendMessage(ctx.chat.id, `✅ ${state.videos.length} ta`, {
        reply_to_message_id: ctx.message.message_id
      });
    } catch (e) {}
  }
});

// ── Tugatdim ──────────────────────────────────────────────────────
composer.action('batch_done', async (ctx) => {
  if (!ctx.adminRole) return ctx.answerCbQuery('❌');
  const state = ctx.session?.batchState;

  if (!state || state.videos.length === 0) {
    return ctx.answerCbQuery('❌ Hech qanday video yuborilmadi!', { show_alert: true });
  }

  await ctx.answerCbQuery();

  if (state.type === 'movie') {
    // Kinolar uchun nom berish bosqichi
    state.step = 'naming_title';
    state.currentIndex = 0;

    try { await ctx.deleteMessage(); } catch (e) {}

    await ctx.reply(
      `📦 ${state.videos.length} ta video qabul qilindi!\n\n` +
      `📝 Endi har biriga nom berasiz:\n\n` +
      `1/${state.videos.length} — Nomini yozing:`,
      {
        reply_markup: {
          inline_keyboard: [[
            { text: '⏭ Bu videoni o\'tkazib yuborish', callback_data: 'batch_skip' }
          ]]
        }
      }
    );
  } else {
    // Serial/Anime — qismlar avtomatik raqamlanadi
    state.step = 'saving_serial';
    await ctx.answerCbQuery?.();
    try { await ctx.deleteMessage(); } catch (e) {}
    await saveSerialBatch(ctx);
  }
});

// ── Skip (o'tkazib yuborish) ──────────────────────────────────────
composer.action('batch_skip', async (ctx) => {
  if (!ctx.adminRole) return ctx.answerCbQuery('❌');
  const state = ctx.session?.batchState;
  if (!state) return ctx.answerCbQuery('❌');

  // Skip qilingan videoni o'chirish
  state.videos.splice(state.currentIndex, 1);

  if (state.currentIndex >= state.videos.length) {
    // Hamma nomlandi
    await ctx.answerCbQuery('⏭ O\'tkazib yuborildi');
    await saveAllBatch(ctx);
    return;
  }

  state.step = 'naming_title';
  await ctx.answerCbQuery('⏭ O\'tkazib yuborildi');
  await ctx.reply(
    `📝 ${state.currentIndex + 1}/${state.videos.length} — Nom:`
  );
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
  const hadBatch = !!ctx.session?.batchState;
  ctx.session.batchState = null;
  ctx.session.adminState = null;
  await ctx.reply(hadBatch ? '❌ Batch rejimi bekor qilindi.' : '❌ Bekor qilindi.');
});

// ── Kinolarni saqlash ─────────────────────────────────────────────
async function saveAllBatch(ctx) {
  const state = ctx.session.batchState;
  const saved = [];
  const skipped = [];

  for (const video of state.videos) {
    if (!video.title) {
      skipped.push(video);
      continue;
    }

    try {
      let uniqueId, existing;
      do {
        uniqueId = generateUniqueId();
        existing = await Content.findOne({ uniqueId });
      } while (existing);

      const content = await Content.create({
        uniqueId,
        title: video.title,
        type: state.type,
        searchTags: video.searchTags || [],
        fileId: video.fileId,
        createdBy: ctx.from.id
      });

      saved.push({ title: video.title, uniqueId: content.uniqueId });
    } catch (e) {
      console.error('Batch saqlash xatosi:', e.message);
    }
  }

  ctx.session.batchState = null;

  // Natija
  let resultText = `✅ <b>Batch yakunlandi!</b>\n`;
  resultText += `━━━━━━━━━━━━━━━━\n\n`;
  resultText += `✅ Saqlandi: ${saved.length} ta\n`;
  if (skipped.length > 0) resultText += `⏭ O'tkazildi: ${skipped.length} ta\n`;
  resultText += `\n🔗 <b>Linklar:</b>\n\n`;

  saved.forEach((c, i) => {
    const link = getDeepLink(c.uniqueId);
    resultText += `${i + 1}. 🎬 <b>${c.title}</b>\n${link}\n\n`;
  });

  // Xabar uzun bo'lsa bo'lib yuborish
  if (resultText.length > 4000) {
    const chunks = [];
    let chunk = `✅ <b>Batch yakunlandi!</b> ${saved.length} ta saqlandi.\n\n🔗 <b>Linklar:</b>\n\n`;

    saved.forEach((c, i) => {
      const line = `${i + 1}. 🎬 <b>${c.title}</b>\n${getDeepLink(c.uniqueId)}\n\n`;
      if ((chunk + line).length > 4000) {
        chunks.push(chunk);
        chunk = line;
      } else {
        chunk += line;
      }
    });
    if (chunk) chunks.push(chunk);

    for (const ch of chunks) {
      await ctx.reply(ch, {
        parse_mode: 'HTML',
        disable_web_page_preview: true
      });
    }
  } else {
    await ctx.reply(resultText, {
      parse_mode: 'HTML',
      disable_web_page_preview: true
    });
  }
}

// ── Serial/Anime qismlarini saqlash ──────────────────────────────
async function saveSerialBatch(ctx) {
  const state = ctx.session.batchState;

  // Mavjud contentni topish yoki yangi yaratish
  let content = await Content.findOne({
    title: state.serialTitle,
    type: state.type
  });

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

  // Fasl
  let season = await Season.findOne({
    contentId: content._id,
    seasonNumber: state.seasonNumber
  });

  if (!season) {
    season = await Season.create({
      contentId: content._id,
      seasonNumber: state.seasonNumber,
      title: `${state.seasonNumber}-Fasl`
    });
  }

  // Mavjud qismlar sonini topish
  const existingEpCount = await Episode.countDocuments({ seasonId: season._id });

  // Qismlarni saqlash
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
    } catch (e) {
      console.error('Episode saqlash xatosi:', e.message);
    }
  }

  ctx.session.batchState = null;
  const link = getDeepLink(content.uniqueId);
  const typeEmoji = { serial: '📺', anime: '🎌' };

  await ctx.reply(
    `✅ <b>Batch yakunlandi!</b>\n` +
    `━━━━━━━━━━━━━━━━\n\n` +
    `${typeEmoji[content.type]} <b>${state.serialTitle}</b>\n` +
    `📁 ${state.seasonNumber}-Fasl\n` +
    `📺 ${savedCount} ta qism saqlandi\n` +
    `(${existingEpCount + 1} — ${existingEpCount + savedCount}-qismlar)\n\n` +
    `🔗 ${link}`,
    {
      parse_mode: 'HTML',
      disable_web_page_preview: true
    }
  );
}

module.exports = composer;
