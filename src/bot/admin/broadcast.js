const { Composer } = require('telegraf');
const User = require('../../models/User');

const composer = new Composer();

// Broadcast menyusi
composer.hears('📣 Broadcast', async (ctx) => {
  if (ctx.adminRole !== 'superadmin') return;

  await ctx.reply(
    '📣 Broadcast xabar yuborish\n\nQanday xabar yubormoqchisiz?',
    {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '✍️ Matn', callback_data: 'bc_text' },
            { text: '🖼 Rasm + Matn', callback_data: 'bc_photo' }
          ],
          [
            { text: '🎥 Video + Matn', callback_data: 'bc_video' },
            { text: '❌ Bekor', callback_data: 'bc_cancel' }
          ]
        ]
      }
    }
  );
});

composer.action('bc_cancel', async (ctx) => {
  if (ctx.adminRole !== 'superadmin') return ctx.answerCbQuery('❌');
  if (ctx.session) ctx.session.broadcastState = null;
  await ctx.answerCbQuery();
  await ctx.editMessageText('❌ Bekor qilindi.');
});

composer.action('bc_text', async (ctx) => {
  if (ctx.adminRole !== 'superadmin') return ctx.answerCbQuery('❌');
  ctx.session.broadcastState = { type: 'text', step: 'enter_message' };
  await ctx.answerCbQuery();
  await ctx.editMessageText(
    '✍️ Yubormoqchi bo\'lgan matnni yozing:\n\n' +
    'HTML formatdan foydalanishingiz mumkin:\n' +
    '<b>qalin</b>, <i>kursiv</i>, <a href="url">link</a>'
  );
});

composer.action('bc_photo', async (ctx) => {
  if (ctx.adminRole !== 'superadmin') return ctx.answerCbQuery('❌');
  ctx.session.broadcastState = { type: 'photo', step: 'enter_media' };
  await ctx.answerCbQuery();
  await ctx.editMessageText('🖼 Rasm yuboring (caption bilan yoki usiz):');
});

composer.action('bc_video', async (ctx) => {
  if (ctx.adminRole !== 'superadmin') return ctx.answerCbQuery('❌');
  ctx.session.broadcastState = { type: 'video', step: 'enter_media' };
  await ctx.answerCbQuery();
  await ctx.editMessageText('🎥 Video yuboring (caption bilan yoki usiz):');
});

// Confirm broadcast
composer.action('bc_confirm', async (ctx) => {
  if (ctx.adminRole !== 'superadmin') return ctx.answerCbQuery('❌');
  const state = ctx.session?.broadcastState;
  if (!state) return ctx.answerCbQuery('❌ Session topilmadi');

  await ctx.answerCbQuery();
  await ctx.editMessageText('📤 Yuborilmoqda...');

  const users = await User.find({}, { telegramId: 1 });
  let success = 0;
  let failed = 0;

  for (const user of users) {
    try {
      if (state.type === 'text') {
        await ctx.telegram.sendMessage(user.telegramId, state.message, {
          parse_mode: 'HTML'
        });
      } else if (state.type === 'photo') {
        await ctx.telegram.sendPhoto(user.telegramId, state.fileId, {
          caption: state.caption || '',
          parse_mode: 'HTML'
        });
      } else if (state.type === 'video') {
        await ctx.telegram.sendVideo(user.telegramId, state.fileId, {
          caption: state.caption || '',
          parse_mode: 'HTML'
        });
      }
      success++;
    } catch (e) {
      failed++;
    }
    // Telegram limit: har 30 ta xabardan keyin 1 soniya kutish
    if ((success + failed) % 30 === 0) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  ctx.session.broadcastState = null;

  await ctx.reply(
    `✅ Broadcast yakunlandi!\n\n` +
    `✅ Muvaffaqiyatli: ${success}\n` +
    `❌ Xato (bot bloklangan): ${failed}\n` +
    `📊 Jami: ${users.length}`
  );
});

composer.action('bc_reject', async (ctx) => {
  if (ctx.adminRole !== 'superadmin') return ctx.answerCbQuery('❌');
  ctx.session.broadcastState = null;
  await ctx.answerCbQuery();
  await ctx.editMessageText('❌ Broadcast bekor qilindi.');
});

// Matn olish
composer.on('text', async (ctx, next) => {
  if (ctx.adminRole !== 'superadmin') return next();
  const state = ctx.session?.broadcastState;
  if (!state || state.step !== 'enter_message') return next();

  const message = ctx.message.text;
  state.message = message;
  state.step = 'confirm';

  await ctx.reply(
    `📋 Preview:\n\n${message}\n\n` +
    `👥 Yuboriladi: barcha foydalanuvchilarga\n\nTasdiqlaysizmi?`,
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '✅ Yuborish', callback_data: 'bc_confirm' },
            { text: '❌ Bekor', callback_data: 'bc_reject' }
          ]
        ]
      }
    }
  );
});

// Rasm olish
composer.on('photo', async (ctx, next) => {
  if (ctx.adminRole !== 'superadmin') return next();
  const state = ctx.session?.broadcastState;
  if (!state || state.type !== 'photo' || state.step !== 'enter_media') return next();

  const photo = ctx.message.photo;
  const fileId = photo[photo.length - 1].file_id;
  const caption = ctx.message.caption || '';

  state.fileId = fileId;
  state.caption = caption;
  state.step = 'confirm';

  await ctx.replyWithPhoto(fileId, {
    caption: `📋 Preview:\n\n${caption}\n\n👥 Barcha userlarga yuboriladi. Tasdiqlaysizmi?`,
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [
          { text: '✅ Yuborish', callback_data: 'bc_confirm' },
          { text: '❌ Bekor', callback_data: 'bc_reject' }
        ]
      ]
    }
  });
});

// Video olish
composer.on('video', async (ctx, next) => {
  if (ctx.adminRole !== 'superadmin') return next();
  const state = ctx.session?.broadcastState;
  if (!state || state.type !== 'video' || state.step !== 'enter_media') return next();

  const fileId = ctx.message.video.file_id;
  const caption = ctx.message.caption || '';

  state.fileId = fileId;
  state.caption = caption;
  state.step = 'confirm';

  await ctx.replyWithVideo(fileId, {
    caption: `📋 Preview:\n\n${caption}\n\n👥 Barcha userlarga yuboriladi. Tasdiqlaysizmi?`,
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [
          { text: '✅ Yuborish', callback_data: 'bc_confirm' },
          { text: '❌ Bekor', callback_data: 'bc_reject' }
        ]
      ]
    }
  });
});

module.exports = composer;
