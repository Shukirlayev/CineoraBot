const { Composer } = require('telegraf');
const Channel = require('../../models/Channel');
const Settings = require('../../models/Settings');

const composer = new Composer();

async function sendChannelMenu(ctx, edit = false) {
  const forceSubscribe = await Settings.get('forceSubscribe', false);
  const channels = await Channel.find({ isActive: true });

  const buttons = channels.map(ch => [
    { text: `📢 ${ch.title || ch.username}`, callback_data: `ch_info_${ch._id}` }
  ]);

  buttons.push([
    { text: "➕ Kanal qo'shish", callback_data: 'ch_add' },
    {
      text: forceSubscribe ? '🟢 Majburiy: ON' : '🔴 Majburiy: OFF',
      callback_data: 'ch_toggle'
    }
  ]);

  const text =
    `📢 Majburiy obuna kanallari\n\n` +
    `Jami: ${channels.length} ta\n` +
    `Majburiy obuna: ${forceSubscribe ? '✅ Yoqilgan' : '❌ O\'chirilgan'}`;

  if (edit) {
    await ctx.editMessageText(text, { reply_markup: { inline_keyboard: buttons } });
  } else {
    await ctx.reply(text, { reply_markup: { inline_keyboard: buttons } });
  }
}

composer.hears('📢 Kanallar', async (ctx) => {
  if (!ctx.adminRole) return;
  await sendChannelMenu(ctx);
});

composer.action('ch_add', async (ctx) => {
  if (!ctx.adminRole) return ctx.answerCbQuery('❌');
  ctx.session.adminState = { step: 'add_channel' };
  await ctx.answerCbQuery();
  await ctx.reply(
    "📢 Kanal username yuboring\n\nMisol: @mening_kanalim\n\n⚠️ Bot kanalga admin bo'lishi kerak!"
  );
});

composer.action('ch_toggle', async (ctx) => {
  if (!ctx.adminRole) return ctx.answerCbQuery('❌');
  const current = await Settings.get('forceSubscribe', false);
  await Settings.set('forceSubscribe', !current);
  await ctx.answerCbQuery(!current ? '✅ Yoqildi' : '❌ O\'chirildi');
  await sendChannelMenu(ctx, true);
});

composer.action(/^ch_info_(.+)$/, async (ctx) => {
  if (!ctx.adminRole) return ctx.answerCbQuery('❌');
  const ch = await Channel.findById(ctx.match[1]);
  if (!ch) return ctx.answerCbQuery('❌ Topilmadi');

  await ctx.answerCbQuery();
  await ctx.editMessageText(
    `📢 <b>${ch.title}</b>\n\nUsername: ${ch.username}\nLink: ${ch.link}`,
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: "🗑 O'chirish", callback_data: `ch_delete_${ch._id}` }],
          [{ text: '🔙 Orqaga', callback_data: 'ch_back' }]
        ]
      }
    }
  );
});

composer.action(/^ch_delete_(.+)$/, async (ctx) => {
  if (!ctx.adminRole) return ctx.answerCbQuery('❌');
  await Channel.findByIdAndDelete(ctx.match[1]);
  await ctx.answerCbQuery("✅ O'chirildi");
  await sendChannelMenu(ctx, true);
});

composer.action('ch_back', async (ctx) => {
  if (!ctx.adminRole) return ctx.answerCbQuery('❌');
  await ctx.answerCbQuery();
  await sendChannelMenu(ctx, true);
});

composer.on('text', async (ctx, next) => {
  if (!ctx.adminRole) return next();
  if (ctx.session?.adminState?.step !== 'add_channel') return next();

  const username = ctx.message.text.trim();

  try {
    const chat = await ctx.telegram.getChat(username);

    const existing = await Channel.findOne({ channelId: chat.id.toString() });
    if (existing) {
      ctx.session.adminState = null;
      return ctx.reply('❌ Bu kanal allaqachon qo\'shilgan!');
    }

    await Channel.create({
      channelId: chat.id.toString(),
      title: chat.title,
      username: chat.username ? `@${chat.username}` : username,
      link: chat.username ? `https://t.me/${chat.username}` : ''
    });

    ctx.session.adminState = null;
    await ctx.reply(`✅ <b>${chat.title}</b> kanali qo'shildi!`, { parse_mode: 'HTML' });
  } catch (e) {
    ctx.session.adminState = null;
    await ctx.reply("❌ Kanal topilmadi. Bot kanalga admin ekanini tekshiring!");
  }
});

module.exports = composer;
