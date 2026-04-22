export const DOMAIN_MAP: Record<string, number[]> = {
  'Immediate Safety & Urgency': [0, 1, 9, 22, 23],
  'Household Structure': [13, 19, 20, 21, 17],
  'Boundary Consistency': [6, 10, 17, 18, 21],
  'Communication & Conflict': [2, 4, 5, 8, 12],
  'Support & Professional Engagement': [14, 15, 16, 7, 11],
};

export const TIE_BREAK_ORDER: string[] = [
  'Immediate Safety & Urgency',
  'Communication & Conflict',
  'Boundary Consistency',
  'Household Structure',
  'Support & Professional Engagement',
];
