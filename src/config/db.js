const mongoose = require('mongoose');

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB ulandi!');
  } catch (error) {
    console.error('❌ MongoDB xatosi:', error);
    process.exit(1);
  }
}

module.exports = { connectDB };
