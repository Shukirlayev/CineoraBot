const Session = require('../models/Session');

function mongoSession() {
  return async (ctx, next) => {
    const key = ctx.from?.id?.toString();
    if (!key) {
      ctx.session = {};
      return next();
    }

    // Sessionni yuklab olish
    let doc = await Session.findOne({ key });
    if (!doc) {
      doc = await Session.create({ key, data: {} });
    }

    ctx.session = doc.data || {};

    await next();

    // Sessionni saqlab qo'yish
    try {
      await Session.findOneAndUpdate(
        { key },
        { data: ctx.session, updatedAt: new Date() },
        { upsert: true }
      );
    } catch (e) {
      console.error('Session saqlashda xato:', e.message);
    }
  };
}

module.exports = mongoSession;
