const { Composer } = require('telegraf');
const Content = require('../../models/Content');
const Season = require('../../models/Season');
const Episode = require('../../models/Episode');
const Favorite = require('../../models/Favorite');
const { checkSubscription, sendSubscribeMessage } = require('../../utils/checkSubscription');
const { mainMenu } = require('../../utils/keyboards');

const composer = new Composer();

composer.command('start', async (ctx) => {
  const args = ctx.message.text.split(' ');
  const deepLinkId = args[1];

  const subResult = await checkSubscription(ctx);
  if (subResult !== true) {
    if (deepLinkId) ctx.session.pendingDeepLink = deepLinkId;
    return sendSubscribeMessage(ctx, subResult);
  }

  if (deepLinkId) {
    const content = await Content.findOne({ uniqueId: deepLinkId, isActive: true });
    if (!content) {
      return ctx.reply("❌ Kontent topilmadi yoki o'chirilgan.", mainMenu);
    }
    return sendContent(ctx, content);
  }

  await ctx.reply(
    `👋 Salom, <b>${ctx.from.first_name}</b>!\n\n` +
    `🎬 <b>CineoraBot</b>ga xush kelibsiz!\n\n` +
    `Pastdagi menyudan tanlang:`,
    { parse_mode: 'HTML', ...mainMenu }
  );
});

async function sendContent(ctx, content) {
  try {
    await Content.findByIdAndUpdate(content._id, { $inc: { viewCount: 1 } });

    const isFav = await Favorite.findOne({
      telegramId: ctx.from.id,
      contentId: content._id
    });

    const typeEmoji = { movie: '🎬', serial: '📺', anime: '🎌' };
    const typeNames = { movie: 'Kino', serial: 'Serial', anime: 'Anime' };

    const caption =
      `${typeEmoji[content.type]} <b>${content.title}</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      (content.description ? `📝 ${content.description}\n\n` : '') +
      (content.year ? `📅 <b>Yil:</b> ${content.year}\n` : '') +
      (content.languages?.length ? `🌐 <b>Til:</b> ${content.languages.join(' | ')}\n` : '') +
      `🏷 <b>Tur:</b> ${typeNames[content.type]}\n` +
      `👁 <b>Ko'rishlar:</b> ${content.viewCount}`;

    const watchBtn = content.type === 'movie'
      ? { text: "▶️ Ko'rish", callback_data: `watch_${content.uniqueId}` }
      : { text: "📁 Fasllarni ko'rish", callback_data: `seasons_${content.uniqueId}` };

    const favBtn = isFav
      ? { text: '💔 Sevimlilardan chiqarish', callback_data: `unfav_${content.uniqueId}` }
      : { text: "❤️ Sevimlilarga qo'shish", callback_data: `fav_${content.uniqueId}` };

    const buttons = [[watchBtn], [favBtn]];

    if (content.poster) {
      await ctx.replyWithPhoto(content.poster, {
        caption,
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: buttons }
      });
    } else {
      await ctx.reply(caption, {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: buttons }
      });
    }
  } catch (err) {
    console.error('sendContent xatosi:', err.message);
    await ctx.reply('❌ Kontent yuborishda xatolik yuz berdi.');
  }
}

// Kino ko'rish
composer.action(/^watch_(.+)$/, async (ctx) => {
  const uniqueId = ctx.match[1];
  const content = await Content.findOne({ uniqueId, isActive: true });
  if (!content?.fileId) {
    return ctx.answerCbQuery('❌ Fayl topilmadi', { show_alert: true });
  }
  await ctx.answerCbQuery('⏳ Yuklanmoqda...');
  try {
    await ctx.replyWithVideo(content.fileId, {
      caption: `🎬 <b>${content.title}</b>`,
      parse_mode: 'HTML'
    });
  } catch (e) {
    await ctx.reply("❌ Video yuborishda xatolik. Qayta urinib ko'ring.");
  }
});

