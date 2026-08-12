import { NextResponse } from 'next/server';
import { requireAuth, publicUser } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const { user, error } = await requireAuth();
  if (error) return error;

  return NextResponse.json({ user: publicUser(user) });
}
