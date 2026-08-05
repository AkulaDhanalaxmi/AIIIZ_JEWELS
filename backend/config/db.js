const mongoose = require('mongoose');
let connectCalls = 0;

async function connectDB() {
  connectCalls += 1;
  console.log('[DB] connectDB called', { connectCalls, readyState: mongoose.connection.readyState });
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB connected: ${conn.connection.host}`, { readyState: mongoose.connection.readyState });
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  }
}

module.exports = connectDB;
