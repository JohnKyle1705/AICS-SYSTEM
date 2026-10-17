export interface RequirementItem {
  id: string
  label: string
  met: boolean
}

export type StrengthLevel = 'Not set' | 'Weak' | 'Medium' | 'Strong' | 'Very Strong'

export interface StrengthInfo {
  label: StrengthLevel
  score: number // 0 to 5
  colorClass: string
  hexColor: string
}

export interface PasswordValidationResult {
  isValid: boolean
  requirements: RequirementItem[]
  firstUnmet: RequirementItem | null
  strength: StrengthInfo
}

/**
 * Checks all 6 password requirements:
 * 1. At least 8 characters
 * 2. Lowercase (a-z)
 * 3. Special character (!@#$)
 * 4. Uppercase (A-Z)
 * 5. Number (0-9)
 * 6. No spaces
 */
export function checkPasswordRequirements(pw: string): RequirementItem[] {
  return [
    {
      id: 'length',
      label: '8+ characters',
      met: pw.length >= 8,
    },
    {
      id: 'lowercase',
      label: 'Lowercase (a-z)',
      met: /[a-z]/.test(pw),
    },
    {
      id: 'special',
      label: 'Special (!@#$)',
      met: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?`~]/.test(pw),
    },
    {
      id: 'uppercase',
      label: 'Uppercase (A-Z)',
      met: /[A-Z]/.test(pw),
    },
    {
      id: 'number',
      label: 'Number (0-9)',
      met: /[0-9]/.test(pw),
    },
    {
      id: 'no_spaces',
      label: 'No spaces',
      met: pw.length > 0 && !/\s/.test(pw),
    },
  ]
}

/**
 * Calculates password strength across 5 levels:
 * - Not set (0 bars, score 0)
 * - Weak (1 bar, score 1)
 * - Medium (2-3 bars, score 2-3)
 * - Strong (4 bars, score 4)
 * - Very Strong (5 bars, score 5)
 */
export function calculatePasswordStrength(pw: string): StrengthInfo {
  if (!pw || pw.length === 0) {
    return {
      label: 'Not set',
      score: 0,
      colorClass: 'text-slate-400 dark:text-slate-500',
      hexColor: '#94a3b8',
    }
  }

  const reqs = checkPasswordRequirements(pw)
  const metCount = reqs.filter(r => r.met).length

  if (metCount <= 2) {
    return {
      label: 'Weak',
      score: 1,
      colorClass: 'text-red-500 dark:text-red-400',
      hexColor: '#ef4444',
    }
  }

  if (metCount === 3) {
    return {
      label: 'Medium',
      score: 2,
      colorClass: 'text-amber-500 dark:text-amber-400',
      hexColor: '#f59e0b',
    }
  }

  if (metCount === 4) {
    return {
      label: 'Medium',
      score: 3,
      colorClass: 'text-amber-500 dark:text-amber-400',
      hexColor: '#f59e0b',
    }
  }

  if (metCount === 5) {
    return {
      label: 'Strong',
      score: 4,
      colorClass: 'text-blue-500 dark:text-blue-400',
      hexColor: '#3b82f6',
    }
  }

  return {
    label: 'Very Strong',
    score: 5,
    colorClass: 'text-emerald-500 dark:text-emerald-400',
    hexColor: '#10b981',
  }
}

/**
 * Validates a password completely.
 */
export function validatePassword(password: string): PasswordValidationResult {
  const requirements = checkPasswordRequirements(password)
  const firstUnmet = requirements.find(r => !r.met) || null
  const isValid = requirements.every(r => r.met)
  const strength = calculatePasswordStrength(password)

  return {
    isValid,
    requirements,
    firstUnmet,
    strength,
  }
}
