'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[page-error]', error);
  }, [error]);

  return (
    <main style={{ padding: '2rem', textAlign: 'center' }}>
      <p style={{ marginBottom: '1rem' }}>
        Something went wrong loading the page.
      </p>
      <button type="button" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
