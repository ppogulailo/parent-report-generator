export interface DomainScores {
  'Immediate Safety & Urgency': number;
  'Household Structure': number;
  'Boundary Consistency': number;
  'Communication & Conflict': number;
  'Support & Professional Engagement': number;
}

export interface ReportSections {
  headlineSummary: string;
  keyPriorities: string;
  whatToAvoid: string;
  next7Days: string;
  encouragement: string;
}

export interface GenerateReportResponse {
  success: true;
  domainScores: DomainScores;
  topDomains: string[];
  report: ReportSections;
}