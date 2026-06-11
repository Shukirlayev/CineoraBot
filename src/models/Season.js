const mongoose = require('mongoose');

const seasonSchema = new mongoose.Schema({
  contentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Content', required: true },
  seasonNumber: { type: Number, required: true },
  title: String,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Season', seasonSchema);
