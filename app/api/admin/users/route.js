import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import User from '@/models/User';
import { requireRole } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const { error } = await requireRole('admin');
  if (error) return error;

  try {
    await connectDB();
    const users = await User.find().select('-passwordHash -mfaSecret').lean();
    return NextResponse.json({
      users: users.map((u) => ({
        _id: u._id.toString(),
        name: u.name,
        email: u.email,
        role: u.role,
        mfaEnabled: u.mfaEnabled,
      })),
    });
  } catch (err) {
    console.error('admin users failed:', err);
    return NextResponse.json({ message: 'Could not load users' }, { status: 500 });
  }
}
