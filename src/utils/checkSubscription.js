const Channel = require('../models/Channel');
const Settings = require('../models/Settings');
const JoinRequest = require('../models/JoinRequest');

async function checkSubscription(ctx) {
  const forceSubscribe = await Settings.get('forceSubscribe', false);
  if (!forceSubscribe) return true;

  const channels = await Channel.find({ isActive: true });
  if (channels.length === 0) return true;

  const userId = ctx.from.id;
  const notSubscribed = [];

  for (const channel of channels) {
    let subscribed = false;

    if (channel.type === 'private_request') {
      const approved = await JoinRequest.findOne({ channelId: channel.channelId, userId });
      if (approved) {
        subscribed = true;
      } else {
        try {
          const member = await ctx.telegram.getChatMember(channel.channelId, userId);
          if (!['left', 'kicked'].includes(member.status)) subscribed = true;
        } catch (e) {}
      }
    } else {
      try {
        const member = await ctx.telegram.getChatMember(channel.channelId, userId);
        if (!['left', 'kicked'].includes(member.status)) subscribed = true;
      } catch (e) {}
    }

    if (!subscribed) notSubscribed.push(channel);
  }

  return notSubscribed.length === 0 ? true : notSubscribed;
}

async function sendSubscribeMessage(ctx, notSubscribed) {
  const buttons = notSubscribed.map(ch => {
    const url = ch.type === 'public'
      ? (ch.link || `https://t.me/${ch.username?.replace('@', '')}`)
      : ch.inviteLink;

    return [{ text: `📢 ${ch.title || ch.username}`, url }];
  });

  buttons.push([{ text: '✅ Obunani tekshirish', callback_data: 'check_subscribe' }]);

  await ctx.reply("❌ Botdan foydalanish uchun quyidagi kanallarga obuna bo'ling:", {
    reply_markup: { inline_keyboard: buttons }
  });
}

module.exports = { checkSubscription, sendSubscribeMessage };
