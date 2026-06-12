const { Composer } = require('telegraf');
const Favorite = require('../../models/Favorite');
const Content = require('../../models/Content');

const composer = new Composer();

composer.hears('❤️ Sevimlilar', async (ctx) => {
  const favs = await Favorite.find({ telegramId: ctx.from.id })
    .sort({ addedAt: -1 })
    .limit(20);

  if (favs.length === 0) {
    return ctx.reply(
      "❤️ Sevimlilar ro'yxatingiz bo'sh.\n\nKino yoki serial sahifasida ❤️ tugmasini bosing!"
    );
  }

  const buttons = [];
  for (const fav of favs) {
    const content = await Content.findById(fav.contentId);
    if (!content || !content.isActive) continue;
    const typeEmoji = { movie: '🎬', serial: '📺', anime: '🎌' };
    buttons.push([{
      text: `${typeEmoji[content.type]} ${content.title}${content.year ? ` (${content.year})` : ''}`,
      callback_data: `content_${content.uniqueId}`
    }]);
  }

  if (buttons.length === 0) {
    return ctx.reply("❤️ Sevimlilar ro'yxatingiz bo'sh.");
  }

  await ctx.reply(`❤️ <b>Sevimlilaringiz</b> — ${buttons.length} ta:`, {
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: buttons }
  });
});

module.exports = composer;
