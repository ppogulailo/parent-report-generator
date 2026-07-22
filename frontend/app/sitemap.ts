import type { MetadataRoute } from 'next';

const SITE_URL = 'https://actionplan.asapcommunity.org';

// Only the two public locale landing/tool pages are indexable. There is no
// separate report/results URL — a generated plan is client-side state on the
// same page and is never addressable, so nothing personal can be crawled.
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    {
      url: `${SITE_URL}/en`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 1,
      alternates: {
        languages: {
          en: `${SITE_URL}/en`,
          es: `${SITE_URL}/es`,
        },
      },
    },
    {
      url: `${SITE_URL}/es`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 1,
      alternates: {
        languages: {
          en: `${SITE_URL}/en`,
          es: `${SITE_URL}/es`,
        },
      },
    },
  ];
}