// Fasllar ro'yxati
composer.action(/^seasons_(.+)$/, async (ctx) => {
  const uniqueId = ctx.match[1];
  const content = await Content.findOne({ uniqueId, isActive: true });
  if (!content) return ctx.answerCbQuery('❌ Topilmadi');

  const seasons = await Season.find({ contentId: content._id }).sort({ seasonNumber: 1 });
  if (seasons.length === 0) return ctx.answerCbQuery("❌ Hozircha fasl yo'q");

  const buttons = seasons.map(s => [
    { text: `📁 ${s.title || s.seasonNumber + '-Fasl'}`, callback_data: `season_${s._id}` }
  ]);

  await ctx.answerCbQuery();
  await ctx.reply(
    `📺 <b>${content.title}</b> — Fasllar:`,
    { parse_mode: 'HTML', reply_markup: { inline_keyboard: buttons } }
  );
});

// Fasl tanlash — barcha qismlarni yuborish
composer.action(/^season_(.+)$/, async (ctx) => {
  const seasonId = ctx.match[1];
  try {
    const season = await Season.findById(seasonId);
    if (!season) return ctx.answerCbQuery('❌ Fasl topilmadi');

    const episodes = await Episode.find({ seasonId }).sort({ episodeNumber: 1 });
    if (episodes.length === 0) return ctx.answerCbQuery('❌ Qismlar mavjud emas');

    await ctx.answerCbQuery();
    await ctx.reply(
      `📺 <b>${season.title || season.seasonNumber + '-Fasl'}</b> — ${episodes.length} ta qism yuborilmoqda...`,
      { parse_mode: 'HTML' }
    );

    for (const ep of episodes) {
      const caption =
        `📺 <b>${ep.title || ep.episodeNumber + '-Qism'}</b>` +
        (ep.quality ? ` | ${ep.quality}` : '') +
        (ep.language ? ` | ${ep.language}` : '');
      try {
        await ctx.replyWithVideo(ep.fileId, { caption, parse_mode: 'HTML' });
        await new Promise(r => setTimeout(r, 400));
      } catch (e) {
        await ctx.reply(`❌ ${ep.episodeNumber}-Qism yuborishda xatolik`);
      }
    }
  } catch (err) {
    console.error('season action xatosi:', err.message);
    await ctx.answerCbQuery('❌ Xatolik yuz berdi');
  }
});

// Sevimlilarga qo'shish
composer.action(/^fav_(.+)$/, async (ctx) => {
  const uniqueId = ctx.match[1];
  const content = await Content.findOne({ uniqueId });
  if (!content) return ctx.answerCbQuery('❌ Topilmadi');

  try {
    await Favorite.create({
      telegramId: ctx.from.id,
      contentId: content._id,
      uniqueId: content.uniqueId
    });
    await ctx.answerCbQuery("❤️ Sevimlilarga qo'shildi!");

    try {
      const keyboard = ctx.callbackQuery.message.reply_markup?.inline_keyboard || [];
      const newKeyboard = keyboard.map(row =>
        row.map(btn =>
          btn.callback_data === `fav_${uniqueId}`
            ? { text: '💔 Sevimlilardan chiqarish', callback_data: `unfav_${uniqueId}` }
            : btn
        )
      );
      await ctx.editMessageReplyMarkup({ inline_keyboard: newKeyboard });
    } catch (e) {}
  } catch (e) {
    await ctx.answerCbQuery('❌ Allaqachon sevimlilarda!');
  }
});

// Sevimlilardan chiqarish
composer.action(/^unfav_(.+)$/, async (ctx) => {
  const uniqueId = ctx.match[1];
  const content = await Content.findOne({ uniqueId });
  if (!content) return ctx.answerCbQuery('❌ Topilmadi');

  await Favorite.deleteOne({ telegramId: ctx.from.id, contentId: content._id });
  await ctx.answerCbQuery('💔 Sevimlilardan chiqarildi');

  try {
    const keyboard = ctx.callbackQuery.message.reply_markup?.inline_keyboard || [];
    const newKeyboard = keyboard.map(row =>
      row.map(btn =>
        btn.callback_data === `unfav_${uniqueId}`
          ? { text: "❤️ Sevimlilarga qo'shish", callback_data: `fav_${uniqueId}` }
          : btn
      )
    );
    await ctx.editMessageReplyMarkup({ inline_keyboard: newKeyboard });
  } catch (e) {}
});

module.exports = composer;
module.exports.sendContent = sendContent;
