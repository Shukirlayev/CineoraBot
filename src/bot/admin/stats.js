const { Composer } = require('telegraf');
const User = require('../../models/User');
const Content = require('../../models/Content');
const SearchRequest = require('../../models/SearchRequest');

const composer = new Composer();

composer.hears('📊 Statistika', async (ctx) => {
  if (!ctx.adminRole) return;

  const now = new Date();

  // Userlar
  const totalUsers = await User.countDocuments();

  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayUsers = await User.countDocuments({ joinedAt: { $gte: todayStart } });

  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - 7);
  const weekUsers = await User.countDocuments({ joinedAt: { $gte: weekStart } });

  const monthStart = new Date(now);
  monthStart.setDate(monthStart.getDate() - 30);
  const monthUsers = await User.countDocuments({ joinedAt: { $gte: monthStart } });

  // Kontentlar
  const movies = await Content.countDocuments({ type: 'movie', isActive: true });
  const serials = await Content.countDocuments({ type: 'serial', isActive: true });
  const anime = await Content.countDocuments({ type: 'anime', isActive: true });
  const totalContent = movies + serials + anime;

  // Eng ko'p ko'rilgan 5 ta
  const topContents = await Content.find({ isActive: true })
    .sort({ viewCount: -1 })
    .limit(5);

  let topText = '';
  topContents.forEach((c, i) => {
    const emoji = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
    topText += `${emoji[i]} ${c.title} — <b>${c.viewCount}</b> marta\n`;
  });

  // Eng ko'p qidirilgan 5 ta so'z
  const topSearches = await SearchRequest.aggregate([
    { $group: { _id: { $toLower: '$query' }, count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 5 }
  ]);

  let searchText = '';
  if (topSearches.length > 0) {
    topSearches.forEach((s, i) => {
      const emoji = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
      searchText += `${emoji[i]} "${s._id}" — ${s.count} marta\n`;
    });
  } else {
    searchText = 'Hozircha qidiruv yo\'q\n';
  }

  // Kutayotgan so'rovlar
  const pendingRequests = await SearchRequest.countDocuments({ notified: false });

  await ctx.reply(
    `📊 <b>Bot Statistikasi</b>\n` +
    `━━━━━━━━━━━━━━━━━━\n\n` +
    `👥 <b>Foydalanuvchilar:</b>\n` +
    `├ Jami: <b>${totalUsers}</b>\n` +
    `├ Bugun: <b>+${todayUsers}</b>\n` +
    `├ Hafta: <b>+${weekUsers}</b>\n` +
    `└ Oy: <b>+${monthUsers}</b>\n\n` +
    `🎬 <b>Kontentlar:</b>\n` +
    `├ Jami: <b>${totalContent}</b>\n` +
    `├ Kinolar: <b>${movies}</b>\n` +
    `├ Seriallar: <b>${serials}</b>\n` +
    `└ Anime: <b>${anime}</b>\n\n` +
    `🏆 <b>Eng ko'p ko'rilganlar:</b>\n` +
    `${topText}\n` +
    `🔍 <b>Eng ko'p qidirilganlar:</b>\n` +
    `${searchText}\n` +
    `📬 Kutayotgan so'rovlar: <b>${pendingRequests}</b>`,
    { parse_mode: 'HTML' }
  );
});

module.exports = composer;
