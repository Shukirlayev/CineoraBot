const { Composer } = require('telegraf');
const Content = require('../../models/Content');
const { mainMenu } = require('../../utils/keyboards');
const { sendContent } = require('./start');

const composer = new Composer();

// Inline Menu tugmalari uchun action handlerlar
composer.action('menu_movie', async (ctx) => showListInline(ctx, 'movie'));
composer.action('menu_serial', async (ctx) => showListInline(ctx, 'serial'));
composer.action('menu_anime', async (ctx) => showListInline(ctx, 'anime'));

async function showListInline(ctx, type) {
  const names = { movie: '🎬 Kinolar', serial: '📺 Seriallar', anime: '🎌 Anime' };
  const contents = await Content.find({ type, isActive: true })
    .sort({ createdAt: -1 })
    .limit(20);

  await ctx.answerCbQuery();

  if (contents.length === 0) {
    const backBtn = [[{ text: '🔙 Bosh menyu', callback_data: 'main_menu' }]];
    try {
      return await ctx.editMessageText(`❌ Hozircha ${names[type]} mavjud emas.`, {
        reply_markup: { inline_keyboard: backBtn }
      });
    } catch (e) {}
  }

  const buttons = contents.map(c => [
    {
      text: `${c.title}${c.year ? ` (${c.year})` : ''}`,
      callback_data: `content_${c.uniqueId}`
    }
  ]);

  const total = await Content.countDocuments({ type, isActive: true });
  
  // Sahifalash (Paging) navigatsiyasi
  const navRow = [];
  if (total > 20) {
    navRow.push({ text: '➡️ Keyingi', callback_data: `list_${type}_1` });
  }
  if (navRow.length > 0) buttons.push(navRow);

  // Har doim bosh menyuga qaytish tugmasini qo'shish
  buttons.push([{ text: '🔙 Bosh menyu', callback_data: 'main_menu' }]);

  try {
    await ctx.editMessageText(`🍿 ${names[type]} ro'yxati:`, {
      reply_markup: { inline_keyboard: buttons }
    });
  } catch (e) {}
}

// Kontent tanlash (Kino/Serial tanlanganda yangi xabar sifatida yuboradi, chunki video/rasm edit qilib bo'lmaydi)
composer.action(/^content_(.+)$/, async (ctx) => {
  const uniqueId = ctx.match[1];
  const content = await Content.findOne({ uniqueId, isActive: true });
  if (!content) return ctx.answerCbQuery('❌ Topilmadi');
  await ctx.answerCbQuery();
  await sendContent(ctx, content);
});

// Sahifalash (Pagination) handleri
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

  buttons.push([{ text: '🔙 Bosh menyu', callback_data: 'main_menu' }]);

  await ctx.answerCbQuery();
  try {
    await ctx.editMessageReplyMarkup({ inline_keyboard: buttons });
  } catch (e) {}
});

module.exports = composer;
