const { Composer } = require('telegraf');
const Channel = require('../../models/Channel');
const Settings = require('../../models/Settings');

const composer = new Composer();

const typeEmoji = { public: '🌐', private: '🔒', private_request: '🔒➕' };
const typeNames = { public: 'Ommabop', private: 'Yopiq', private_request: 'Yopiq + Tasdiqlash' };

async function sendChannelMenu(ctx, edit = false) {
  const forceSubscribe = await Settings.get('forceSubscribe', false);
  const channels = await Channel.find({ isActive: true });

  const buttons = channels.map(ch => [
    { text: `${typeEmoji[ch.type] || '📢'} ${ch.title || ch.username}`, callback_data: `ch_info_${ch._id}` }
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
    `Majburiy obuna: ${forceSubscribe ? '✅ Yoqilgan' : "❌ O'chirilgan"}`;

  const opts = { reply_markup: { inline_keyboard: buttons } };

  if (edit) {
    try { await ctx.editMessageText(text, opts); } catch (e) { await ctx.reply(text, opts); }
  } else {
    await ctx.reply(text, opts);
  }
}

composer.hears('📢 Kanallar', async (ctx) => {
  if (!ctx.adminRole) return;
  await sendChannelMenu(ctx);
});

// ─── Tur tanlash ──────────────────────────────────────────────────
composer.action('ch_add', async (ctx) => {
  if (!ctx.adminRole) return ctx.answerCbQuery('❌');
  await ctx.answerCbQuery();
  try {
    await ctx.editMessageText(
      `📢 Kanal turini tanlang:\n\n` +
      `🌐 <b>Ommabop</b> — @username bilan ochiq kanal\n` +
      `🔒 <b>Yopiq</b> — username yo'q, oddiy a'zolik\n` +
      `🔒➕ <b>Yopiq + Tasdiqlash</b> — qo'shilish so'rovi avtomatik tasdiqlanadi\n\n` +
      `⚠️ Yopiq turlar uchun bot kanalda ADMIN bo'lishi shart!`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🌐 Ommabop', callback_data: 'ch_type_public' }],
            [{ text: '🔒 Yopiq', callback_data: 'ch_type_private' }],
            [{ text: '🔒➕ Yopiq + Tasdiqlash', callback_data: 'ch_type_private_request' }],
            [{ text: '❌ Bekor', callback_data: 'ch_back' }]
          ]
        }
      }
    );
  } catch (e) {}
});

composer.action('ch_type_public', async (ctx) => {
  if (!ctx.adminRole) return ctx.answerCbQuery('❌');
  ctx.session.adminState = { step: 'add_channel_username', type: 'public' };
  await ctx.answerCbQuery();
  try {
    await ctx.editMessageText(
      "📢 Kanal username yuboring\n\nMisol: @mening_kanalim\n\n⚠️ Bot kanalga admin bo'lishi kerak!\n\n/cancel — bekor qilish"
    );
  } catch (e) {}
});

composer.action(/^ch_type_(private|private_request)$/, async (ctx) => {
  if (!ctx.adminRole) return ctx.answerCbQuery('❌');
  const type = ctx.match[1];
  ctx.session.adminState = { step: 'add_channel_forward', type };
  await ctx.answerCbQuery();
  try {
    await ctx.editMessageText(
      "📤 Kanaldan istalgan xabarni shu botga FORWARD qiling.\n\n" +
      "(Bot shu orqali kanalni avtomatik aniqlaydi)\n\n/cancel — bekor qilish"
    );
  } catch (e) {}
});

