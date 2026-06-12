const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  data: { type: mongoose.Schema.Types.Mixed, default: {} },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Session', sessionSchema);
