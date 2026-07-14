import { NextResponse, type NextRequest } from 'next/server';

// Expose the active route locale to the root layout (via a request header) so
// the server-rendered <html lang="…"> matches the language the user actually
// sees — the single source of truth. Without this the root layout hardcodes
// lang="en" even on /es, declaring English for a Spanish document, which is
// what prompts browsers to offer/auto-translate the page.
const SUPPORTED = ['en', 'es'] as const;

export function middleware(req: NextRequest) {
  const seg = req.nextUrl.pathname.split('/')[1];
  const lang = (SUPPORTED as readonly string[]).includes(seg) ? seg : 'en';
  const headers = new Headers(req.headers);
  headers.set('x-lang', lang);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  // Page routes only — skip _next assets, the API proxies, and any file with
  // an extension (icons, etc.).
  matcher: ['/((?!_next/|api/|.*\\..*).*)'],
};
