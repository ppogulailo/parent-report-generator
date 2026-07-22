import { NextResponse } from 'next/server';

const NEST_API_URL = process.env.NEST_API_URL ?? 'http://localhost:3000';
const NEST_API_KEY = process.env.NEST_API_KEY;

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

  const target = `${NEST_API_URL}/api/report/generate`;

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
    const detail =
      err instanceof Error
        ? `${err.name}: ${err.message}${(err as any).cause?.code ? ` (${(err as any).cause.code})` : ''}`
        : String(err);

    // Keep the internal target URL + detail in server logs only — never echo
    // the internal hostname back to the client.
    console.error('[proxy] fetch failed', { target, detail });

    return NextResponse.json(
      {
        success: false,
        error: 'Could not reach the report service. Please try again.',
      },
      { status: 502 },
    );
  }
}
