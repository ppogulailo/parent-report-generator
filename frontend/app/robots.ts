import type { MetadataRoute } from 'next';

const SITE_URL = 'https://actionplan.asap-community.org';

// Public locale pages are crawlable; the backend-proxy API routes are not
// (they carry no indexable content and only forward requests to the NestJS
// API). Generated reports live in client state on the locale pages, not at
// their own URLs, so there is no personal/results route to disallow.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: '/api/',
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
