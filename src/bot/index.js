const { Telegraf } = require('telegraf');
const mongoSession = require('../utils/mongoSession');
const User = require('../models/User');
const Content = require('../models/Content');
const { checkSubscription, sendSubscribeMessage } = require('../utils/checkSubscription');
const { mainMenu } = require('../utils/keyboards');
const linksHandler = require('./admin/links');

const startHandler = require('./user/start');
const menuHandler = require('./user/menu');
const searchHandler = require('./user/search');
const favoritesHandler = require('./user/favorites');
const adminHandler = require('./admin');
const broadcastHandler = require('./admin/broadcast');
const requestsHandler = require('./admin/requests');

async function createBot() {
  const bot = new Telegraf(process.env.BOT_TOKEN);

  bot.use(mongoSession());

  // Foydalanuvchini saqlash
  bot.use(async (ctx, next) => {
    if (!ctx.from) return next();
    try {
      await User.findOneAndUpdate(
        { telegramId: ctx.from.id },
        {
          telegramId: ctx.from.id,
          username: ctx.from.username,
          firstName: ctx.from.first_name,
          lastName: ctx.from.last_name
        },
        { upsert: true, new: true }
      );
    } catch (e) {}
    return next();
  });

  bot.use(startHandler);
  bot.use(adminHandler);
  bot.use(linksHandler);
  bot.use(broadcastHandler);
  bot.use(requestsHandler);
  bot.use(menuHandler);
  bot.use(searchHandler);
  bot.use(favoritesHandler);

  // ── /search command — inline qidiruvni ochadi ──────────────
  bot.command('search', async (ctx) => {
    await ctx.reply(
      '🍿 Kinolarni tezkor qidirish uchun quyidagi tugmani bosing:',
      {
        reply_markup: {
          inline_keyboard: [[
            {
              text: '🎬 Qidiruvni boshlash',
              switch_inline_query_current_chat: ''
            }
          ]]
        }
      }
    );
  });

  // ── Inline query ───────────────────────────────────────────
  bot.on('inline_query', async (ctx) => {
    const query = ctx.inlineQuery.query.trim();

    if (!query || query.length < 2) {
      return ctx.answerInlineQuery([], {
        switch_pm_text: '🔍 Kino nomini yozing...',
        switch_pm_parameter: 'search',
        cache_time: 0
      });
    }

    const contents = await Content.find({
      isActive: true,
      $or: [
        { title: { $regex: query, $options: 'i' } },
        { searchTags: { $elemMatch: { $regex: query, $options: 'i' } } }
      ]
    }).sort({ title: 1 }).limit(10);

    if (contents.length === 0) {
      return ctx.answerInlineQuery([], {
        switch_pm_text: `❌ "${query}" topilmadi`,
        switch_pm_parameter: 'search',
        cache_time: 0
      });
    }

    const typeEmoji = { movie: '🎬', serial: '📺', anime: '🎌' };

    const results = contents.map(c => ({
      type: 'article',
      id: c.uniqueId,
      title: `${typeEmoji[c.type]} ${c.title}${c.year ? ` (${c.year})` : ''}`,
      description: c.searchTags?.slice(0, 3).join(', ') || '',
      input_message_content: {
        message_text:
          `${typeEmoji[c.type]} <b>${c.title}</b>${c.year ? ` (${c.year})` : ''}\n\n` +
          `▶️ Ko'rish uchun bosing:`,
        parse_mode: 'HTML'
      },
      reply_markup: {
        inline_keyboard: [[
          {
            text: `▶️ Ko'rish`,
            url: `https://t.me/${process.env.BOT_USERNAME}?start=${c.uniqueId}`
          }
        ]]
      }
    }));

    await ctx.answerInlineQuery(results, { cache_time: 30 });
  });

  // ── chosen_inline_result — tanlangan kontentni yuborish ───
bot.on('chosen_inline_result', async (ctx) => {
  const uniqueId = ctx.chosenInlineResult.result_id;
  const userId = ctx.from.id;

  const content = await Content.findOne({ uniqueId, isActive: true });
  if (!content) return;

  try {
    if (content.type === 'movie' && content.fileId) {
      const caption =
        `🎬 <b>${content.title}</b>` +
        (content.year ? ` (${content.year})` : '') +
        (content.languages?.length ? `\n🌐 ${content.languages.join(' | ')}` : '');

      await ctx.telegram.sendVideo(userId, content.fileId, {
        caption,
        parse_mode: 'HTML'
      });
    } else {
      // Serial/Anime — deeplink
      await ctx.telegram.sendMessage(
        userId,
        `${content.type === 'anime' ? '🎌' : '📺'} <b>${content.title}</b>${content.year ? ` (${content.year})` : ''}\n\nFasllarni ko'rish uchun:`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [[
              {
                text: "▶️ Ko'rish",
                url: `https://t.me/${process.env.BOT_USERNAME}?start=${content.uniqueId}`
              }
            ]]
          }
        }
      );
    }
  } catch (e) {
    console.error('chosen_inline_result xatosi:', e.message);
  }
});


  // ── Obuna tekshirish ───────────────────────────────────────
  bot.action('check_subscribe', async (ctx) => {
    const result = await checkSubscription(ctx);
    if (result === true) {
      await ctx.answerCbQuery('✅ Obuna tasdiqlandi!');
      try { await ctx.deleteMessage(); } catch (e) {}

      if (ctx.session?.pendingDeepLink) {
        const content = await Content.findOne({
          uniqueId: ctx.session.pendingDeepLink,
          isActive: true
        });
        ctx.session.pendingDeepLink = null;
        if (content) {
          const { sendContent } = require('./user/start');
          return sendContent(ctx, content);
        }
      }

      await ctx.reply(
        "✅ Barcha kanallarga obuna bo'lgansiz!\nBotdan foydalanishingiz mumkin.",
        mainMenu
      );
    } else {
      await ctx.answerCbQuery("❌ Hali obuna bo'lmagan kanallar bor!", { show_alert: true });
    }
  });

  bot.catch((err, ctx) => {
    console.error('Bot xatosi:', err.message);
  });

  return bot;
}

module.exports = { createBot };
