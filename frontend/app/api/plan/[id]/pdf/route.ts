import { NextResponse } from 'next/server';

/** Streams the plan's PDF through, preserving the filename the API set. */
const NEST_API_URL = process.env.NEST_API_URL ?? 'http://localhost:3000';
const NEST_API_KEY = process.env.NEST_API_KEY;

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
/** Chromium renders on demand; give a cold start room. */
export const maxDuration = 60;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  if (!NEST_API_KEY) {
    return NextResponse.json(
      { success: false, error: 'NEST_API_KEY is not configured on the server.' },
      { status: 500 },
    );
  }
  if (!UUID.test(id)) {
    return NextResponse.json(
      { success: false, error: 'Not found.' },
      { status: 404 },
    );
  }

  const target = `${NEST_API_URL}/api/assessment/plan/${id}/pdf`;
  try {
    const upstream = await fetch(target, {
      headers: { 'X-API-Key': NEST_API_KEY },
      cache: 'no-store',
    });

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => '');
      return new NextResponse(
        text || JSON.stringify({ success: false, error: 'Download failed.' }),
        { status: upstream.status, headers: { 'Content-Type': 'application/json' } },
      );
    }

    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': upstream.headers.get('content-type') ?? 'application/pdf',
        'Content-Disposition':
          upstream.headers.get('content-disposition') ?? 'attachment',
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (err) {
    console.error('[proxy] plan pdf failed', {
      target,
      detail: err instanceof Error ? `${err.name}: ${err.message}` : String(err),
    });
    return NextResponse.json(
      { success: false, error: 'Could not reach the report service. Please try again.' },
      { status: 502 },
    );
  }
}
