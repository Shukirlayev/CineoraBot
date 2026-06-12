const mongoose = require('mongoose');

const contentSchema = new mongoose.Schema({
  uniqueId: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  description: String,
  type: { type: String, enum: ['movie', 'serial', 'anime'], required: true },
  year: Number,
  languages: [String],
  searchTags: [String],
  fileId: String,
  viewCount: { type: Number, default: 0 },
  createdBy: Number,
  createdAt: { type: Date, default: Date.now },
  isActive: { type: Boolean, default: true }
});

module.exports = mongoose.model('Content', contentSchema);
