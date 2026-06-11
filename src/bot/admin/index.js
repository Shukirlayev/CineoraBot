const { Composer } = require('telegraf');
const Admin = require('../../models/Admin');
const { adminMainMenu, mainMenu } = require('../../utils/keyboards');

const contentHandler = require('./content');
const channelsHandler = require('./channels');
const statsHandler = require('./stats');
const adminManageHandler = require('./adminManage');
const settingsHandler = require('./settings');

const composer = new Composer();

async function isAdmin(ctx) {
  const id = ctx.from?.id;
  if (!id) return false;
  if (id.toString() === process.env.SUPER_ADMIN_ID) return 'superadmin';
  const admin = await Admin.findOne({ telegramId: id, isActive: true });
  return admin ? admin.role : false;
}

// ctx.adminRole ni set qilish
composer.use(async (ctx, next) => {
  ctx.adminRole = await isAdmin(ctx);
  return next();
});

composer.command('admin', async (ctx) => {
  if (!ctx.adminRole) return;
  await ctx.reply(
    `👨‍💼 Admin panelga xush kelibsiz!\n\nRol: <b>${ctx.adminRole === 'superadmin' ? '👑 Super Admin' : '🔧 Admin'}</b>`,
    { parse_mode: 'HTML', ...adminMainMenu }
  );
});

composer.hears('🔙 Foydalanuvchi menyusi', async (ctx) => {
  if (!ctx.adminRole) return;
  await ctx.reply('👤 Foydalanuvchi menyusi:', mainMenu);
});

composer.use(contentHandler);
composer.use(channelsHandler);
composer.use(adminManageHandler);
composer.use(settingsHandler);
composer.use(statsHandler); // Statistika faqat admin panel uchun ishlashi ta'minlandi

module.exports = composer;
module.exports.isAdmin = isAdmin;
