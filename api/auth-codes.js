/**
 * Authentication Codes Registry & Validation Helper
 * 
 * Ambassadors (السفراء): 18 codes for specific classes (1-1 to 3-6)
 * Supervisors (المشرفين): 3 codes for grade levels (Grade 1, Grade 2, Grade 3)
 */

export const AUTH_CODES = {
  // ── 1ST GRADE AMBASSADORS (أول ثانوي) ──
  '1101': { role: 'ambassador', grade: 1, gradeName: 'أول ثانوي', className: '1-1' },
  '1102': { role: 'ambassador', grade: 1, gradeName: 'أول ثانوي', className: '1-2' },
  '1103': { role: 'ambassador', grade: 1, gradeName: 'أول ثانوي', className: '1-3' },
  '1104': { role: 'ambassador', grade: 1, gradeName: 'أول ثانوي', className: '1-4' },
  '1105': { role: 'ambassador', grade: 1, gradeName: 'أول ثانوي', className: '1-5' },
  '1106': { role: 'ambassador', grade: 1, gradeName: 'أول ثانوي', className: '1-6' },

  // ── 2ND GRADE AMBASSADORS (ثاني ثانوي) ──
  '2201': { role: 'ambassador', grade: 2, gradeName: 'ثاني ثانوي', className: '2-1' },
  '2202': { role: 'ambassador', grade: 2, gradeName: 'ثاني ثانوي', className: '2-2' },
  '2203': { role: 'ambassador', grade: 2, gradeName: 'ثاني ثانوي', className: '2-3' },
  '2204': { role: 'ambassador', grade: 2, gradeName: 'ثاني ثانوي', className: '2-4' },
  '2205': { role: 'ambassador', grade: 2, gradeName: 'ثاني ثانوي', className: '2-5' },
  '2206': { role: 'ambassador', grade: 2, gradeName: 'ثاني ثانوي', className: '2-6' },

  // ── 3RD GRADE AMBASSADORS (ثالث ثانوي) ──
  '3301': { role: 'ambassador', grade: 3, gradeName: 'ثالث ثانوي', className: '3-1' },
  '3302': { role: 'ambassador', grade: 3, gradeName: 'ثالث ثانوي', className: '3-2' },
  '3303': { role: 'ambassador', grade: 3, gradeName: 'ثالث ثانوي', className: '3-3' },
  '3304': { role: 'ambassador', grade: 3, gradeName: 'ثالث ثانوي', className: '3-4' },
  '3305': { role: 'ambassador', grade: 3, gradeName: 'ثالث ثانوي', className: '3-5' },
  '3306': { role: 'ambassador', grade: 3, gradeName: 'ثالث ثانوي', className: '3-6' },

  // ── SUPERVISORS (المشرفين) ──
  '9901': { role: 'supervisor', grade: 1, gradeName: 'أول ثانوي', gradeScope: 'المرحلة الأولى (أول ثانوي)' },
  '9902': { role: 'supervisor', grade: 2, gradeName: 'ثاني ثانوي', gradeScope: 'المرحلة الثانية (ثاني ثانوي)' },
  '9903': { role: 'supervisor', grade: 3, gradeName: 'ثالث ثانوي', gradeScope: 'المرحلة الثالثة (ثالث ثانوي)' }
};

/**
 * Validates code and checks if it matches the requested role selection
 * @param {string} code 
 * @param {string} selectedRole ('ambassador' | 'supervisor')
 * @returns {object|null} Match details or null
 */
export function validateAuthCode(code, selectedRole) {
  if (!code || typeof code !== 'string') return null;
  const trimmedCode = code.trim();
  const entry = AUTH_CODES[trimmedCode];

  if (!entry) return null;
  if (selectedRole && entry.role !== selectedRole) return null;

  return entry;
}
