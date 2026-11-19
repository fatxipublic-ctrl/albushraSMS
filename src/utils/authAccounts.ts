import type { RegisteredUser } from '../types/sms';

export const AUTHORIZED_STAFF_ACCOUNTS: RegisteredUser[] = [
  {
    id: 'USR-ADMIN',
    fullName: 'Administration',
    username: 'admin albushra',
    password: '@Fate3326#',
    role: 'Admin',
    createdAt: '2026-11-17',
  },
  {
    id: 'USR-TEACHERS',
    fullName: 'Teacher',
    username: 'Teacher',
    password: '@albushra3326',
    role: 'Teacher',
    createdAt: '2026-11-17',
  },
  {
    id: 'USR-CASHIER',
    fullName: 'Cashier',
    username: 'Cashier',
    password: '@albushracash3326',
    role: 'Cashier',
    createdAt: '2026-11-17',
  },
];

export function authenticateUser(
  users: RegisteredUser[],
  username: string,
  password: string
): { ok: true; user: RegisteredUser } | { ok: false; error: string } {
  const cleanUsername = username.trim();
  if (!cleanUsername) {
    return { ok: false, error: 'Please enter your username.' };
  }
  if (!password) {
    return { ok: false, error: 'Please enter your password.' };
  }

  const normalized = cleanUsername.toLowerCase();
  const matched = users.find((u) => u.username.toLowerCase() === normalized);
  if (!matched || matched.password !== password) {
    return {
      ok: false,
      error:
        'Invalid username or password. Please enter valid staff credentials.',
    };
  }

  return { ok: true, user: matched };
}

export function updateAccountPassword(
  users: RegisteredUser[],
  role: RegisteredUser['role'],
  newPassword: string
): RegisteredUser[] {
  return users.map((user) =>
    user.role === role ? { ...user, password: newPassword } : user
  );
}
