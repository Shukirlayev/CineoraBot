const { Composer } = require('telegraf');
const Content = require('../../models/Content');

const composer = new Composer();

composer.action('menu_search', async (ctx) => {
  ctx.session = ctx.session || {};
  ctx.session.searching = true;
  await ctx.answerCbQuery();
  
  const backBtn = [[{ text: '🔙 Bosh menyu', callback_data: 'main_menu' }]];
  try {
    await ctx.editMessageText("🔍 Qidirmoqchi bo'lgan kino/serial/anime nomini yozing:", {
      reply_markup: { inline_keyboard: backBtn }
    });
  } catch (e) {}
});

composer.on('text', async (ctx, next) => {
  if (!ctx.session?.searching) return next();

  const query = ctx.message.text.trim();
  if (query.startsWith('/')) {
    ctx.session.searching = false;
    return next();
  }

  ctx.session.searching = false;

  const contents = await Content.find({
    title: { $regex: query, $options: 'i' },
    isActive: true
  }).limit(10);

  const backBtn = [[{ text: '🔙 Bosh menyu', callback_data: 'main_menu' }]];

  if (contents.length === 0) {
    return ctx.reply(`❌ "<b>${query}</b>" bo'yicha hech narsa topilmadi.`, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: backBtn }
    });
  }

  const typeEmoji = { movie: '🎬', serial: '📺', anime: '🎌' };

  const buttons = contents.map(c => [
    {
      text: `${typeEmoji[c.type]} ${c.title}${c.year ? ` (${c.year})` : ''}`,
      callback_data: `content_${c.uniqueId}`
    }
  ]);

  buttons.push([{ text: '🔙 Bosh menyu', callback_data: 'main_menu' }]);

  await ctx.reply(`🔍 "<b>${query}</b>" bo'yicha natijalar:`, {
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: buttons }
  });
});

module.exports = composer;
