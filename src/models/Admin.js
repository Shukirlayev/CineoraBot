const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema({
  telegramId: { type: Number, required: true, unique: true },
  username: String,
  firstName: String,
  role: { type: String, enum: ['superadmin', 'admin'], default: 'admin' },
  addedBy: Number,
  addedAt: { type: Date, default: Date.now },
  isActive: { type: Boolean, default: true }
});

module.exports = mongoose.model('Admin', adminSchema);
