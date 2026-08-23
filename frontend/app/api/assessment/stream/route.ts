import { NextResponse } from 'next/server';

/**
 * Streams the Version 1.0 plan through from the backend.
 *
 * The body is passed straight back rather than read: buffering it here would
 * deliver the whole stream at once and there would be nothing to stream. The API
 * key stays on the server, which is the only reason this hop exists.
 */
const RAW = process.env.NEST_API_URL ?? 'http://localhost:3000';
const NEST_API_URL = RAW.replace(/\/+$/, '');
const NEST_API_KEY = process.env.NEST_API_KEY;

/** A plan can take minutes across three attempts. */
export const maxDuration = 300;
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

  const target = `${NEST_API_URL}/api/assessment/stream`;

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
      return new NextResponse(
        text || JSON.stringify({ success: false, error: 'Upstream error' }),
        {
          status: upstream.status || 502,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        // Without this, a proxy in front of this route buffers the whole
        // response and the stream arrives as one lump at the end.
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (err) {
    console.error('[proxy] assessment stream failed', {
      target,
      detail: err instanceof Error ? `${err.name}: ${err.message}` : String(err),
    });
    return NextResponse.json(
      {
        success: false,
        error: 'Could not reach the report service. Please try again.',
      },
      { status: 502 },
    );
  }
}
