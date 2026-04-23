import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Fly.io health check hits this. Must return 2xx and must not redirect —
// the landing page at `/` returns 307 to `/en`, which is what broke the
// previous check.
export function GET() {
  return NextResponse.json({ status: 'ok' });
}
