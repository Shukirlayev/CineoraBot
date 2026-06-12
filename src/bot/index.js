const { Telegraf } = require('telegraf');
const { MongoDBAdapter, known } = require('@telegraf/session/mongodb');
const { session } = require('telegraf');
const { MongoClient } = require('mongodb');
const User = require('../models/User');
const Content = require('../models/Content');
const { checkSubscription, sendSubscribeMessage } = require('../utils/checkSubscription');
const { mainMenu } = require('../utils/keyboards');

const startHandler = require('./user/start');
const menuHandler = require('./user/menu');
const searchHandler = require('./user/search');
const adminHandler = require('./admin');
const broadcastHandler = require('./admin/broadcast');

async function createBot() {
  const bot = new Telegraf(process.env.BOT_TOKEN);

  // MongoDB session store
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db();

  bot.use(session({
    store: MongoDBAdapter({ collection: db.collection('sessions') })
  }));

  // Session null bo'lsa initialize qilish
  bot.use((ctx, next) => {
    if (!ctx.session) ctx.session = {};
    return next();
  });

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
  bot.use(broadcastHandler);
  bot.use(menuHandler);
  bot.use(searchHandler);

  // Obunani tekshirish callback
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
