import { NextResponse } from 'next/server';

const RAW_NEST_API_URL = process.env.NEST_API_URL ?? 'http://localhost:3000';
const NEST_API_URL = RAW_NEST_API_URL.replace(/\/+$/, '');
const NEST_API_KEY = process.env.NEST_API_KEY;

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!NEST_API_KEY) {
    return NextResponse.json(
      { success: false, error: 'NEST_API_KEY is not configured on the server.' },
      { status: 500 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body.' },
      { status: 400 },
    );
  }

  const target = `${NEST_API_URL}/api/report/generate/stream`;

  try {
    const upstream = await fetch(target, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        'X-API-Key': NEST_API_KEY,
      },
      body: JSON.stringify(body),
    });

    if (!upstream.ok || !upstream.body) {
      const text = await upstream.text().catch(() => '');
      return new NextResponse(text || JSON.stringify({ success: false, error: 'Upstream error' }), {
        status: upstream.status || 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (err) {
    const detail =
      err instanceof Error
        ? `${err.name}: ${err.message}${(err as any).cause?.code ? ` (${(err as any).cause.code})` : ''}`
        : String(err);

    console.error('[proxy-stream] fetch failed', { target, detail });

    return NextResponse.json(
      {
        success: false,
        error: `Could not reach NestJS API at ${target} — ${detail}`,
      },
      { status: 502 },
    );
  }
}
