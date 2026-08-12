import mongoose from 'mongoose';

// On Vercel every route handler is a serverless function that can cold-start per
// request. Without caching, each invocation would open a fresh connection and
// exhaust Atlas's connection limit. Stashing it on globalThis also survives the
// module reloads Next does in dev.
let cached = globalThis._mongoose;
if (!cached) {
  cached = globalThis._mongoose = { conn: null, promise: null };
}

export async function connectDB() {
  if (cached.conn) return cached.conn;

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');

  if (!cached.promise) {
    cached.promise = mongoose.connect(uri, {
      bufferCommands: false,
      maxPoolSize: 10,
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (err) {
    cached.promise = null; // let the next request retry instead of caching the failure
    throw err;
  }

  return cached.conn;
}
