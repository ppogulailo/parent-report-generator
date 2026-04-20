import { QUESTIONS } from './questions';

export function buildUserPrompt(
  domainScores: Record<string, number>,
  topDomains: string[],
  responses?: number[],
): string {
  const scoreLines = [
    `- Immediate Safety & Urgency: ${domainScores['Immediate Safety & Urgency'].toFixed(2)}`,
    `- Household Structure: ${domainScores['Household Structure'].toFixed(2)}`,
    `- Boundary Consistency: ${domainScores['Boundary Consistency'].toFixed(2)}`,
    `- Communication & Conflict: ${domainScores['Communication & Conflict'].toFixed(2)}`,
    `- Support & Professional Engagement: ${domainScores['Support & Professional Engagement'].toFixed(2)}`,
  ].join('\n');

  let contextBlock = '';

  if (responses && responses.length === 24) {
    const concerns = responses
      .map((val, i) => (val === 4 ? `- ${QUESTIONS[i]}` : null))
      .filter(Boolean);
    const strengths = responses
      .map((val, i) => (val === 1 ? `- ${QUESTIONS[i]}` : null))
      .filter(Boolean);

    if (concerns.length > 0) {
      contextBlock += `\n\nStrong concerns (scored 4 — address these directly):\n${concerns.join('\n')}`;
    }
    if (strengths.length > 0) {
      contextBlock += `\n\nStrengths (scored 1 — acknowledge briefly):\n${strengths.join('\n')}`;
    }
  }

  return `Domain Scores:
${scoreLines}

Top 3 Priority Domains: ${topDomains[0]}, ${topDomains[1]}, ${topDomains[2]}${contextBlock}

Reminders before you write:
- This plan is a continuation of the parent's ASAP Community work — not a standalone report. Anchor recommendations in ASAP resources in this order: Articles of Action (by TOPIC only — no chapter numbers) → ASAP Discussion Groups (a primary support mechanism — tell the parent to join and post this week, not just "be aware") → Effective Communication / Building a Support Network workshops → relevant auxiliary workshops by topic (peer pressure, soft search / room searches, monitoring, siblings, defiance, etc.) → ASAP-endorsed therapists or treatment centers → external resources (only if higher-risk).
- Tie every recommendation back to a specific behavior the parent reported above. Avoid advice that could apply to any parent.
- TOP 3 IMMEDIATE PRIORITIES must be (in this order): (1) parent's own emotional regulation, (2) co-parent / caregiver alignment, (3) build the support group. The conversation with the child is NOT one of the top 3 priorities.
- FIRST 72 HOURS PLAN sequencing is fixed: Day 1 = emotional regulation + co-parent alignment. Day 2 = build support group + gather information (soft search belongs here if secrecy or hidden use is indicated — done quietly, respectfully, with co-parent support, room left as found, evidence documented and removed as a clear boundary, not as punishment). Day 3 = prepare for the first real conversation — natural tone, not scripted lines.
- Never use the word "Chapter" in the output. Refer to Articles of Action by topic only.

Generate a Parent Action Plan. Use EXACTLY these seven section headers, each on its own line, in this exact order, written in plain UPPERCASE text with no markdown (no #, no *, no numbering, no bold):

HEADLINE SUMMARY
TOP 3 IMMEDIATE PRIORITIES
KEY PRIORITIES
WHAT TO AVOID
FIRST 72 HOURS PLAN
DAYS 4 TO 7 CONTINUATION
ENCOURAGEMENT AND DIRECTION

Place the body of each section on the lines immediately following its header. Do not add any other headers, titles, or preamble before HEADLINE SUMMARY.`;
}
