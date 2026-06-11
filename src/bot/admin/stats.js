const { Composer } = require('telegraf');
const User = require('../../models/User');
const Content = require('../../models/Content');

const composer = new Composer();

composer.hears('📊 Statistika', async (ctx) => {
  if (!ctx.adminRole) return;

  const totalUsers = await User.countDocuments();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayUsers = await User.countDocuments({ joinedAt: { $gte: todayStart } });

  const movies = await Content.countDocuments({ type: 'movie', isActive: true });
  const serials = await Content.countDocuments({ type: 'serial', isActive: true });
  const anime = await Content.countDocuments({ type: 'anime', isActive: true });

  const top = await Content.find({ isActive: true })
    .sort({ viewCount: -1 })
    .limit(5);

  let topText = '';
  top.forEach((c, i) => {
    topText += `${i + 1}. ${c.title} — ${c.viewCount} marta\n`;
  });

  await ctx.reply(
    `📊 <b>Bot Statistikasi</b>\n\n` +
    `👥 <b>Foydalanuvchilar:</b>\n` +
    `├ Jami: ${totalUsers}\n` +
    `└ Bugun: +${todayUsers}\n\n` +
    `🎬 <b>Kontentlar:</b>\n` +
    `├ Kinolar: ${movies}\n` +
    `├ Seriallar: ${serials}\n` +
    `└ Anime: ${anime}\n\n` +
    `🏆 <b>Eng ko'p ko'rilganlar:</b>\n` + topText,
    { parse_mode: 'HTML' }
  );
});

module.exports = composer;
