const { Composer } = require('telegraf');
const Settings = require('../../models/Settings');

const composer = new Composer();

composer.hears('⚙️ Sozlamalar', async (ctx) => {
  if (ctx.adminRole !== 'superadmin') return;

  const forceSubscribe = await Settings.get('forceSubscribe', false);

  await ctx.reply(
    `⚙️ <b>Sozlamalar</b>\n\n` +
    `📢 Majburiy obuna: ${forceSubscribe ? '✅ Yoqilgan' : '❌ O\'chirilgan'}`,
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: forceSubscribe
                ? "🔴 Majburiy obunan o'chirish"
                : '🟢 Majburiy obunan yoqish',
              callback_data: 'settings_toggle_force'
            }
          ]
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
  await ctx.editMessageText(
    `⚙️ <b>Sozlamalar</b>\n\n` +
    `📢 Majburiy obuna: ${newVal ? '✅ Yoqilgan' : '❌ O\'chirilgan'}`,
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: newVal
                ? "🔴 Majburiy obunan o'chirish"
                : '🟢 Majburiy obunan yoqish',
              callback_data: 'settings_toggle_force'
            }
          ]
        ]
      }
    }
  );
});

module.exports = composer;
