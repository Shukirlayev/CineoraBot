const { Composer } = require('telegraf');
const Content = require('../../models/Content');
const Season = require('../../models/Season');
const Episode = require('../../models/Episode');
const Favorite = require('../../models/Favorite');
const Settings = require('../../models/Settings');
const Session = require('../../models/Session');
const { checkSubscription, sendSubscribeMessage } = require('../../utils/checkSubscription');
const { mainMenu } = require('../../utils/keyboards');

const composer = new Composer();

composer.command('start', async (ctx) => {
  const args = ctx.message.text.split(' ');
  const deepLinkId = args[1];

  // ── Yangi foydalanuvchi — chiroyli xush kelibsiz xabari ──────────
  if (ctx.isNewUser) {
    const bannerId = await Settings.get('welcomeBannerId', null);

    const welcomeText =
      `🎬 <b>Cineora'ga xush kelibsiz, ${ctx.from.first_name}!</b>\n\n` +
      `Kino, serial va animelarni bir joyda, tez va qulay tarzda tomosha qiling.\n\n` +
      `Bu yerda sizni kutadi:\n` +
      `🍿 Minglab kino va seriallar\n` +
      `⚡ Tezkor qidiruv va instant natijalar\n` +
      `🎥 HD / Blu-ray sifatdagi kontent\n` +
      `🌐 O'zbek, Ingliz, Rus tilidagi tarjimalar\n` +
      `⭐ Sevimlilar ro'yxati va tavsiyalar\n` +
      `🎲 Tasodifiy film tanlash funksiyasi\n\n` +
      `Hamma narsa sizga qulay bo'lishi uchun yaratilgan.\n\n` +
      `Boshlashga tayyormisiz? 🚀`;

    if (deepLinkId) ctx.session.pendingDeepLink = deepLinkId;

    try {
      if (bannerId) {
        await ctx.replyWithPhoto(bannerId, { caption: welcomeText, parse_mode: 'HTML' });
      } else {
        await ctx.reply(welcomeText, { parse_mode: 'HTML' });
      }
    } catch (e) {
      await ctx.reply(welcomeText, { parse_mode: 'HTML' });
    }

    const localDeepLink = deepLinkId;
    const userId = ctx.from.id;

    setTimeout(async () => {
      try {
        const subResult = await checkSubscription(ctx);

        if (subResult !== true) {
          return sendSubscribeMessage(ctx, subResult);
        }

        if (localDeepLink) {
          const content = await Content.findOne({ uniqueId: localDeepLink, isActive: true });

          try {
            await Session.findOneAndUpdate(
              { key: String(userId) },
              { $set: { 'data.pendingDeepLink': null } }
            );
          } catch (e) {}

          if (content) return sendContent(ctx, content);
        }

        await ctx.reply('Pastdagi menyudan tanlang:', mainMenu);
      } catch (e) {
        console.error('Welcome delay xatosi:', e.message);
      }
    }, 3000);

    return;
  }

  // ── Qaytgan foydalanuvchi — to'g'ridan tekshirish ────────────────
  const subResult = await checkSubscription(ctx);
  if (subResult !== true) {
    if (deepLinkId) ctx.session.pendingDeepLink = deepLinkId;
    return sendSubscribeMessage(ctx, subResult);
  }

  if (deepLinkId) {
    const content = await Content.findOne({ uniqueId: deepLinkId, isActive: true });
    if (!content) return ctx.reply("❌ Kontent topilmadi yoki o'chirilgan.", mainMenu);
    return sendContent(ctx, content);
  }

  await ctx.reply(
    `👋 Salom, <b>${ctx.from.first_name}</b>!\n\nPastdagi menyudan tanlang:`,
    { parse_mode: 'HTML', ...mainMenu }
  );
});

