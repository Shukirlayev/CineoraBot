const mongoose = require('mongoose');

const joinRequestSchema = new mongoose.Schema({
  channelId: { type: String, required: true },
  userId: { type: Number, required: true },
  status: { type: String, default: 'approved' },
  approvedAt: { type: Date, default: Date.now }
});

joinRequestSchema.index({ channelId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('JoinRequest', joinRequestSchema);
