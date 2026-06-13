const { Composer } = require('telegraf');
const Content = require('../../models/Content');
const { getDeepLink } = require('../../utils/helpers');

const composer = new Composer();

async function sendLinksList(ctx, type, page = 0) {
  const limit = 30;
  const names = { movie: '🎬 Kinolar', serial: '📺 Seriallar', anime: '🎌 Anime', all: '📋 Hammasi' };
  
  const filter = type === 'all' ? { isActive: true } : { type, isActive: true };
  const total = await Content.countDocuments(filter);
  
  if (total === 0) {
    return ctx.reply('❌ Hozircha kontent mavjud emas.');
  }

  const contents = await Content.find(filter)
    .sort({ title: 1 })
    .skip(page * limit)
    .limit(limit);

  let text = `${names[type]} — linklar ro'yxati\n`;
  text += `━━━━━━━━━━━━━━━━\n\n`;

  contents.forEach((c, i) => {
    const num = page * limit + i + 1;
    const link = getDeepLink(c.uniqueId);
    const typeEmoji = { movie: '🎬', serial: '📺', anime: '🎌' };
    text += `${num}. ${typeEmoji[c.type]} <b>${c.title}</b>${c.year ? ` (${c.year})` : ''}\n`;
    text += `🔗 ${link}\n\n`;
  });

  const totalPages = Math.ceil(total / limit);
  text += `━━━━━━━━━━━━━━━━\n`;
  text += `📊 Jami: ${total} ta | ${page + 1}/${totalPages} sahifa`;

  const nav = [];
  if (page > 0) nav.push({ text: '⬅️', callback_data: `links_${type}_${page - 1}` });
  if ((page + 1) * limit < total) nav.push({ text: '➡️', callback_data: `links_${type}_${page + 1}` });

  const opts = {
    parse_mode: 'HTML',
    reply_markup: nav.length ? { inline_keyboard: [nav] } : undefined,
    disable_web_page_preview: true
  };

  try {
    if (ctx.callbackQuery) {
      await ctx.editMessageText(text, opts);
    } else {
      await ctx.reply(text, opts);
    }
  } catch (e) {
    await ctx.reply(text, opts);
  }
}

// /links command
composer.command('links', async (ctx) => {
  if (!ctx.adminRole) return;

  await ctx.reply('📋 Qaysi turni ko\'rsatay?', {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '🎬 Kinolar', callback_data: 'links_movie_0' },
          { text: '📺 Seriallar', callback_data: 'links_serial_0' }
        ],
        [
          { text: '🎌 Anime', callback_data: 'links_anime_0' },
          { text: '📋 Hammasi', callback_data: 'links_all_0' }
        ]
      ]
    }
  });
});

// Admin menyusidan
composer.hears('🔗 Linklar', async (ctx) => {
  if (!ctx.adminRole) return;

  await ctx.reply('📋 Qaysi turni ko\'rsatay?', {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '🎬 Kinolar', callback_data: 'links_movie_0' },
          { text: '📺 Seriallar', callback_data: 'links_serial_0' }
        ],
        [
          { text: '🎌 Anime', callback_data: 'links_anime_0' },
          { text: '📋 Hammasi', callback_data: 'links_all_0' }
        ]
      ]
    }
  });
});

composer.action(/^links_(movie|serial|anime|all)_(\d+)$/, async (ctx) => {
  if (!ctx.adminRole) return ctx.answerCbQuery('❌');
  await ctx.answerCbQuery();
  await sendLinksList(ctx, ctx.match[1], parseInt(ctx.match[2]));
});

module.exports = composer;
