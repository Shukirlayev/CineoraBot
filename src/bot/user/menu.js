const { Composer } = require('telegraf');
const Content = require('../../models/Content');
const User = require('../../models/User');
const { checkSubscription, sendSubscribeMessage } = require('../../utils/checkSubscription');
const { sendContent } = require('./start');

const composer = new Composer();

// Obuna tekshirish (admin emas bo'lsa)
composer.use(async (ctx, next) => {
  if (!ctx.message?.text) return next();
  if (ctx.adminRole) return next();
  const skip = ['/start', '/admin'];
  if (skip.some(c => ctx.message.text.startsWith(c))) return next();

  const result = await checkSubscription(ctx);
  if (result !== true) return sendSubscribeMessage(ctx, result);
  return next();
});

composer.hears('🎬 Kinolar', async (ctx) => showList(ctx, 'movie'));
composer.hears('📺 Seriallar', async (ctx) => showList(ctx, 'serial'));
composer.hears('🎌 Anime', async (ctx) => showList(ctx, 'anime'));

async function showList(ctx, type) {
  const names = { movie: '🎬 Kinolar', serial: '📺 Seriallar', anime: '🎌 Anime' };
  const contents = await Content.find({ type, isActive: true })
    .sort({ createdAt: -1 })
    .limit(20);

  if (contents.length === 0) {
    return ctx.reply(`❌ Hozircha ${names[type]} mavjud emas.`);
  }

  const buttons = contents.map(c => [
    {
      text: `${c.title}${c.year ? ` (${c.year})` : ''}`,
      callback_data: `content_${c.uniqueId}`
    }
  ]);

  const total = await Content.countDocuments({ type, isActive: true });
  if (total > 20) {
    buttons.push([{ text: '➡️ Keyingi', callback_data: `list_${type}_1` }]);
  }

  await ctx.reply(`${names[type]} ro'yxati (${total} ta):`, {
    reply_markup: { inline_keyboard: buttons }
  });
}

// Kontent tanlash
composer.action(/^content_(.+)$/, async (ctx) => {
  const uniqueId = ctx.match[1];
  const content = await Content.findOne({ uniqueId, isActive: true });
  if (!content) return ctx.answerCbQuery('❌ Topilmadi');
  await ctx.answerCbQuery();
  await sendContent(ctx, content);
});

// Sahifalash
composer.action(/^list_(movie|serial|anime)_(\d+)$/, async (ctx) => {
  const type = ctx.match[1];
  const page = parseInt(ctx.match[2]);
  const limit = 20;

  const contents = await Content.find({ type, isActive: true })
    .sort({ createdAt: -1 })
    .skip(page * limit)
    .limit(limit);

  const total = await Content.countDocuments({ type, isActive: true });
  if (contents.length === 0) return ctx.answerCbQuery("Boshqa kontent yo'q");

  const buttons = contents.map(c => [
    {
      text: `${c.title}${c.year ? ` (${c.year})` : ''}`,
      callback_data: `content_${c.uniqueId}`
    }
  ]);

  const nav = [];
  if (page > 0) nav.push({ text: '⬅️', callback_data: `list_${type}_${page - 1}` });
  if ((page + 1) * limit < total) nav.push({ text: '➡️', callback_data: `list_${type}_${page + 1}` });
  if (nav.length > 0) buttons.push(nav);

  await ctx.answerCbQuery();
  try {
    await ctx.editMessageReplyMarkup({ inline_keyboard: buttons });
  } catch (e) {
    if (!e.message.includes('message is not modified')) {
      console.error(e);
    }
  }
});

module.exports = composer;
