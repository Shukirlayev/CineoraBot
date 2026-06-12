const mongoose = require('mongoose');

const favoriteSchema = new mongoose.Schema({
  telegramId: { type: Number, required: true },
  contentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Content', required: true },
  uniqueId: { type: String, required: true },
  addedAt: { type: Date, default: Date.now }
});

favoriteSchema.index({ telegramId: 1, contentId: 1 }, { unique: true });

module.exports = mongoose.model('Favorite', favoriteSchema);
