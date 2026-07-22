import { NextResponse, type NextRequest } from 'next/server';

// English is the default language on EVERY open (primary rollout). A parent who
// wants Spanish switches manually via the in-app language toggle (which
// navigates to /es); the default is always English — we do NOT persist Spanish
// across visits and do NOT infer it from Accept-Language.
//
// The <html lang> and per-locale metadata are now derived from the [lang]
// route param in app/[lang]/layout.tsx, so middleware no longer needs to pass a
// header for that. Its only job is to send the bare root to the English locale.
export function middleware(req: NextRequest) {
  return NextResponse.redirect(new URL('/en', req.url));
}

export const config = {
  // Root only. Locale-prefixed routes (/en, /es) are served directly; any
  // other non-locale path falls through to app/[lang], which redirects
  // unsupported locales to /en.
  matcher: ['/'],
};
