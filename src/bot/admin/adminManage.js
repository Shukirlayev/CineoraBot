const { Composer } = require('telegraf');
const Admin = require('../../models/Admin');
const User = require('../../models/User');

const composer = new Composer();

async function sendAdminList(ctx, edit = false) {
  const admins = await Admin.find({ isActive: true });

  const buttons = admins.map(a => [
    {
      text: `👤 ${a.firstName || a.username || a.telegramId}`,
      callback_data: `adm_info_${a._id}`
    }
  ]);

  buttons.push([{ text: "➕ Admin qo'shish", callback_data: 'adm_add' }]);

  const text = `👥 Adminlar ro'yxati (${admins.length} ta):`;

  try {
    if (edit) {
      await ctx.editMessageText(text, { reply_markup: { inline_keyboard: buttons } });
    } else {
      await ctx.reply(text, { reply_markup: { inline_keyboard: buttons } });
    }
  } catch (e) {}
}

composer.hears('👥 Adminlar', async (ctx) => {
  if (ctx.adminRole !== 'superadmin') return;
  await sendAdminList(ctx);
});

composer.action('adm_add', async (ctx) => {
  if (ctx.adminRole !== 'superadmin') return ctx.answerCbQuery('❌');
  ctx.session = ctx.session || {};
  ctx.session.adminState = { step: 'add_admin' };
  await ctx.answerCbQuery();
  await ctx.reply('👤 Yangi admin Telegram ID sini yuboring:\n\n(Avval botga /start bosgan bo\'lishi kerak)');
});

composer.action(/^adm_info_(.+)$/, async (ctx) => {
  if (ctx.adminRole !== 'superadmin') return ctx.answerCbQuery('❌');
  const admin = await Admin.findById(ctx.match[1]);
  if (!admin) return ctx.answerCbQuery('❌ Topilmadi');

  await ctx.answerCbQuery();
  try {
    await ctx.editMessageText(
      `👤 Admin ma'lumotlari:\n\n` +
      `Ism: ${admin.firstName || "Noma'lum"}\n` +
      `Username: ${admin.username ? '@' + admin.username : "Yo'q"}\n` +
      `ID: <code>${admin.telegramId}</code>\n` +
      `Rol: ${admin.role}\n` +
      `Qo'shilgan: ${admin.addedAt.toLocaleDateString('uz-UZ')}`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: "🗑 O'chirish", callback_data: `adm_remove_${admin._id}` }],
            [{ text: '🔙 Orqaga', callback_data: 'adm_back' }]
          ]
        }
      }
    );
  } catch (e) {}
});

composer.action(/^adm_remove_(.+)$/, async (ctx) => {
  if (ctx.adminRole !== 'superadmin') return ctx.answerCbQuery('❌');
  await Admin.findByIdAndUpdate(ctx.match[1], { isActive: false });
  await ctx.answerCbQuery("✅ Admin o'chirildi");
  await sendAdminList(ctx, true);
});

composer.action('adm_back', async (ctx) => {
  if (ctx.adminRole !== 'superadmin') return ctx.answerCbQuery('❌');
  await ctx.answerCbQuery();
  await sendAdminList(ctx, true);
});

composer.on('text', async (ctx, next) => {
  if (ctx.adminRole !== 'superadmin') return next();
  if (ctx.session?.adminState?.step !== 'add_admin') return next();

  const telegramId = parseInt(ctx.message.text.trim());
  if (isNaN(telegramId)) return ctx.reply('❌ Noto\'g\'ri ID. Raqam kiriting:');

  const existing = await Admin.findOne({ telegramId });
  if (existing && existing.isActive) {
    ctx.session.adminState = null;
    return ctx.reply('❌ Bu foydalanuvchi allaqachon admin!');
  }

  const user = await User.findOne({ telegramId });

  if (existing) {
    existing.isActive = true;
    await existing.save();
  } else {
    await Admin.create({
      telegramId,
      username: user?.username,
      firstName: user?.firstName,
      role: 'admin',
      addedBy: ctx.from.id
    });
  }

  ctx.session.adminState = null;
  await ctx.reply(`✅ ${user?.firstName || telegramId} admin qilindi!`);

  try {
    await ctx.telegram.sendMessage(
      telegramId,
      "🎉 Siz admin qilindingiz!\n/admin buyrug'ini yuboring."
    );
  } catch (e) {}
});

module.exports = composer;
