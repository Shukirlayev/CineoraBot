const { Composer } = require('telegraf');
const Content = require('../../models/Content');
const SearchRequest = require('../../models/SearchRequest');

const composer = new Composer();

// /cancel — istalgan vaqtda holatni tozalash
composer.command('cancel', async (ctx) => {
  ctx.session.searching = false;
  ctx.session.pendingNotifyQuery = null;
  ctx.session.adminState = null;
  await ctx.reply('❌ Bekor qilindi.', { reply_markup: { remove_keyboard: true } });
});

composer.hears('🔍 Qidirish', async (ctx) => {
  ctx.session.searching = true;
  await ctx.reply(
    '🔍 Qidirmoqchi bo\'lgan kino/serial/anime nomini yozing:\n\n/cancel — bekor qilish'
  );
});

composer.on('text', async (ctx, next) => {
  if (!ctx.session?.searching) return next();
  const query = ctx.message.text.trim();
  if (query.startsWith('/')) {
    ctx.session.searching = false;
    return next();
  }

  ctx.session.searching = false;

  await SearchRequest.create({
    userId: ctx.from.id,
    username: ctx.from.username,
    firstName: ctx.from.first_name,
    query,
    notified: true
  }).catch(() => {});

  const contents = await Content.find({
    isActive: true,
    $or: [
      { title: { $regex: query, $options: 'i' } },
      { searchTags: { $elemMatch: { $regex: query, $options: 'i' } } }
    ]
  }).sort({ title: 1 }).limit(10);

  if (contents.length === 0) {
    ctx.session.pendingNotifyQuery = query;

    const existing = await SearchRequest.findOne({
      userId: ctx.from.id,
      query: { $regex: `^${query}$`, $options: 'i' },
      notified: false
    });

    return ctx.reply(
      `❌ "<b>${query}</b>" bo'yicha hech narsa topilmadi.\n\n` +
      (existing ? '⏳ So\'rovingiz allaqachon yuborilgan.' : 'Adminga xabar yuborib, qo\'shilishini so\'raysizmi?'),
      {
        parse_mode: 'HTML',
        reply_markup: existing ? undefined : {
          inline_keyboard: [[
            { text: '📩 Adminga yuborish', callback_data: 'notify_admin_req' }
          ]]
        }
      }
    );
  }

  const typeEmoji = { movie: '🎬', serial: '📺', anime: '🎌' };
  const buttons = contents.map(c => [{
    text: `${typeEmoji[c.type]} ${c.title}${c.year ? ` (${c.year})` : ''}`,
    callback_data: `content_${c.uniqueId}`
  }]);

  await ctx.reply(
    `🔍 "<b>${query}</b>" — ${contents.length} ta natija:`,
    { parse_mode: 'HTML', reply_markup: { inline_keyboard: buttons } }
  );
});

// Adminga yuborish
composer.action('notify_admin_req', async (ctx) => {
  const query = ctx.session?.pendingNotifyQuery;
  if (!query) return ctx.answerCbQuery('❌ So\'rov topilmadi');

  const existing = await SearchRequest.findOne({
    userId: ctx.from.id,
    query: { $regex: `^${query}$`, $options: 'i' },
    notified: false
  });

  if (existing) {
    return ctx.answerCbQuery('⏳ Allaqachon yuborilgan, kutib turing!', { show_alert: true });
  }

  await SearchRequest.create({
    userId: ctx.from.id,
    username: ctx.from.username,
    firstName: ctx.from.first_name,
    query,
    notified: false
  });

  try {
    const adminId = process.env.SUPER_ADMIN_ID;
    const userName = ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name;
    await ctx.telegram.sendMessage(
      adminId,
      `🔍 <b>Yangi so'rov</b>\n\n👤 ${userName}\n🔎 <b>${query}</b>\n⏰ ${new Date().toLocaleString('uz-UZ')}`,
      { parse_mode: 'HTML' }
    );
  } catch (e) {}

  ctx.session.pendingNotifyQuery = null;
  await ctx.answerCbQuery('✅ Yuborildi!');
  try {
    await ctx.editMessageText(
      `✅ Adminga xabar yuborildi!\n\n"<b>${query}</b>" qo'shilganda sizga xabar beriladi.`,
      { parse_mode: 'HTML' }
    );
  } catch (e) {}
});

module.exports = composer;
