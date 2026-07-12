// DRAFT CONTENT — Sustaining Recovery domain map (scaffold).
// 20 questions → 5 post-treatment concern domains, 4 questions each (no overlap
// in the draft for clarity). NOT founder-approved. The early-intervention map
// (../scoring/domain.map.ts) keeps its own 24-question / 5-domain layout; this
// is the parallel map for the post-treatment plan.

export const SR_DOMAIN_MAP: Record<string, number[]> = {
  'Relapse Risk & Safety': [0, 1, 2, 3],
  'Home Environment & Triggers': [4, 5, 6, 7],
  'Routine & Structure': [8, 9, 10, 11],
  'Communication & Trust': [12, 13, 14, 15],
  'Ongoing Support & Treatment Continuity': [16, 17, 18, 19],
};

// Tie-break priority: when two domains are equally elevated, the one earlier in
// this list wins the higher slot. Safety leads; treatment continuity anchors.
export const SR_TIE_BREAK_ORDER: string[] = [
  'Relapse Risk & Safety',
  'Communication & Trust',
  'Home Environment & Triggers',
  'Routine & Structure',
  'Ongoing Support & Treatment Continuity',
];
