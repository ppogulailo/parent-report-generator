import { NextResponse } from 'next/server';

/**
 * The saved plan's proxy: GET reads it, DELETE is the parent's
 * delete-my-data action (Milestone 5). The plan id in the path is the
 * capability — an unguessable UUID only the family's browser ever saw — and
 * the API key stays on the server, which is the only reason this proxy exists.
 */
const NEST_API_URL = process.env.NEST_API_URL ?? 'http://localhost:3000';
const NEST_API_KEY = process.env.NEST_API_KEY;

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function misconfigured(): NextResponse {
  return NextResponse.json(
    { success: false, error: 'NEST_API_KEY is not configured on the server.' },
    { status: 500 },
  );
}

function notFound(): NextResponse {
  return NextResponse.json(
    { success: false, error: 'Not found.' },
    { status: 404 },
  );
}

async function forward(
  id: string,
  method: 'GET' | 'DELETE',
): Promise<NextResponse> {
  if (!NEST_API_KEY) return misconfigured();
  if (!UUID.test(id)) return notFound();

  const target = `${NEST_API_URL}/api/assessment/plan/${id}`;
  try {
    const upstream = await fetch(target, {
      method,
      headers: { 'X-API-Key': NEST_API_KEY },
      cache: 'no-store',
    });
    const text = await upstream.text();
    return new NextResponse(text, {
      status: upstream.status,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (err) {
    console.error('[proxy] plan request failed', {
      target,
      detail: err instanceof Error ? `${err.name}: ${err.message}` : String(err),
    });
    return NextResponse.json(
      { success: false, error: 'Could not reach the report service. Please try again.' },
      { status: 502 },
    );
  }
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  return forward(id, 'GET');
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  return forward(id, 'DELETE');
}