async function sendContent(ctx, content) {
  try {
    await Content.findByIdAndUpdate(content._id, { $inc: { viewCount: 1 } });

    const isFav = await Favorite.findOne({ telegramId: ctx.from.id, contentId: content._id });
    const favBtn = isFav
      ? { text: '💔 Sevimlilardan chiqarish', callback_data: `unfav_${content.uniqueId}` }
      : { text: "❤️ Sevimlilarga qo'shish", callback_data: `fav_${content.uniqueId}` };

    const caption =
      `🎬 <b>${content.title}</b>` +
      (content.year ? ` (${content.year})` : '') +
      (content.languages?.length ? `\n🌐 ${content.languages.join(' | ')}` : '');

    if (content.type === 'movie') {
      if (!content.fileId) return ctx.reply('❌ Bu kinoning fayli mavjud emas.');
      await ctx.replyWithVideo(content.fileId, {
        caption,
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [[favBtn]] }
      });
      return;
    }

    const seasons = await Season.find({ contentId: content._id }).sort({ seasonNumber: 1 });
    if (seasons.length === 0) return ctx.reply('❌ Hozircha fasllar mavjud emas.');

    const typeEmoji = { serial: '📺', anime: '🎌' };
    const buttons = seasons.map(s => [
      { text: `📁 ${s.title || s.seasonNumber + '-Fasl'}`, callback_data: `season_${s._id}` }
    ]);
    buttons.push([favBtn]);

    await ctx.reply(
      `${typeEmoji[content.type]} <b>${content.title}</b>` +
      (content.year ? ` (${content.year})` : '') + '\n\nFaslni tanlang:',
      { parse_mode: 'HTML', reply_markup: { inline_keyboard: buttons } }
    );
  } catch (err) {
    console.error('sendContent xatosi:', err.message);
    await ctx.reply('❌ Xatolik yuz berdi.');
  }
}

composer.action(/^season_(.+)$/, async (ctx) => {
  try {
    const season = await Season.findById(ctx.match[1]);
    if (!season) return ctx.answerCbQuery('❌ Fasl topilmadi');

    const episodes = await Episode.find({ seasonId: season._id }).sort({ episodeNumber: 1 });
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
    await ctx.answerCbQuery('❌ Xatolik');
  }
});

composer.action(/^fav_(.+)$/, async (ctx) => {
  const content = await Content.findOne({ uniqueId: ctx.match[1] });
  if (!content) return ctx.answerCbQuery('❌');
  try {
    await Favorite.create({ telegramId: ctx.from.id, contentId: content._id, uniqueId: content.uniqueId });
    await ctx.answerCbQuery("❤️ Sevimlilarga qo'shildi!");
    try {
      const kb = ctx.callbackQuery.message.reply_markup?.inline_keyboard || [];
      await ctx.editMessageReplyMarkup({
        inline_keyboard: kb.map(row => row.map(btn =>
          btn.callback_data === `fav_${content.uniqueId}`
            ? { text: '💔 Sevimlilardan chiqarish', callback_data: `unfav_${content.uniqueId}` }
            : btn
        ))
      });
    } catch (e) {}
  } catch (e) {
    await ctx.answerCbQuery('❌ Allaqachon sevimlilarda!');
  }
});

composer.action(/^unfav_(.+)$/, async (ctx) => {
  const content = await Content.findOne({ uniqueId: ctx.match[1] });
  if (!content) return ctx.answerCbQuery('❌');
  await Favorite.deleteOne({ telegramId: ctx.from.id, contentId: content._id });
  await ctx.answerCbQuery('💔 Sevimlilardan chiqarildi');
  try {
    const kb = ctx.callbackQuery.message.reply_markup?.inline_keyboard || [];
    await ctx.editMessageReplyMarkup({
      inline_keyboard: kb.map(row => row.map(btn =>
        btn.callback_data === `unfav_${content.uniqueId}`
          ? { text: "❤️ Sevimlilarga qo'shish", callback_data: `fav_${content.uniqueId}` }
          : btn
      ))
    });
  } catch (e) {}
});

module.exports = composer;
module.exports.sendContent = sendContent;
