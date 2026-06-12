const { Composer } = require('telegraf');
const Content = require('../../models/Content');
const Season = require('../../models/Season');
const Episode = require('../../models/Episode');
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

    const caption =
      `🎬 <b>${content.title}</b>\n\n` +
      (content.description ? `📝 ${content.description}\n\n` : '') +
      (content.year ? `📅 Yil: ${content.year}\n` : '') +
      (content.languages?.length ? `🌐 Til: ${content.languages.join(', ')}\n` : '') +
      (content.qualities?.length ? `🎞 Sifat: ${content.qualities.join(', ')}\n` : '');

    if (content.type === 'movie') {
      if (!content.fileId) {
        return ctx.reply('❌ Bu kinoning fayli mavjud emas.');
      }
      await ctx.replyWithVideo(content.fileId, { caption, parse_mode: 'HTML' });
      return;
    }

    const seasons = await Season.find({ contentId: content._id }).sort({ seasonNumber: 1 });

    if (seasons.length === 0) {
      return ctx.reply('❌ Bu serialda hozircha fasllar mavjud emas.');
    }

    const buttons = seasons.map(s => [
      { text: `📁 ${s.title || s.seasonNumber + '-Fasl'}`, callback_data: `season_${s._id}` }
    ]);

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

composer.action(/^season_(.+)$/, async (ctx) => {
  const seasonId = ctx.match[1];
  try {
    const season = await Season.findById(seasonId);
    if (!season) return ctx.answerCbQuery('❌ Fasl topilmadi');

    const episodes = await Episode.find({ seasonId }).sort({ episodeNumber: 1 });
    if (episodes.length === 0) return ctx.answerCbQuery('❌ Qismlar mavjud emas');

    await ctx.answerCbQuery();
    await ctx.reply(`📺 ${season.title || season.seasonNumber + '-Fasl'} qismlari yuborilmoqda...`);

    for (const ep of episodes) {
      const caption =
        `📺 ${ep.title || ep.episodeNumber + '-Qism'}` +
        (ep.quality ? ` | ${ep.quality}` : '') +
        (ep.language ? ` | ${ep.language}` : '');
      try {
        await ctx.replyWithVideo(ep.fileId, { caption });
        await new Promise(r => setTimeout(r, 400));
      } catch (e) {
        console.error(`Episode yuborishda xato (${ep.episodeNumber}):`, e.message);
        await ctx.reply(`❌ ${ep.episodeNumber}-Qism yuborishda xatolik`);
      }
    }
  } catch (err) {
    console.error('season action xatosi:', err.message);
    await ctx.answerCbQuery('❌ Xatolik yuz berdi');
  }
});

module.exports = composer;
module.exports.sendContent = sendContent;
