import React, { useEffect, useState } from 'react';
import {
  Building2,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  LogIn,
  Mail,
  Send,
  ShieldCheck,
  User,
  X,
} from 'lucide-react';
import type { RegisteredUser, UserRole } from '../types/sms';
import { authenticateUser } from '../utils/authAccounts';
import {
  DEFAULT_RECOVERY_EMAIL,
  generateRecoveryCode,
  isValidEmailAddress,
  validateRecoveryReset,
} from '../utils/recoveryEmail';
import {
  getGmailAccessToken,
  googleSignInForGmail,
  initGoogleGmailAuth,
  sendRecoveryVerificationEmail,
} from '../utils/gmailAuth';

interface LoginScreenProps {
  authorizedUsers: RegisteredUser[];
  onLogin: (
    role: UserRole,
    username: string,
    keepSignedIn: boolean,
    fullName?: string
  ) => void;
  onResetPassword: (role: UserRole, newPassword: string) => void;
}

type RecoveryStep = 'compose' | 'confirm-send' | 'verify-code';

export const LoginScreen: React.FC<LoginScreenProps> = ({
  authorizedUsers,
  onLogin,
  onResetPassword,
}) => {
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [keepSignedIn, setKeepSignedIn] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [loginStatusNotice, setLoginStatusNotice] = useState<string | null>(
    null
  );

  const [supportModal, setSupportModal] = useState<
    'recovery' | 'helpdesk' | null
  >(null);

  // Recovery verification email state
  const [recoveryRole, setRecoveryRole] = useState<UserRole>('Admin');
  const [recoveryEmail, setRecoveryEmail] = useState<string>(
    DEFAULT_RECOVERY_EMAIL
  );
  const [recoveryStep, setRecoveryStep] = useState<RecoveryStep>('compose');
  const [generatedCode, setGeneratedCode] = useState<string>('');
  const [enteredCode, setEnteredCode] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmNewPassword, setConfirmNewPassword] = useState<string>('');
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [recoveryNotice, setRecoveryNotice] = useState<string | null>(null);
  const [gmailConnectedEmail, setGmailConnectedEmail] = useState<string | null>(
    null
  );
  const [hasGmailToken, setHasGmailToken] = useState<boolean>(() =>
    Boolean(getGmailAccessToken())
  );
  const [isConnectingGoogle, setIsConnectingGoogle] = useState<boolean>(false);
  const [isSendingEmail, setIsSendingEmail] = useState<boolean>(false);

  useEffect(() => {
    const unsubscribe = initGoogleGmailAuth(
      (user) => {
        setHasGmailToken(true);
        setGmailConnectedEmail(user.email ?? DEFAULT_RECOVERY_EMAIL);
      },
      () => {
        setHasGmailToken(Boolean(getGmailAccessToken()));
        if (!getGmailAccessToken()) {
          setGmailConnectedEmail(null);
        }
      }
    );
    return () => unsubscribe();
  }, []);

  const selectedRecoveryUser =
    authorizedUsers.find((u) => u.role === recoveryRole) ?? authorizedUsers[0];

  const openRecoveryModal = () => {
    setRecoveryStep('compose');
    setRecoveryEmail(DEFAULT_RECOVERY_EMAIL);
    setRecoveryError(null);
    setRecoveryNotice(null);
    setEnteredCode('');
    setNewPassword('');
    setConfirmNewPassword('');
    setSupportModal('recovery');
  };

  const handleSignInSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = authenticateUser(authorizedUsers, username, password);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    setLoginStatusNotice(null);
    const loggedInUser = result.user;
    onLogin(
      loggedInUser.role,
      loggedInUser.username,
      keepSignedIn,
      loggedInUser.fullName
    );
  };

  const handleGoogleConnect = async () => {
    setRecoveryError(null);
    setIsConnectingGoogle(true);
    try {
      const result = await googleSignInForGmail();
      if (result) {
        setHasGmailToken(true);
        setGmailConnectedEmail(result.user.email ?? DEFAULT_RECOVERY_EMAIL);
        setRecoveryNotice(
          `Gmail connected (${result.user.email ?? 'authorized'}). Ready to send recovery verification email.`
        );
      }
    } catch (err) {
      setRecoveryError(
        err instanceof Error
          ? err.message
          : 'Google sign-in was cancelled or failed.'
      );
    } finally {
      setIsConnectingGoogle(false);
    }
  };

  const handlePrepareSendEmail = () => {
    if (!isValidEmailAddress(recoveryEmail)) {
      setRecoveryError('Please enter a valid recovery email address.');
      return;
    }
    if (!hasGmailToken && !getGmailAccessToken()) {
      setRecoveryError(
        'Please connect with "Sign in with Google" first to authorize Gmail email delivery.'
      );
      return;
    }
    setRecoveryError(null);
    setGeneratedCode(generateRecoveryCode());
    setRecoveryStep('confirm-send');
  };

  const handleConfirmSendEmail = async () => {
    setRecoveryError(null);
    setIsSendingEmail(true);
    try {
      const cleanRecipient = recoveryEmail.trim() || DEFAULT_RECOVERY_EMAIL;
      await sendRecoveryVerificationEmail({
        to: cleanRecipient,
        roleLabel: selectedRecoveryUser.fullName,
        username: selectedRecoveryUser.username,
        code: generatedCode,
      });
      setRecoveryStep('verify-code');
      setRecoveryNotice(
        `Verification code sent via Gmail to ${cleanRecipient}. Enter the 6-digit code below.`
      );
    } catch (err) {
      setRecoveryError(
        err instanceof Error
          ? err.message
          : 'Unable to send recovery verification email.'
      );
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleVerifyAndReset = (e: React.FormEvent) => {
    e.preventDefault();
    const check = validateRecoveryReset({
      enteredCode,
      expectedCode: generatedCode,
      newPassword,
      confirmPassword: confirmNewPassword,
    });
    if (!check.ok) {
      setRecoveryError(check.error);
      return;
    }
    onResetPassword(recoveryRole, newPassword);
    setSupportModal(null);
    setUsername(selectedRecoveryUser.username);
    setPassword('');
    setLoginStatusNotice(
      `Verification complete for ${selectedRecoveryUser.fullName}. Password updated — sign in below.`
    );
  };

  return (
    <div className="min-h-screen w-full grid grid-cols-1 lg:grid-cols-2 bg-[#F8FAFC]">
      {/* Left Brand & Institutional Hero Panel */}
      <section
        aria-label="ABSMS Institutional Overview"
        className="relative flex flex-col justify-between overflow-hidden px-8 py-8 sm:px-12 sm:py-10 text-white"
        style={{
          background:
            'linear-gradient(155deg, #1E3F8D 0%, #17347A 55%, #122962 100%)',
        }}
      >
        {/* Subtle geometric diamond & circle lattice overlay */}
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <pattern
              id="absms-lattice"
              width="64"
              height="64"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M0 0 L64 64 M64 0 L0 64"
                stroke="rgba(255,255,255,0.06)"
                strokeWidth="1"
              />
              <circle
                cx="32"
                cy="32"
                r="17"
                fill="none"
                stroke="rgba(255,255,255,0.055)"
                strokeWidth="1"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#absms-lattice)" />
        </svg>

        {/* Top Wide High-Resolution Logo Lockup */}
        <div className="relative z-10 w-full max-w-[460px]">
          <div className="overflow-hidden rounded-2xl border border-white/25 bg-white shadow-[0_20px_48px_rgba(9,20,52,0.36)]">
            <div className="flex items-center justify-center bg-white px-7 pt-5 pb-4">
              <img
                src="/src/assets/images/al_bushra_logo_hq_1795190276932.jpg"
                alt="Al-Bushra Management System Logo"
                className="h-[172px] sm:h-[196px] w-full object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="border-t border-slate-200/80 bg-[#F8FAFC] px-6 py-3.5 text-center">
              <div className="text-[17px] sm:text-[18px] font-bold tracking-tight text-[#0F172A]">
                Al-Bushra Management System
              </div>
              <div className="mt-0.5 text-[11.5px] font-medium text-slate-500">
                Admissions · Attendance · Computer Lab Exams · Fee Ledger
              </div>
            </div>
          </div>
        </div>

        {/* Center Hero Copy */}
        <div className="relative z-10 my-7 max-w-[470px]">
          <p className="text-[12px] font-semibold tracking-wide text-blue-200">
            Academic Year 2026 / 2027 · Official Staff Portal
          </p>

          <h1 className="mt-2.5 text-[32px] sm:text-[38px] font-bold leading-[1.15] tracking-tight text-white [text-wrap:balance]">
            Academic &amp; Administrative Excellence
          </h1>

          <p className="mt-3.5 text-[14.5px] leading-[1.65] text-blue-100/85">
            The integrated institutional platform powering student admissions,
            daily roll calls, MS Office examinations, fee reconciliations, and
            real-time academic reporting.
          </p>
        </div>

        {/* Bottom Compliance Footer */}
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 border-t border-white/15 pt-5 text-[11.5px] text-blue-100/80">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-blue-200 shrink-0" />
            <span>Encrypted Institutional Staff Access</span>
          </div>
          <div className="font-medium tracking-wide text-blue-100/80">
            Al-Bushra Management System
          </div>
        </div>
      </section>

      {/* Right Authentication Card Panel */}
      <main className="flex flex-col items-center justify-center bg-[#F8FAFC] px-6 py-8 sm:px-10">
        <div className="w-full max-w-[436px]">
          <div className="rounded-2xl border border-slate-200/90 bg-white px-7 py-8 sm:px-8 shadow-[0_14px_40px_-14px_rgba(15,23,42,0.08)]">
            {/* Access Scope */}
            <div className="inline-flex items-center gap-2 text-[12px] font-semibold text-[#1E3A8A]">
              <Building2 className="h-4 w-4 shrink-0 text-[#1E3A8A]" />
              <span>Administration · Teacher · Cashier Access</span>
            </div>

            <h2 className="mt-3 text-[24px] font-bold tracking-tight text-[#0F172A]">
              Sign In to Your Account
            </h2>
            <p className="mt-1.5 text-[13px] leading-relaxed text-slate-500">
              Please enter your authorized school credentials to continue.
            </p>

            {loginStatusNotice && (
              <div
                role="status"
                className="mt-4 flex items-start gap-2 rounded-lg border border-emerald-200 bg-[#ECFDF5] px-3 py-2.5 text-[12px] font-medium text-[#059669]"
              >
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{loginStatusNotice}</span>
              </div>
            )}

            <form
              onSubmit={handleSignInSubmit}
              className="mt-5 space-y-4"
              noValidate
            >
              {/* User Name */}
              <div>
                <label
                  htmlFor="login-username"
                  className="block text-[12.5px] font-semibold text-slate-700"
                >
                  User Name
                </label>
                <div className="relative mt-1.5">
                  <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="login-username"
                    name="staff-username"
                    type="text"
                    autoComplete="username"
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value);
                      if (error) setError(null);
                    }}
                    placeholder="Enter username"
                    className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3.5 text-[13.5px] font-medium text-slate-800 placeholder:text-slate-400 focus:border-[#1E3A8A] focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/15"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="login-password"
                    className="block text-[12.5px] font-semibold text-slate-700"
                  >
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={openRecoveryModal}
                    className="text-[12px] font-semibold text-[#1E3A8A] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A8A]/40 rounded cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative mt-1.5">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="login-password"
                    name="staff-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (error) setError(null);
                    }}
                    placeholder="Enter password"
                    className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-10 text-[13.5px] font-medium text-slate-800 placeholder:text-slate-400 focus:border-[#1E3A8A] focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/15"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A8A]/40 cursor-pointer"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <div
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-medium text-red-700"
                >
                  {error}
                </div>
              )}

              {/* Keep me signed in */}
              <div className="flex items-center justify-between pt-0.5">
                <label className="inline-flex cursor-pointer items-center gap-2 text-[12.5px] font-medium text-slate-600 select-none">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={keepSignedIn}
                    aria-label="Keep me signed in"
                    onClick={() => setKeepSignedIn((prev) => !prev)}
                    className={`flex h-4 w-4 items-center justify-center rounded-full border transition-colors cursor-pointer ${
                      keepSignedIn
                        ? 'border-[#1E3A8A] bg-[#1E3A8A] text-white'
                        : 'border-slate-300 bg-white text-transparent'
                    }`}
                  >
                    <Check className="h-2.5 w-2.5 stroke-[3]" />
                  </button>
                  <span>Keep me signed in</span>
                </label>
                <button
                  type="button"
                  onClick={openRecoveryModal}
                  className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#1E3A8A] hover:underline cursor-pointer"
                >
                  <Mail className="h-3.5 w-3.5" />
                  <span>Recovery Verification</span>
                </button>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                className="mt-1 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#1E3A8A] text-[13.5px] font-semibold text-white shadow-xs transition-colors hover:bg-[#172E6E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A8A] focus-visible:ring-offset-2 cursor-pointer"
              >
                <span>Sign In</span>
                <LogIn className="h-4 w-4" />
              </button>
            </form>
          </div>

          <p className="mt-4 text-center text-[12px] text-slate-500">
            Need technical assistance?{' '}
            <button
              type="button"
              onClick={() => setSupportModal('helpdesk')}
              className="font-semibold text-[#1E3A8A] hover:underline cursor-pointer"
            >
              Contact IT Support Helpdesk
            </button>
          </p>
        </div>
      </main>

      {/* Recovery Verification Email / IT Support Dialog */}
      {supportModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="support-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 px-4"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3
                  id="support-modal-title"
                  className="text-[17px] font-bold text-[#0F172A]"
                >
                  {supportModal === 'recovery'
                    ? 'Email Recovery Verification'
                    : 'Al-Bushra IT Support Helpdesk'}
                </h3>
                <p className="mt-1 text-[12.5px] text-slate-500">
                  {supportModal === 'recovery'
                    ? 'Send a 6-digit verification code via Gmail to verify recovery and reset your account password.'
                    : 'Direct technical support for ABSMS staff workstations and role permissions.'}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close modal"
                onClick={() => setSupportModal(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {supportModal === 'helpdesk' ? (
              <>
                <div className="mt-4 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-[12.5px] text-slate-700">
                  <div className="flex justify-between">
                    <span className="font-medium text-slate-500">
                      Authorized Roles:
                    </span>
                    <span className="font-medium">
                      Administration • Teacher • Cashier
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-slate-200 pt-2">
                    <span className="font-medium text-slate-500">
                      Recovery Email:
                    </span>
                    <span className="font-mono font-medium text-[#1E3A8A]">
                      {DEFAULT_RECOVERY_EMAIL}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-slate-200 pt-2">
                    <span className="font-medium text-slate-500">
                      Helpdesk Desk:
                    </span>
                    <span className="font-semibold text-[#1E3A8A]">
                      Ext. 204 • Lab Office
                    </span>
                  </div>
                </div>

                <div className="mt-5 flex justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={openRecoveryModal}
                    className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-[12.5px] font-semibold text-[#1E3A8A] hover:bg-slate-50 cursor-pointer"
                  >
                    Email Recovery
                  </button>
                  <button
                    type="button"
                    onClick={() => setSupportModal(null)}
                    className="rounded-lg bg-[#1E3A8A] px-4 py-2 text-[12.5px] font-semibold text-white hover:bg-[#172E6E] cursor-pointer"
                  >
                    Return to Sign In
                  </button>
                </div>
              </>
            ) : recoveryStep === 'compose' ? (
              <div className="mt-4 space-y-4">
                <div>
                  <span className="block text-[12px] font-semibold text-slate-700">
                    Select Account Role
                  </span>
                  <div className="mt-1.5 grid grid-cols-3 gap-2">
                    {(['Admin', 'Teacher', 'Cashier'] as UserRole[]).map(
                      (role) => {
                        const label =
                          role === 'Admin'
                            ? 'Administration'
                            : role === 'Teacher'
                              ? 'Teacher'
                              : 'Cashier';
                        return (
                          <button
                            key={role}
                            type="button"
                            onClick={() => setRecoveryRole(role)}
                            className={`h-9 rounded-lg border text-[12px] font-semibold transition-colors cursor-pointer ${
                              recoveryRole === role
                                ? 'border-[#1E3A8A] bg-[#EFF6FF] text-[#1E3A8A]'
                                : 'border-slate-200 bg-[#F8FAFC] text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            {label}
                          </button>
                        );
                      }
                    )}
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="recovery-email"
                    className="block text-[12px] font-semibold text-slate-700"
                  >
                    Recovery Verification Email
                  </label>
                  <div className="relative mt-1.5">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      id="recovery-email"
                      type="email"
                      value={recoveryEmail}
                      onChange={(e) => {
                        setRecoveryEmail(e.target.value);
                        if (recoveryError) setRecoveryError(null);
                      }}
                      placeholder={DEFAULT_RECOVERY_EMAIL}
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-[13px] font-medium text-slate-800 focus:border-[#1E3A8A] focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/15"
                    />
                  </div>
                </div>

                {/* Official Google Sign-In for Gmail Send Permission */}
                <div className="rounded-xl border border-slate-200 bg-[#F8FAFC] p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[12px] font-semibold text-slate-700">
                      Gmail Delivery Authorization
                    </span>
                    {hasGmailToken && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#ECFDF5] px-2 py-0.5 text-[11px] font-semibold text-[#059669]">
                        <CheckCircle2 className="h-3 w-3" />
                        <span>Connected</span>
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[11.5px] text-slate-500">
                    {hasGmailToken
                      ? `Authorized via ${gmailConnectedEmail ?? 'Google'}.`
                      : 'Sign in with Google to authorize sending the verification email to fatxipublic@gmail.com.'}
                  </p>

                  {!hasGmailToken && (
                    <button
                      type="button"
                      onClick={handleGoogleConnect}
                      disabled={isConnectingGoogle}
                      className="gsi-material-button mt-3 inline-flex h-10 w-full items-center justify-center gap-2.5 rounded-lg border border-slate-300 bg-white px-4 text-[13px] font-semibold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 disabled:opacity-60 cursor-pointer"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 48 48"
                        className="h-4 w-4 shrink-0"
                      >
                        <path
                          fill="#EA4335"
                          d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                        />
                        <path
                          fill="#4285F4"
                          d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                        />
                        <path
                          fill="#34A853"
                          d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                        />
                      </svg>
                      <span>
                        {isConnectingGoogle
                          ? 'Connecting Google...'
                          : 'Sign in with Google'}
                      </span>
                    </button>
                  )}
                </div>

                {recoveryNotice && (
                  <div
                    role="status"
                    className="rounded-lg border border-emerald-200 bg-[#ECFDF5] px-3 py-2 text-[12px] font-medium text-[#059669]"
                  >
                    {recoveryNotice}
                  </div>
                )}

                {recoveryError && (
                  <div
                    role="alert"
                    className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-medium text-red-700"
                  >
                    {recoveryError}
                  </div>
                )}

                <div className="flex justify-end gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setSupportModal(null)}
                    className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-[12.5px] font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handlePrepareSendEmail}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#1E3A8A] px-4 py-2 text-[12.5px] font-semibold text-white hover:bg-[#172E6E] cursor-pointer"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>Send Verification Email</span>
                  </button>
                </div>
              </div>
            ) : recoveryStep === 'confirm-send' ? (
              <div className="mt-4 space-y-4">
                <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-[12.5px] text-slate-700">
                  <p className="font-bold text-[#0F172A]">
                    Confirm Sending Verification Email
                  </p>
                  <p className="mt-1.5 leading-relaxed">
                    Are you sure you want to send a recovery verification email
                    via Gmail to{' '}
                    <span className="font-mono font-semibold text-[#1E3A8A]">
                      {recoveryEmail.trim()}
                    </span>{' '}
                    for account{' '}
                    <span className="font-semibold">
                      {selectedRecoveryUser.fullName} (
                      {selectedRecoveryUser.username})
                    </span>
                    ?
                  </p>
                </div>

                {recoveryError && (
                  <div
                    role="alert"
                    className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-medium text-red-700"
                  >
                    {recoveryError}
                  </div>
                )}

                <div className="flex justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setRecoveryError(null);
                      setRecoveryStep('compose');
                    }}
                    disabled={isSendingEmail}
                    className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-[12.5px] font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmSendEmail}
                    disabled={isSendingEmail}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#1E3A8A] px-4 py-2 text-[12.5px] font-semibold text-white hover:bg-[#172E6E] disabled:opacity-60 cursor-pointer"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>
                      {isSendingEmail
                        ? 'Sending Email...'
                        : 'Confirm & Send Email'}
                    </span>
                  </button>
                </div>
              </div>
            ) : (
              <form
                onSubmit={handleVerifyAndReset}
                className="mt-4 space-y-3.5"
                noValidate
              >
                {recoveryNotice && (
                  <div
                    role="status"
                    className="rounded-lg border border-emerald-200 bg-[#ECFDF5] px-3 py-2 text-[12px] font-medium text-[#059669]"
                  >
                    {recoveryNotice}
                  </div>
                )}

                <div>
                  <label
                    htmlFor="recovery-code"
                    className="block text-[12px] font-semibold text-slate-700"
                  >
                    6-Digit Verification Code
                  </label>
                  <div className="relative mt-1">
                    <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      id="recovery-code"
                      type="text"
                      inputMode="numeric"
                      value={enteredCode}
                      onChange={(e) => {
                        setEnteredCode(e.target.value);
                        if (recoveryError) setRecoveryError(null);
                      }}
                      placeholder="Enter 6-digit code from email"
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 font-mono text-[13px] font-semibold text-slate-800 focus:border-[#1E3A8A] focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/15"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="recovery-new-password"
                    className="block text-[12px] font-semibold text-slate-700"
                  >
                    New Password for {selectedRecoveryUser.fullName}
                  </label>
                  <input
                    id="recovery-new-password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      if (recoveryError) setRecoveryError(null);
                    }}
                    placeholder="Minimum 4 characters"
                    className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-medium text-slate-800 focus:border-[#1E3A8A] focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/15"
                  />
                </div>

                <div>
                  <label
                    htmlFor="recovery-confirm-password"
                    className="block text-[12px] font-semibold text-slate-700"
                  >
                    Confirm New Password
                  </label>
                  <input
                    id="recovery-confirm-password"
                    type="password"
                    value={confirmNewPassword}
                    onChange={(e) => {
                      setConfirmNewPassword(e.target.value);
                      if (recoveryError) setRecoveryError(null);
                    }}
                    placeholder="Re-enter new password"
                    className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-medium text-slate-800 focus:border-[#1E3A8A] focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/15"
                  />
                </div>

                {recoveryError && (
                  <div
                    role="alert"
                    className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-medium text-red-700"
                  >
                    {recoveryError}
                  </div>
                )}

                <div className="flex justify-end gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setRecoveryStep('compose')}
                    className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-[12.5px] font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    className="rounded-lg bg-[#1E3A8A] px-4 py-2 text-[12.5px] font-semibold text-white hover:bg-[#172E6E] cursor-pointer"
                  >
                    Verify &amp; Reset Password
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
