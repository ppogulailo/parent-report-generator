import { NextResponse } from 'next/server';

/**
 * Proxy to the Version 1.0 backend endpoint.
 *
 * Separate from `api/report/route.ts`, which proxies the pre-existing streaming
 * endpoint and is still what the live questionnaire uses. Both exist only until
 * the questionnaire migrates; see LAUNCH-READINESS.md.
 *
 * The API key lives on the server and is never sent to the browser, which is the
 * only reason this proxy exists at all.
 */
const NEST_API_URL = process.env.NEST_API_URL ?? 'http://localhost:3000';
const NEST_API_KEY = process.env.NEST_API_KEY;

/** Generation takes tens of seconds across fourteen sections, and may retry. */
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

  const target = `${NEST_API_URL}/api/assessment/submit`;

  try {
    const upstream = await fetch(target, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': NEST_API_KEY,
      },
      body: JSON.stringify(body),
    });

    const text = await upstream.text();
    return new NextResponse(text, {
      status: upstream.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    // The internal hostname stays in server logs and never reaches the browser.
    console.error('[proxy] assessment submit failed', {
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