// ─── Forward xabarni qabul qilish ───────────────────────────────────
composer.use(async (ctx, next) => {
  if (!ctx.adminRole) return next();
  const state = ctx.session?.adminState;
  if (!state || state.step !== 'add_channel_forward') return next();
  if (!ctx.message) return next();

  const fwdChat = ctx.message.forward_from_chat || ctx.message.forward_origin?.chat;

  if (!fwdChat) {
    return ctx.reply("❌ Bu forward emas. Kanaldan xabarni forward qiling yoki /cancel bosing.");
  }

  const existing = await Channel.findOne({ channelId: fwdChat.id.toString() });
  if (existing) {
    ctx.session.adminState = null;
    return ctx.reply("❌ Bu kanal allaqachon qo'shilgan!");
  }

  state.step = 'add_channel_link';
  state.pendingChannel = {
    channelId: fwdChat.id.toString(),
    title: fwdChat.title || 'Nomsiz kanal'
  };

  await ctx.reply(
    `✅ Kanal aniqlandi: <b>${state.pendingChannel.title}</b>\n\n` +
    `🔗 Endi shu kanalga kirish havolasini yuboring\n` +
    `(O'zingiz Telegram'da yaratgan link, masalan https://t.me/+AbCdEfGh):\n\n/cancel — bekor qilish`,
    { parse_mode: 'HTML' }
  );
});

// ─── Matn handleri (username / link) ────────────────────────────────
composer.on('text', async (ctx, next) => {
  if (!ctx.adminRole) return next();
  const state = ctx.session?.adminState;
  if (!state) return next();

  const text = ctx.message.text.trim();

  if (state.step === 'add_channel_username') {
    try {
      const chat = await ctx.telegram.getChat(text);
      const existing = await Channel.findOne({ channelId: chat.id.toString() });
      if (existing) {
        ctx.session.adminState = null;
        return ctx.reply("❌ Bu kanal allaqachon qo'shilgan!");
      }

      await Channel.create({
        channelId: chat.id.toString(),
        title: chat.title,
        type: 'public',
        username: chat.username ? `@${chat.username}` : text,
        link: chat.username ? `https://t.me/${chat.username}` : ''
      });

      ctx.session.adminState = null;
      await ctx.reply(`✅ <b>${chat.title}</b> kanali qo'shildi!`, { parse_mode: 'HTML' });
    } catch (e) {
      ctx.session.adminState = null;
      await ctx.reply("❌ Kanal topilmadi. Bot kanalga admin ekanini tekshiring!");
    }
    return;
  }

  if (state.step === 'add_channel_link') {
    if (!text.startsWith('http')) {
      return ctx.reply("❌ To'g'ri link kiriting (https:// bilan boshlanishi kerak):");
    }

    const pending = state.pendingChannel;

    await Channel.create({
      channelId: pending.channelId,
      title: pending.title,
      type: state.type,
      inviteLink: text,
      link: text
    });

    ctx.session.adminState = null;

    const extra = state.type === 'private_request'
      ? "\n\n⚠️ Bot kanalda \"Add Members\" huquqiga ega ADMIN bo'lishi shart — aks holda so'rovlarni tasdiqlay olmaydi!"
      : "\n\n⚠️ Bot kanalda ADMIN bo'lishi shart — aks holda obunani tekshira olmaydi!";

    await ctx.reply(
      `✅ <b>${pending.title}</b> qo'shildi! (${typeNames[state.type]})${extra}`,
      { parse_mode: 'HTML' }
    );
    return;
  }

  return next();
});

composer.action('ch_toggle', async (ctx) => {
  if (!ctx.adminRole) return ctx.answerCbQuery('❌');
  const current = await Settings.get('forceSubscribe', false);
  await Settings.set('forceSubscribe', !current);
  await ctx.answerCbQuery(!current ? '✅ Yoqildi' : "❌ O'chirildi");
  await sendChannelMenu(ctx, true);
});

composer.action(/^ch_info_(.+)$/, async (ctx) => {
  if (!ctx.adminRole) return ctx.answerCbQuery('❌');
  const ch = await Channel.findById(ctx.match[1]);
  if (!ch) return ctx.answerCbQuery('❌ Topilmadi');

  await ctx.answerCbQuery();
  try {
    await ctx.editMessageText(
      `${typeEmoji[ch.type] || '📢'} <b>${ch.title}</b>\n\n` +
      `Tur: ${typeNames[ch.type] || "Noma'lum"}\n` +
      (ch.username ? `Username: ${ch.username}\n` : '') +
      `Link: ${ch.link || ch.inviteLink || "yo'q"}`,
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
  } catch (e) {}
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

module.exports = composer;
