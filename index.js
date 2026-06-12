require('dotenv').config();
const { connectDB } = require('./src/config/db');
const { createBot } = require('./src/bot');

async function main() {
  await connectDB();
  const bot = await createBot();
  await bot.launch();
  console.log('🤖 Bot ishga tushdi!');
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

main().catch(console.error);
