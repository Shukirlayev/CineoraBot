const { Composer } = require('telegraf');
const Content = require('../../models/Content');
const User = require('../../models/User');
const { checkSubscription, sendSubscribeMessage } = require('../../utils/checkSubscription');

const composer = new Composer();

composer.use(async (ctx, next) => {
  if (!ctx.message?.text) return next();
  if (ctx.adminRole) return next();
  const skip = ['/start', '/admin'];
  if (skip.some(c => ctx.message.text.startsWith(c))) return next();
  const result = await checkSubscription(ctx);
  if (result !== true) return sendSubscribeMessage(ctx, result);
  return next();
});

async function deletePrevMsg(ctx) {
  if (ctx.session?.lastListMsgId) {
    try {
      await ctx.telegram.deleteMessage(ctx.chat.id, ctx.session.lastListMsgId);
    } catch (e) {}
    ctx.session.lastListMsgId = null;
  }
}

composer.hears('🎬 Kinolar', async (ctx) => showList(ctx, 'movie'));
composer.hears('📺 Seriallar', async (ctx) => showList(ctx, 'serial'));
composer.hears('🎌 Anime', async (ctx) => showList(ctx, 'anime'));

composer.hears('📊 Statistika', async (ctx) => {
  await deletePrevMsg(ctx);
  const totalUsers = await User.countDocuments();
  const movies = await Content.countDocuments({ type: 'movie', isActive: true });
  const serials = await Content.countDocuments({ type: 'serial', isActive: true });
  const anime = await Content.countDocuments({ type: 'anime', isActive: true });

  const msg = await ctx.reply(
    `📊 <b>Bot statistikasi</b>\n\n` +
    `👥 Foydalanuvchilar: <b>${totalUsers}</b>\n` +
    `🎬 Kinolar: <b>${movies}</b>\n` +
    `📺 Seriallar: <b>${serials}</b>\n` +
    `🎌 Anime: <b>${anime}</b>`,
    { parse_mode: 'HTML' }
  );
  ctx.session.lastListMsgId = msg.message_id;
});

async function showList(ctx, type) {
  await deletePrevMsg(ctx);

  const names = { movie: '🎬 Kinolar', serial: '📺 Seriallar', anime: '🎌 Anime' };
  const contents = await Content.find({ type, isActive: true })
    .sort({ createdAt: -1 })
    .limit(20);

  if (contents.length === 0) {
    const msg = await ctx.reply(`❌ Hozircha ${names[type]} mavjud emas.`);
    ctx.session.lastListMsgId = msg.message_id;
    return;
  }

  const total = await Content.countDocuments({ type, isActive: true });

  const buttons = contents.map(c => [
    {
      text: `${c.title}${c.year ? ` (${c.year})` : ''}`,
      callback_data: `content_${c.uniqueId}`
    }
  ]);

  if (total > 20) {
    buttons.push([{ text: '➡️ Keyingi', callback_data: `list_${type}_1` }]);
  }

  const msg = await ctx.reply(`${names[type]} — <b>${total} ta</b>:`, {
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: buttons }
  });
  ctx.session.lastListMsgId = msg.message_id;
}

composer.action(/^content_(.+)$/, async (ctx) => {
  const uniqueId = ctx.match[1];
  const content = await Content.findOne({ uniqueId, isActive: true });
  if (!content) return ctx.answerCbQuery('❌ Topilmadi');
  await ctx.answerCbQuery();
  const { sendContent } = require('./start');
  await sendContent(ctx, content);
});

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
  } catch (e) {}
});

module.exports = composer;
