import mongoose from 'mongoose';

let isConnected = false;

export default async function connectDB() {
  if (isConnected || mongoose.connection.readyState === 1) {
    return;
  }

  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error('MONGO_URI is missing in your .env file');
  }

  await mongoose.connect(uri);
  isConnected = true;
  console.log('Connected to MongoDB');
}