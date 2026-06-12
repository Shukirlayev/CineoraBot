const { Composer } = require('telegraf');
const Content = require('../../models/Content');
const User = require('../../models/User');
const { checkSubscription, sendSubscribeMessage } = require('../../utils/checkSubscription');

const composer = new Composer();
const PAGE_SIZE = 5;

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
    try { await ctx.telegram.deleteMessage(ctx.chat.id, ctx.session.lastListMsgId); } catch (e) {}
    ctx.session.lastListMsgId = null;
  }
}

composer.hears('🎬 Kinolar', async (ctx) => { await deletePrevMsg(ctx); await showList(ctx, 'movie', 0); });
composer.hears('📺 Seriallar', async (ctx) => { await deletePrevMsg(ctx); await showList(ctx, 'serial', 0); });
composer.hears('🎌 Anime', async (ctx) => { await deletePrevMsg(ctx); await showList(ctx, 'anime', 0); });

// 🎲 Tasodifiy
composer.hears('🎲 Tasodifiy', async (ctx) => {
  await deletePrevMsg(ctx);

  const count = await Content.countDocuments({ isActive: true });
  if (count === 0) return ctx.reply('❌ Hozircha kontent mavjud emas.');

  const random = Math.floor(Math.random() * count);
  const content = await Content.findOne({ isActive: true }).skip(random);
  if (!content) return ctx.reply('❌ Xatolik yuz berdi.');

  await ctx.answerCbQuery?.();
  const { sendContent } = require('./start');
  await sendContent(ctx, content);
});

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

async function showList(ctx, type, page) {
  const names = { movie: '🎬 Kinolar', serial: '📺 Seriallar', anime: '🎌 Anime' };
  const total = await Content.countDocuments({ type, isActive: true });

  if (total === 0) {
    const msg = await ctx.reply(`❌ Hozircha ${names[type]} mavjud emas.`);
    ctx.session.lastListMsgId = msg.message_id;
    return;
  }

  const contents = await Content.find({ type, isActive: true })
    .sort({ title: 1 })
    .skip(page * PAGE_SIZE)
    .limit(PAGE_SIZE);

  const buttons = contents.map(c => [{
    text: `${c.title}${c.year ? ` (${c.year})` : ''}`,
    callback_data: `content_${c.uniqueId}`
  }]);

  const nav = [];
  if (page > 0) nav.push({ text: '⬅️', callback_data: `list_${type}_${page - 1}` });
  if ((page + 1) * PAGE_SIZE < total) nav.push({ text: '➡️', callback_data: `list_${type}_${page + 1}` });
  if (nav.length) buttons.push(nav);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const msg = await ctx.reply(
    `${names[type]} — <b>${page + 1}/${totalPages}</b> sahifa:`,
    { parse_mode: 'HTML', reply_markup: { inline_keyboard: buttons } }
  );
  ctx.session.lastListMsgId = msg.message_id;
}

composer.action(/^content_(.+)$/, async (ctx) => {
  const content = await Content.findOne({ uniqueId: ctx.match[1], isActive: true });
  if (!content) return ctx.answerCbQuery('❌ Topilmadi');
  await ctx.answerCbQuery();
  const { sendContent } = require('./start');
  await sendContent(ctx, content);
});

composer.action(/^list_(movie|serial|anime)_(\d+)$/, async (ctx) => {
  const type = ctx.match[1];
  const page = parseInt(ctx.match[2]);
  const names = { movie: '🎬 Kinolar', serial: '📺 Seriallar', anime: '🎌 Anime' };
  const total = await Content.countDocuments({ type, isActive: true });
  if (total === 0) return ctx.answerCbQuery("Kontent yo'q");

  const contents = await Content.find({ type, isActive: true })
    .sort({ title: 1 })
    .skip(page * PAGE_SIZE)
    .limit(PAGE_SIZE);

  const buttons = contents.map(c => [{
    text: `${c.title}${c.year ? ` (${c.year})` : ''}`,
    callback_data: `content_${c.uniqueId}`
  }]);

  const nav = [];
  if (page > 0) nav.push({ text: '⬅️', callback_data: `list_${type}_${page - 1}` });
  if ((page + 1) * PAGE_SIZE < total) nav.push({ text: '➡️', callback_data: `list_${type}_${page + 1}` });
  if (nav.length) buttons.push(nav);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  await ctx.answerCbQuery();
  try {
    await ctx.editMessageText(
      `${names[type]} — <b>${page + 1}/${totalPages}</b> sahifa:`,
      { parse_mode: 'HTML', reply_markup: { inline_keyboard: buttons } }
    );
  } catch (e) {}
});

module.exports = composer;
