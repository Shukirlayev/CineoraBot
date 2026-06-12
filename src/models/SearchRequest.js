const mongoose = require('mongoose');

const searchRequestSchema = new mongoose.Schema({
  userId: { type: Number, required: true },
  username: String,
  firstName: String,
  query: { type: String, required: true },
  notified: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('SearchRequest', searchRequestSchema);
