import mongoose from 'mongoose';
import dns from 'dns';

// Fix Windows/ISP DNS SRV resolution issues for mongodb+srv://
try {
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
} catch (e) {
  // Ignore fallback errors if custom DNS is blocked
}

export async function connectDB() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/wanderloop';
  
  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 8000,
    });
    console.log(`[database]: Successfully connected to MongoDB Atlas host: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.warn(`[database]: Warning - Could not connect to MongoDB Atlas (${error.message}).`);
    console.warn(`[database]: Please check your MONGODB_URI in .env.`);
    return null;
  }
}
