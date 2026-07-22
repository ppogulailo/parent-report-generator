// Reuse the same generated 1200x630 image for Twitter/X large-summary cards.
// Route config must be declared locally (Next can't statically read re-exported
// config fields); only the renderer and its static metadata are re-exported.
export { alt, size, contentType, default } from './opengraph-image';

export const dynamicParams = false;
export function generateStaticParams() {
  return [{ lang: 'en' }, { lang: 'es' }];
}
