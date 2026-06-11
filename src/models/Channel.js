const mongoose = require('mongoose');

const channelSchema = new mongoose.Schema({
  channelId: { type: String, required: true, unique: true },
  title: String,
  username: String,
  link: String,
  isActive: { type: Boolean, default: true },
  addedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Channel', channelSchema);
