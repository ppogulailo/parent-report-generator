import * as http from 'http';

/**
 * A mock model for the Version 1.0 pipeline.
 *
 * Unlike the mock for the old endpoint, this one cannot return a fixed body. The
 * response schema is built per request from the ids the matrix selected, so a
 * canned reply would fail validation for reasons that have nothing to do with
 * what a test is checking. Instead it **reads the prompt** and answers it:
 * section keys, recommendation ids and workshop ids all come back out of the
 * text the prompt builder produced.
 *
 * That has a useful side effect. If the prompt ever stops naming the ids the
 * model is supposed to use, every test here fails — so the mock doubles as an
 * assertion that the prompt actually carries the selection.
 *
 * `mode` makes the failure paths reachable. Real models fail intermittently and
 * unreproducibly; these are the same failures on demand.
 */

export type MockMode =
  /** Answer the prompt correctly. */
  | 'valid'
  /** Violate a wording rule on the first attempt, comply on the retry. */
  | 'wording-then-fixed'
  /** Violate a wording rule on every attempt. */
  | 'wording-always'
  /** Cite a workshop the matrix did not select. */
  | 'invents-workshop'
  /** Omit one of the selected priority areas. */
  | 'omits-recommendation'
  /** Write one of the static sections the platform owns. */
  | 'writes-static-section'
  /** Return prose instead of JSON. */
  | 'not-json'
  /**
   * Answer correctly, but slowly, spacing the frames out.
   *
   * The mock is otherwise instant, which makes "the results screen appears
   * before the plan is written" impossible to observe — the whole plan arrives
   * inside one animation frame. This mode is what lets that claim be tested.
   */
  | 'slow';

interface ParsedPrompt {
  sections: { key: string; kind: string; count: number }[];
  recommendationIds: string[];
  workshopIds: string[];
}

/** Pulls the contract back out of the assembled user prompt. */
export function parsePrompt(userPrompt: string): ParsedPrompt {
  const recommendationIds = [...userPrompt.matchAll(/^\d+\. id: (\S+)$/gm)].map(
    (m) => m[1],
  );

  const workshopIds = [...userPrompt.matchAll(/^- id: (\S+)$/gm)].map(
    (m) => m[1],
  );

  const sections: ParsedPrompt['sections'] = [];
  // Each section block starts `- "key" — Title` and runs to the next blank line.
  //
  // No `m` flag, deliberately. With it, `$` matches end-of-LINE, so the body
  // capture stopped after the first line and every section looked like prose —
  // which then failed the schema for reasons that had nothing to do with the
  // code under test. `(?:^|\n)` does the line-start job instead.
  for (const match of userPrompt.matchAll(
    /(?:^|\n)- "([A-Za-z0-9]+)" — [^\n]*\n([\s\S]*?)(?=\n\n|$)/g,
  )) {
    const key = match[1];
    const body = match[2];

    let kind = 'prose';
    let count = 1;

    if (body.includes('"recommendationId"')) kind = 'recommendationList';
    else if (body.includes('"workshopId"')) kind = 'workshopList';
    else {
      const exact = body.match(/array of exactly (\d+) strings/);
      const range = body.match(/array of (\d+) to (\d+) strings/);
      if (exact) {
        kind = 'list';
        count = Number(exact[1]);
      } else if (range) {
        kind = 'list';
        count = Number(range[1]);
      }
    }

    sections.push({ key, kind, count });
  }

  return { sections, recommendationIds, workshopIds };
}

/**
 * Prose with no trigger words and no banned vocabulary, so a valid response
 * passes every check for the right reason rather than by luck.
 *
 * Deliberately avoids: "therapist"/"professional help" (would require the
 * professional-help sequence), "search"/"backpack" (would require the
 * private-search line), the banned corporate vocabulary, and any answer label
 * long enough to trip the quoting rule.
 */
const NEUTRAL = 'What you described points at a clear next step this week.';

/** Mentions a clinician without the required sequence — a wording violation. */
const VIOLATING = 'Bring in an ASAP-endorsed therapist this week.';

