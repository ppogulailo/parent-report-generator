'use client';

import { useEffect } from 'react';

// A stale frontend deploy leaves cached HTML pointing at JS chunks that no
// longer exist on the server. The next navigation/render throws a
// ChunkLoadError, which surfaces here. A full reload re-fetches the current
// bundle and clears it — a plain reset() would just re-throw on the same
// stale state.
function isChunkLoadError(error: Error): boolean {
  return (
    error.name === 'ChunkLoadError' ||
    /Loading chunk [\d]+ failed/i.test(error.message) ||
    /Failed to fetch dynamically imported module/i.test(error.message)
  );
}

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surfaced in the browser console so a real occurrence is diagnosable.
    console.error('[page-error]', error, { digest: error.digest });

    if (isChunkLoadError(error)) {
      // Auto-recover from a stale bundle: reload once to pull current chunks.
      window.location.reload();
    }
  }, [error]);

  return (
    <main style={{ padding: '2rem', maxWidth: 560, margin: '0 auto' }}>
      <p style={{ marginBottom: '1rem' }}>
        Something went wrong loading the page.
      </p>

      {error.message && (
        <pre
          style={{
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            background: '#f5f5f5',
            border: '1px solid #e0e0e0',
            borderRadius: 6,
            padding: '0.75rem',
            fontSize: '0.8rem',
            marginBottom: '1rem',
            textAlign: 'left',
          }}
        >
          {error.message}
          {error.digest ? `\n\n(ref: ${error.digest})` : ''}
        </pre>
      )}

      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
        <button type="button" onClick={reset}>
          Try again
        </button>
        <button type="button" onClick={() => window.location.reload()}>
          Reload page
        </button>
      </div>
    </main>
  );
}
