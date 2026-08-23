/**
 * The public origin, in one place.
 *
 * It was duplicated across `layout.tsx`, `robots.ts` and `sitemap.ts`, which is
 * three files to remember on the day the hostname changes — and a canonical URL
 * pointing at a host that does not resolve is invisible in testing and costly in
 * search.
 *
 * **The default is the host that currently resolves**, not the intended one.
 * `monitoring.asapcommunity.org` needs a DNS record in an account we do not
 * control; until that exists, defaulting to it would point every canonical,
 * hreflang and sitemap entry at a dead domain. That mistake has already been
 * made and reverted once here.
 *
 * To switch at launch, set `NEXT_PUBLIC_SITE_URL`. Because it is a
 * `NEXT_PUBLIC_*` value it is inlined at build time, so it needs BOTH a
 * `[build.args]` entry in `fly.toml` AND an `ARG` line in the Dockerfile — a
 * build arg with no `ARG` to receive it is silently dropped, and the feature it
 * gates simply does not exist in production.
 */
const FALLBACK = 'https://actionplan.asap-community.org';

const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();

export const SITE_URL = (configured || FALLBACK).replace(/\/+$/, '');

/** True while the site is served from the pre-launch hostname. */
export const IS_PRELAUNCH_HOST = SITE_URL === FALLBACK;

/**
 * Whether `/[lang]` serves the Version 1.0 flow.
 *
 * Off by default: the existing questionnaire keeps serving parents until V1 has
 * been exercised against a real model and Dave has approved the matrix. Setting
 * this is the launch switch, and unsetting it is the way back.
 */
export const V1_IS_DEFAULT = process.env.NEXT_PUBLIC_V1_DEFAULT === '1';
