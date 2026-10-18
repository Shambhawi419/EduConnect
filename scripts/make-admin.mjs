// Promotes an existing account to admin.
//
//   npm run make-admin -- you@example.com
//
// Self-registration always creates students, so this is the only way to get an
// admin. It talks to MongoDB directly using MONGODB_URI from .env.local (or the
// environment), so run it from a machine you trust.
import mongoose from 'mongoose';

const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error('Usage: npm run make-admin -- <email>');
  process.exit(1);
}
if (!process.env.MONGODB_URI) {
  console.error('MONGODB_URI is not set (put it in .env.local or the environment).');
  process.exit(1);
}

try {
  await mongoose.connect(process.env.MONGODB_URI);
  const result = await mongoose.connection
    .collection('users')
    .updateOne({ email }, { $set: { role: 'admin' } });

  if (result.matchedCount === 0) {
    console.error(`No account found for ${email}. Register it first, then run this again.`);
    process.exitCode = 1;
  } else {
    console.log(`${email} is now an admin. Existing sessions pick this up on next login/refresh.`);
  }
} finally {
  await mongoose.disconnect();
}
