function generateUniqueId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function getDeepLink(uniqueId) {
  return `https://t.me/${process.env.BOT_USERNAME}?start=${uniqueId}`;
}

module.exports = { generateUniqueId, getDeepLink };
