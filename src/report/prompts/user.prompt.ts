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
- This plan is a continuation of the parent's ASAP Community work — not a standalone report. Anchor recommendations in ASAP resources in this order: Articles of Action → Effective Communication / Building a Support Network workshops → relevant auxiliary workshops → ASAP-endorsed therapists or treatment centers → external resources (only if higher-risk).
- Tie every recommendation back to a specific behavior the parent reported above. Avoid advice that could apply to any parent.
- The TOP 3 IMMEDIATE PRIORITIES and FIRST 72 HOURS PLAN must include deeper intervention strategies (parent's own emotional regulation, caregiver alignment, building the support structure around the child, understanding the suspected substance) — not surface-level "have a conversation" advice.

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