function buildValidBody(
  parsed: ParsedPrompt,
  mode: MockMode,
  isRetry: boolean,
): Record<string, unknown> {
  const violate =
    mode === 'wording-always' || (mode === 'wording-then-fixed' && !isRetry);

  const out: Record<string, unknown> = {};

  for (const section of parsed.sections) {
    switch (section.kind) {
      case 'list':
        out[section.key] = Array.from(
          { length: section.count },
          (_, i) => `${NEUTRAL} (${i + 1})`,
        );
        break;

      case 'recommendationList': {
        const ids =
          mode === 'omits-recommendation'
            ? parsed.recommendationIds.slice(0, -1)
            : parsed.recommendationIds;
        out[section.key] = ids.map((id) => ({
          recommendationId: id,
          headline: 'A concrete step',
          body: NEUTRAL,
        }));
        break;
      }

      case 'workshopList': {
        const items = parsed.workshopIds.map((id) => ({
          workshopId: id,
          whyThisFamily: NEUTRAL,
        }));
        if (mode === 'invents-workshop') {
          items.push({
            workshopId: 'aux-early-warning-signs-identifying-substance-use',
            whyThisFamily: 'Invented by the model.',
          });
        }
        out[section.key] = items;
        break;
      }

      default:
        out[section.key] = violate ? VIOLATING : NEUTRAL;
        break;
    }
  }

  if (mode === 'writes-static-section') {
    out.universalGuidingPrinciple = 'My own take on the guiding principle.';
  }

  return out;
}

export interface MockLlm {
  server: http.Server;
  port: number;
  setMode(mode: MockMode): void;
  lastPrompt(): { system: string; user: string; turns: number } | null;
  requestCount(): number;
  reset(): void;
}

export async function startMockLlm(port: number): Promise<MockLlm> {
  let mode: MockMode = 'valid';
  let last: { system: string; user: string; turns: number } | null = null;
  let requests = 0;

  const server = http.createServer((req, res) => {
    // Control channel. The mock lives in the Playwright setup process and the
    // tests run in workers, so "make the model misbehave" has to travel over
    // HTTP like everything else.
    if (req.url?.startsWith('/_')) {
      const json = (status: number, payload: unknown): void => {
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(payload));
      };

      if (req.url === '/_last') return json(200, last);
      if (req.url === '/_count') return json(200, { requests });
      if (req.url === '/_reset') {
        mode = 'valid';
        last = null;
        requests = 0;
        return json(200, { ok: true });
      }
      if (req.url.startsWith('/_mode/')) {
        mode = req.url.slice('/_mode/'.length) as MockMode;
        return json(200, { mode });
      }
      return json(404, { error: 'unknown control route' });
    }

    // Buffer bytes and decode once: concatenating chunk.toString() corrupts a
    // multi-byte character that straddles a chunk boundary, which in Spanish is
    // most of them.
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');

      let body: {
        messages?: { role: string; content: string }[];
        response_format?: { type: string };
        stream?: boolean;
      } = {};
      try {
        body = raw ? JSON.parse(raw) : {};
      } catch {
        // Fall through: a malformed request is itself worth failing a test on.
      }

      const messages = body.messages ?? [];
      const system = messages.find((m) => m.role === 'system')?.content ?? '';
      const user = messages.find((m) => m.role === 'user')?.content ?? '';
      const isRetry = messages.length > 2;

      requests += 1;
      last = { system, user, turns: messages.length };

      const content =
        mode === 'not-json'
          ? 'Here is your plan, in prose, as no one asked.'
          : JSON.stringify(buildValidBody(parsePrompt(user), mode, isRetry));

      // The streaming path asks for SSE. Answering it with a single JSON body
      // leaves the client waiting for `data:` frames that never arrive — which
      // is exactly what happened the first time this was written, and it looked
      // like a bug in the reader rather than in the mock.
      if (body.stream) {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
        });

        const frame = (delta: string): void => {
          res.write(
            'data: ' +
              JSON.stringify({
                choices: [{ delta: { content: delta }, finish_reason: null }],
              }) +
              '\n\n',
          );
        };

        // Chunked mid-value on purpose: a stream that only ever split on section
        // boundaries would never exercise the partial-JSON parser, which is the
        // part most likely to be wrong.
        const size = 180;
        const chunks: string[] = [];
        for (let at = 0; at < content.length; at += size) {
          chunks.push(content.slice(at, at + size));
        }

        const finish = (): void => {
          res.write(
            'data: ' +
              JSON.stringify({
                choices: [{ delta: {}, finish_reason: 'stop' }],
              }) +
              '\n\n',
          );
          res.write('data: [DONE]\n\n');
          res.end();
        };

        if (mode === 'slow') {
          let index = 0;
          const tick = setInterval(() => {
            const next = chunks[index++];
            if (next === undefined) {
              clearInterval(tick);
              finish();
              return;
            }
            frame(next);
          }, 300);
          return;
        }

        for (const chunk of chunks) frame(chunk);
        finish();
        return;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          choices: [
            { message: { role: 'assistant', content }, finish_reason: 'stop' },
          ],
        }),
      );
    });
  });

  await new Promise<void>((resolve) => server.listen(port, resolve));

  return {
    server,
    port,
    setMode: (next) => {
      mode = next;
    },
    lastPrompt: () => last,
    requestCount: () => requests,
    reset: () => {
      mode = 'valid';
      last = null;
      requests = 0;
    },
  };
}
