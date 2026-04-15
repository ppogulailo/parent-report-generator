export function buildUserPrompt(
  domainScores: Record<string, number>,
  topDomains: string[],
): string {
  return `Domain Scores:
- Immediate Safety & Urgency: ${domainScores['Immediate Safety & Urgency'].toFixed(2)}
- Household Structure: ${domainScores['Household Structure'].toFixed(2)}
- Boundary Consistency: ${domainScores['Boundary Consistency'].toFixed(2)}
- Communication & Conflict: ${domainScores['Communication & Conflict'].toFixed(2)}
- Support & Professional Engagement: ${domainScores['Support & Professional Engagement'].toFixed(2)}

Top 3 Priority Domains: ${topDomains[0]}, ${topDomains[1]}, ${topDomains[2]}

Generate a Parent Action Plan. Use EXACTLY these five section headers, each on its own line, in this exact order, written in plain UPPERCASE text with no markdown (no #, no *, no numbering, no bold):

HEADLINE SUMMARY
KEY PRIORITIES
WHAT TO AVOID
NEXT 7 DAYS ACTION PLAN
ENCOURAGEMENT & DIRECTION

Place the body of each section on the lines immediately following its header. Do not add any other headers, titles, or preamble before HEADLINE SUMMARY.`;
}