export interface DomainScores {
  'Immediate Safety & Urgency': number;
  'Household Structure': number;
  'Boundary Consistency': number;
  'Communication & Conflict': number;
  'Support & Professional Engagement': number;
}

export interface ReportSections {
  urgentConcern: string;
  headlineSummary: string;
  topImmediatePriorities: string;
  keyPriorities: string;
  whatToAvoid: string;
  first72Hours: string;
  days4to7: string;
  consideringInpatient: string;
  encouragement: string;
}

export interface GenerateReportResponse {
  success: true;
  domainScores: DomainScores;
  topDomains: string[];
  report: ReportSections;
}
