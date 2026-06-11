const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  telegramId: { type: Number, required: true, unique: true },
  username: String,
  firstName: String,
  lastName: String,
  joinedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);
