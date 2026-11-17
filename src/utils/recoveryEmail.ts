export const DEFAULT_RECOVERY_EMAIL = 'fatxipublic@gmail.com';

export function generateRecoveryCode(): string {
  const randomDigits = Math.floor(100000 + Math.random() * 900000);
  return String(randomDigits);
}

export function isValidEmailAddress(email: string): boolean {
  const trimmed = email.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

function toBase64Url(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function buildRecoveryEmailRaw(params: {
  to: string;
  roleLabel: string;
  username: string;
  code: string;
}): string {
  const cleanTo = params.to.trim() || DEFAULT_RECOVERY_EMAIL;
  const subject = `ABSMS Verification Code: ${params.code}`;
  const bodyLines = [
    'Al-Bushra Printing School Management System (ABSMS)',
    '',
    `Account Recovery Verification for ${params.roleLabel} (${params.username})`,
    '',
    `Your 6-digit verification code is: ${params.code}`,
    '',
    'Enter this code in the ABSMS Credential Recovery screen to verify your identity and set a new password.',
    'If you did not request this verification email, you can ignore this message.',
  ];

  const mimeMessage = [
    `To: ${cleanTo}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    '',
    ...bodyLines,
  ].join('\r\n');

  return toBase64Url(mimeMessage);
}

export function validateRecoveryReset(params: {
  enteredCode: string;
  expectedCode: string;
  newPassword: string;
  confirmPassword: string;
}): { ok: true } | { ok: false; error: string } {
  const code = params.enteredCode.trim();
  if (!code || code !== params.expectedCode) {
    return {
      ok: false,
      error: 'Verification code does not match. Check the email sent to fatxipublic@gmail.com.',
    };
  }
  if (!params.newPassword || params.newPassword.length < 4) {
    return {
      ok: false,
      error: 'New password must be at least 4 characters.',
    };
  }
  if (params.newPassword !== params.confirmPassword) {
    return {
      ok: false,
      error: 'New password and confirmation do not match.',
    };
  }
  return { ok: true };
}
