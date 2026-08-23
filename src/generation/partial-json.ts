/**
 * Reads whatever is already complete inside an incomplete JSON object.
 *
 * The model streams one JSON object over tens of seconds. A parent should watch
 * their plan being written rather than a spinner, which means rendering the
 * sections that have finished while the rest are still arriving — and half a
 * JSON document is not parseable.
 *
 * Fields arrive one at a time, so an object inside an array can come back
 * half-filled — a recommendation with its headline but not yet its body. That is
 * deliberate: showing the headline the moment it exists is the point. Consumers
 * must tolerate missing fields.
 *
 * **Nothing this returns is authoritative.** The report is the object parsed and
 * schema-checked after the stream closes; this is progress only. A partial parse
 * must never decide anything — that is the line that keeps the matrix
 * authoritative, and the same rule Sustaining Recovery follows.
 */

interface Frame {
  /** The bracket that closes this container. */
  close: '}' | ']';
  object: boolean;
  /** Inside an object, whether the next string is a key or a value. */
  expecting: 'key' | 'value';
}

/**
 * The longest prefix of `text` that is valid JSON once its open containers are
 * closed.
 *
 * The state machine tracks key-versus-value because the two truncate
 * differently: `{"a":"one"` must keep `a`, while `{"a":"one","b"` must drop the
 * dangling `b`. A parser that treated every closed string alike either dropped
 * finished values or produced `{"a":"one","b"}`, which is not JSON.
 */
export function parsePartialJson(text: string): Record<string, unknown> {
  const start = text.indexOf('{');
  if (start === -1) return {};
  const body = text.slice(start);

  // It may already be complete: the last chunk of a stream usually is.
  const whole = tryParse(body);
  if (whole) return whole;

  const stack: Frame[] = [];
  let inString = false;
  let escaped = false;
  /** Index just past the last point where the document was between entries. */
  let safeEnd = -1;
  let safeDepth = 0;

  const markSafe = (index: number): void => {
    safeEnd = index;
    safeDepth = stack.length;
  };

  for (let i = 0; i < body.length; i++) {
    const char = body[i];
    const top = stack[stack.length - 1];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
        // A key is not a safe stopping point — the value it introduces has not
        // arrived. A value, or an array element, is.
        if (top && top.object && top.expecting === 'key') {
          // Wait for the colon and the value.
        } else {
          markSafe(i + 1);
        }
      }
      continue;
    }

    switch (char) {
      case '"':
        inString = true;
        break;
      case '{':
        stack.push({ close: '}', object: true, expecting: 'key' });
        break;
      case '[':
        stack.push({ close: ']', object: false, expecting: 'value' });
        break;
      case '}':
      case ']':
        stack.pop();
        markSafe(i + 1);
        break;
      case ':':
        if (top?.object) top.expecting = 'value';
        break;
      case ',':
        // Everything before the comma is complete; the comma itself is not part
        // of a valid document once truncated here.
        markSafe(i);
        if (top?.object) top.expecting = 'key';
        break;
      default:
        break;
    }
  }

  if (safeEnd <= 0) return {};

  const candidate =
    body.slice(0, safeEnd).replace(/,\s*$/, '') +
    // Close what is still open, innermost first.
    stack
      .slice(0, safeDepth)
      .reverse()
      .map((frame) => frame.close)
      .join('');

  return tryParse(candidate) ?? {};
}

function tryParse(text: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(text);
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}
