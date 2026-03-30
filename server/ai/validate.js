const BLOCKED_PATTERNS = [
  /fetch\s*\(/,
  /XMLHttpRequest/,
  /import\s*\(/,
  /\beval\s*\(/,
  /document\.cookie/,
  /localStorage/,
  /sessionStorage/,
  /window\.parent/,
  /window\.top/,
  /https?:\/\//,
];

export function validateCode(code) {
  if (code.trim() === '// INVALID REQUEST') {
    return { valid: false, reason: 'off-topic request' };
  }
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(code)) {
      return { valid: false, reason: `blocked pattern: ${pattern}` };
    }
  }
  return { valid: true };
}
