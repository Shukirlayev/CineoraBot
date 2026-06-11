const mongoose = require('mongoose');

const episodeSchema = new mongoose.Schema({
  contentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Content', required: true },
  seasonId: { type: mongoose.Schema.Types.ObjectId, ref: 'Season', required: true },
  episodeNumber: { type: Number, required: true },
  title: String,
  fileId: { type: String, required: true },
  quality: String,
  language: String,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Episode', episodeSchema);
