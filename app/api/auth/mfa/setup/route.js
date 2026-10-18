import { NextResponse } from 'next/server';
import speakeasy from 'speakeasy';
import qrcode from 'qrcode';
import { requireAuth } from '@/lib/auth';
import { requireCsrf } from '@/lib/csrf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  const csrfError = await requireCsrf(request);
  if (csrfError) return csrfError;

  const { user, error } = await requireAuth();
  if (error) return error;

  // Replacing the secret of an account that already has MFA on would lock the
  // real owner out of their authenticator app. They must disable MFA first.
  if (user.mfaEnabled) {
    return NextResponse.json(
      { message: 'MFA is already enabled. Disable it before setting it up again.' },
      { status: 400 }
    );
  }

  try {
    const secret = speakeasy.generateSecret({ name: `EduConnect (${user.email})` });

    user.mfaSecret = secret.base32;
    await user.save();

    const qrDataUrl = await qrcode.toDataURL(secret.otpauth_url);
    return NextResponse.json({ qrDataUrl, secret: secret.base32 });
  } catch (err) {
    console.error('mfa setup failed:', err);
    return NextResponse.json({ message: 'Failed to start MFA setup' }, { status: 500 });
  }
}
