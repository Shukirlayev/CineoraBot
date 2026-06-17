const { Composer } = require('telegraf');
const Settings = require('../../models/Settings');

const composer = new Composer();

composer.hears('⚙️ Sozlamalar', async (ctx) => {
  if (ctx.adminRole !== 'superadmin') return;

  const forceSubscribe = await Settings.get('forceSubscribe', false);
  const bannerId = await Settings.get('welcomeBannerId', null);

  await ctx.reply(
    `⚙️ <b>Sozlamalar</b>\n\n` +
    `📢 Majburiy obuna: ${forceSubscribe ? '✅ Yoqilgan' : "❌ O'chirilgan"}\n` +
    `🖼 Xush kelibsiz banneri: ${bannerId ? "✅ O'rnatilgan" : "❌ O'rnatilmagan"}`,
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{
            text: forceSubscribe ? "🔴 Majburiy obunani o'chirish" : "🟢 Majburiy obunani yoqish",
            callback_data: 'settings_toggle_force'
          }],
          [{ text: "🖼 Banner o'rnatish/almashtirish", callback_data: 'settings_set_banner' }]
        ]
      }
    }
  );
});

composer.action('settings_toggle_force', async (ctx) => {
  if (ctx.adminRole !== 'superadmin') return ctx.answerCbQuery('❌');

  const current = await Settings.get('forceSubscribe', false);
  await Settings.set('forceSubscribe', !current);
  const newVal = !current;

  await ctx.answerCbQuery(newVal ? '✅ Yoqildi' : "❌ O'chirildi");
  const bannerId = await Settings.get('welcomeBannerId', null);
  try {
    await ctx.editMessageText(
      `⚙️ <b>Sozlamalar</b>\n\n` +
      `📢 Majburiy obuna: ${newVal ? '✅ Yoqilgan' : "❌ O'chirilgan"}\n` +
      `🖼 Xush kelibsiz banneri: ${bannerId ? "✅ O'rnatilgan" : "❌ O'rnatilmagan"}`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{
              text: newVal ? "🔴 Majburiy obunani o'chirish" : "🟢 Majburiy obunani yoqish",
              callback_data: 'settings_toggle_force'
            }],
            [{ text: "🖼 Banner o'rnatish/almashtirish", callback_data: 'settings_set_banner' }]
          ]
        }
      }
    );
  } catch (e) {}
});

composer.action('settings_set_banner', async (ctx) => {
  if (ctx.adminRole !== 'superadmin') return ctx.answerCbQuery('❌');
  ctx.session.adminState = { step: 'set_banner' };
  await ctx.answerCbQuery();
  try {
    await ctx.editMessageText(
      "🖼 Yangi banner rasmni yuboring\n\n(Yangi foydalanuvchilar /start bosganda shu rasmni ko'radi)\n\n/cancel — bekor qilish"
    );
  } catch (e) {}
});

composer.on('photo', async (ctx, next) => {
  if (ctx.adminRole !== 'superadmin') return next();
  const state = ctx.session?.adminState;
  if (!state || state.step !== 'set_banner') return next();

  const photo = ctx.message.photo;
  const fileId = photo[photo.length - 1].file_id;

  await Settings.set('welcomeBannerId', fileId);
  ctx.session.adminState = null;

  await ctx.replyWithPhoto(fileId, {
    caption: "✅ Banner saqlandi! Endi yangi foydalanuvchilar shu rasmni ko'radi."
  });
});

module.exports = composer;
