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

Generate a Parent Action Plan following the required output structure exactly.`;
}