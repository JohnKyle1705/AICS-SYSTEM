export interface AssessmentCriteria {
  monthlyIncome: number;
  familySize: number;
  isPwd: boolean;
  isSenior: boolean;
  is4ps: boolean;
  urgency: 'Normal' | 'Urgent' | 'Emergency';
}

export function calculatePriority(criteria: AssessmentCriteria) {
  let score = 0;

  // 1. Income Scoring (Max 40 points)
  if (criteria.monthlyIncome <= 5000) score += 40;
  else if (criteria.monthlyIncome <= 10000) score += 30;
  else if (criteria.monthlyIncome <= 15000) score += 20;
  else if (criteria.monthlyIncome <= 20000) score += 10;

  // 2. Family Size Scoring (Max 20 points)
  if (criteria.familySize >= 7) score += 20;
  else if (criteria.familySize >= 5) score += 15;
  else if (criteria.familySize >= 3) score += 10;

  // 3. Vulnerability Scoring (Max 15 points)
  if (criteria.isPwd) score += 5;
  if (criteria.isSenior) score += 5;
  if (criteria.is4ps) score += 5;

  // 4. Urgency Scoring (Max 25 points)
  if (criteria.urgency === 'Emergency') score += 25;
  else if (criteria.urgency === 'Urgent') score += 15;
  else score += 5;

  // Determine Priority Level
  let level: 'Low' | 'Medium' | 'High' = 'Low';
  if (score >= 70) level = 'High';
  else if (score >= 40) level = 'Medium';

  return {
    score,
    level,
    isEligible: criteria.monthlyIncome <= 30000 // Simple threshold for eligibility
  };
}
