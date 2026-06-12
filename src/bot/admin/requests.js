const { Composer } = require('telegraf');
const SearchRequest = require('../../models/SearchRequest');

const composer = new Composer();

async function showRequests(ctx, page = 0, edit = false) {
  const limit = 5;
  const total = await SearchRequest.countDocuments({ notified: false });

  if (total === 0) {
    const text = '📬 Hozircha kutayotgan so\'rovlar yo\'q.';
    if (edit) {
      try { await ctx.editMessageText(text); } catch (e) {}
    } else {
      await ctx.reply(text);
    }
    return;
  }

  const requests = await SearchRequest.find({ notified: false })
    .sort({ createdAt: -1 })
    .skip(page * limit)
    .limit(limit);

  const buttons = requests.map(r => {
    const name = r.username ? `@${r.username}` : r.firstName || 'Anonim';
    return [
      { text: `🔍 ${r.query} — ${name}`, callback_data: `req_info_${r._id}` }
    ];
  });

  const nav = [];
  if (page > 0) nav.push({ text: '⬅️', callback_data: `req_page_${page - 1}` });
  if ((page + 1) * limit < total) nav.push({ text: '➡️', callback_data: `req_page_${page + 1}` });
  if (nav.length) buttons.push(nav);

  const totalPages = Math.ceil(total / limit);
  const text = `📬 <b>Kutayotgan so'rovlar</b> — ${total} ta\n${page + 1}/${totalPages} sahifa:`;

  const opts = { parse_mode: 'HTML', reply_markup: { inline_keyboard: buttons } };
  if (edit) {
    try { await ctx.editMessageText(text, opts); } catch (e) { await ctx.reply(text, opts); }
  } else {
    await ctx.reply(text, opts);
  }
}

composer.hears("📬 So'rovlar", async (ctx) => {
  if (!ctx.adminRole) return;
  await showRequests(ctx, 0);
});

composer.command('requests', async (ctx) => {
  if (!ctx.adminRole) return;
  await showRequests(ctx, 0);
});

composer.action(/^req_page_(\d+)$/, async (ctx) => {
  if (!ctx.adminRole) return ctx.answerCbQuery('❌');
  await ctx.answerCbQuery();
  await showRequests(ctx, parseInt(ctx.match[1]), true);
});

composer.action(/^req_info_(.+)$/, async (ctx) => {
  if (!ctx.adminRole) return ctx.answerCbQuery('❌');

  const req = await SearchRequest.findById(ctx.match[1]);
  if (!req) return ctx.answerCbQuery('❌ Topilmadi');

  const name = req.username ? `@${req.username}` : req.firstName || 'Anonim';
  const date = new Date(req.createdAt).toLocaleString('uz-UZ');

  await ctx.answerCbQuery();
  try {
    await ctx.editMessageText(
      `📬 <b>So'rov ma'lumotlari</b>\n\n` +
      `👤 Foydalanuvchi: ${name}\n` +
      `🔍 So'rov: <b>${req.query}</b>\n` +
      `⏰ Vaqt: ${date}`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: "✅ Qo'shildi deb belgilash", callback_data: `req_done_${req._id}` }],
            [{ text: "🗑 O'chirish", callback_data: `req_del_${req._id}` }],
            [{ text: '🔙 Orqaga', callback_data: 'req_page_0' }]
          ]
        }
      }
    );
  } catch (e) {}
});

composer.action(/^req_done_(.+)$/, async (ctx) => {
  if (!ctx.adminRole) return ctx.answerCbQuery('❌');

  const req = await SearchRequest.findById(ctx.match[1]);
  if (!req) return ctx.answerCbQuery('❌ Topilmadi');

  await SearchRequest.findByIdAndUpdate(req._id, { notified: true });
  await ctx.answerCbQuery("✅ Belgilandi!");

  // Userga xabar yuborish
  try {
    await ctx.telegram.sendMessage(
      req.userId,
      `✅ Siz so'ragan "<b>${req.query}</b>" botga qo'shildi!\n\nQidirish orqali topishingiz mumkin.`,
      { parse_mode: 'HTML' }
    );
  } catch (e) {}

  await showRequests(ctx, 0, true);
});

composer.action(/^req_del_(.+)$/, async (ctx) => {
  if (!ctx.adminRole) return ctx.answerCbQuery('❌');
  await SearchRequest.findByIdAndDelete(ctx.match[1]);
  await ctx.answerCbQuery("🗑 O'chirildi");
  await showRequests(ctx, 0, true);
});

module.exports = composer;
