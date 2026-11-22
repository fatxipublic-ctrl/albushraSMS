import React, { useEffect, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Cloud,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  LogIn,
  Mail,
  Send,
  User,
  Users,
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
import { LivePortalBanner } from './LivePortalBanner';
import { PWAInstallButton } from './PWAInstallButton';

interface LoginScreenProps {
  authorizedUsers: RegisteredUser[];
  onLogin: (
    role: UserRole,
    username: string,
    keepSignedIn: boolean,
    fullName?: string
  ) => void;
  onResetPassword: (role: UserRole, newPassword: string) => void;
  cloudConnected?: boolean;
  cloudEmail?: string | null;
  isConnectingCloud?: boolean;
  onConnectCloud?: () => void;
  cloudNotice?: string | null;
}

type RecoveryStep = 'compose' | 'confirm-send' | 'verify-code';

export const LoginScreen: React.FC<LoginScreenProps> = ({
  authorizedUsers,
  onLogin,
  onResetPassword,
  cloudConnected = false,
  cloudEmail = null,
  isConnectingCloud = false,
  onConnectCloud,
  cloudNotice = null,
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
    <div className="relative min-h-screen w-full overflow-x-hidden bg-[#EEF4FF] grid grid-cols-1 lg:grid-cols-[1.08fr_0.92fr]">
      {/* Top-left to bottom-right continuous subtle diagonal studio background */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            'radial-gradient(circle at 22% 38%, #FFFFFF 0%, #EFF5FF 48%, #DCE9FD 100%)',
        }}
      />

      {/* Left Brand Showcase Panel matching uploaded artwork */}
      <section
        aria-label="Al-Bushra Brand Showcase"
        className="relative z-10 min-h-[300px] sm:min-h-[380px] lg:min-h-screen w-full overflow-hidden bg-[#E9F1FF]"
      >
        <img
          src="/assets/aistudio/Al-Bushra_Printing_Management_System_abaa54bf.png"
          alt="Al-Bushra Printing Management System showcase"
          referrerPolicy="no-referrer"
          className="block h-full w-[198%] max-w-none object-cover object-left select-none"
        />

        {/* Soft studio edge blend where left showcase meets right login stage */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 hidden w-20 bg-gradient-to-r from-transparent to-[#EEF4FF] lg:block"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-b from-transparent to-[#EEF4FF] lg:hidden"
        />
      </section>

      {/* Right Authentication Card Stage */}
      <main className="relative z-10 flex flex-col items-center justify-center overflow-hidden px-5 pt-14 pb-8 sm:px-10 lg:py-10">
        {/* Diagonal Royal-Blue Studio Stripes Background matching reference right side */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden"
        >
          <div
            className="absolute -top-24 right-[-18%] h-[135%] w-[56%] rotate-[24deg]"
            style={{
              background:
                'linear-gradient(180deg, rgba(191,219,254,0.35) 0%, rgba(147,197,253,0.18) 100%)',
            }}
          />
          <div
            className="absolute -top-20 right-[-26%] h-[125%] w-[42%] rotate-[24deg]"
            style={{
              background:
                'linear-gradient(180deg, #1D4ED8 0%, #0E3491 55%, #082166 100%)',
            }}
          />
          <div
            className="hidden sm:block absolute -top-16 right-[-33%] h-[110%] w-[26%] rotate-[24deg]"
            style={{
              background:
                'linear-gradient(180deg, #2563EB 0%, #1E40AF 100%)',
            }}
          />
          {/* Subtle bottom-right royal-blue & crimson wave accent */}
          <svg
            viewBox="0 0 600 110"
            preserveAspectRatio="none"
            className="absolute bottom-0 right-0 h-14 w-full opacity-95"
          >
            <path
              d="M0 110 C220 96, 420 55, 600 18 L600 110 Z"
              fill="#0A2B7A"
            />
            <path
              d="M160 110 C340 94, 480 62, 600 32 L600 44 C480 74, 340 100, 190 110 Z"
              fill="#E11D48"
            />
          </svg>
        </div>

        <div className="relative z-10 w-full max-w-[430px]">
          {/* Elevated White Authentication Card */}
          <div className="relative rounded-[28px] border-2 border-white bg-white shadow-[0_22px_50px_-10px_rgba(11,44,122,0.35),0_0_0_2px_rgba(37,99,235,0.22)]">
            {/* Floating Circular Glowing Padlock Medallion */}
            <div className="absolute -top-9 left-1/2 z-30 -translate-x-1/2">
              <div
                className="flex h-[74px] w-[74px] items-center justify-center rounded-full border-[3px] border-white shadow-[0_8px_24px_rgba(29,78,216,0.55)]"
                style={{
                  background:
                    'radial-gradient(circle at 32% 28%, #38BDF8 0%, #1D4ED8 54%, #08236A 100%)',
                }}
              >
                <Lock className="h-8 w-8 text-white drop-shadow-xs" strokeWidth={2.3} />
              </div>
            </div>

            {/* Curved Deep Royal-Blue Top Header Wave */}
            <div className="relative overflow-hidden rounded-t-[26px] pt-12 pb-9 text-center text-white">
              <div
                aria-hidden="true"
                className="absolute inset-0"
                style={{
                  background:
                    'linear-gradient(155deg, #071E54 0%, #0F348C 52%, #1D4ED8 100%)',
                }}
              />
              {/* Subtle flanking wing lines beside padlock */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute top-4 left-1/2 flex w-56 -translate-x-1/2 items-center justify-between px-1 opacity-80"
              >
                <span className="h-[2px] w-11 rounded-full bg-gradient-to-r from-transparent to-white" />
                <span className="h-[2px] w-11 rounded-full bg-gradient-to-l from-transparent to-white" />
              </div>

              <div className="relative z-10 px-6">
                <h1 className="text-[22px] sm:text-[24px] font-bold leading-tight tracking-tight text-white [text-wrap:balance]">
                  Al-Bushra
                  <span className="mt-0.5 block text-[21px] sm:text-[23px] font-extrabold text-[#FACC15]">
                    Management System
                  </span>
                </h1>
              </div>

              {/* Smooth Curved White Wave Cutout Transition */}
              <svg
                aria-hidden="true"
                viewBox="0 0 430 48"
                preserveAspectRatio="none"
                className="pointer-events-none absolute -bottom-px left-0 h-8 w-full"
              >
                <path
                  d="M0 12 C110 46, 310 38, 430 0 L430 48 L0 48 Z"
                  fill="#DCEBFF"
                  opacity="0.75"
                />
                <path
                  d="M0 20 C120 50, 320 40, 430 6 L430 48 L0 48 Z"
                  fill="#FFFFFF"
                />
              </svg>
            </div>

            {/* Card Form Body */}
            <div className="relative z-10 bg-white px-6 pt-3 pb-5 sm:px-8">
              {loginStatusNotice && (
                <div
                  role="status"
                  className="mb-4 flex items-start gap-2 rounded-xl border border-emerald-200 bg-[#ECFDF5] px-3 py-2.5 text-[12px] font-medium text-[#059669]"
                >
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{loginStatusNotice}</span>
                </div>
              )}

              <form
                onSubmit={handleSignInSubmit}
                className="space-y-3.5"
                noValidate
              >
                {/* Username Row with Circular Medallion Icon */}
                <div className="flex items-center gap-3">
                  <label htmlFor="login-username" className="sr-only">
                    Username
                  </label>
                  <div
                    aria-hidden="true"
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#BFDBFE] bg-[#EAF2FF] text-[#0B2C7A] shadow-2xs"
                  >
                    <User className="h-5 w-5" />
                  </div>
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
                    placeholder="Username"
                    className="h-11 w-full rounded-xl border-[1.5px] border-[#60A5FA] bg-white px-4 text-[14px] font-medium text-[#0F172A] placeholder:text-slate-400 transition-colors focus:border-[#1D4ED8] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
                  />
                </div>

                {/* Password Row with Circular Medallion Icon & Toggle */}
                <div className="flex items-center gap-3">
                  <label htmlFor="login-password" className="sr-only">
                    Password
                  </label>
                  <div
                    aria-hidden="true"
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#BFDBFE] bg-[#EAF2FF] text-[#0B2C7A] shadow-2xs"
                  >
                    <Lock className="h-5 w-5" />
                  </div>
                  <div className="relative flex-1">
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
                      placeholder="Password"
                      className="h-11 w-full rounded-xl border-[1.5px] border-[#60A5FA] bg-white pl-4 pr-11 text-[14px] font-medium text-[#0F172A] placeholder:text-slate-400 transition-colors focus:border-[#1D4ED8] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 hover:text-[#10358A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8]/40 cursor-pointer"
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
                    className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-medium text-red-700"
                  >
                    {error}
                  </div>
                )}

                {/* Keep Signed In & Recovery Controls */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5 text-[12px]">
                  <label className="inline-flex cursor-pointer items-center gap-2 font-medium text-slate-600 select-none">
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={keepSignedIn}
                      aria-label="Keep me signed in"
                      onClick={() => setKeepSignedIn((prev) => !prev)}
                      className={`flex h-4 w-4 items-center justify-center rounded-full border transition-colors cursor-pointer ${
                        keepSignedIn
                          ? 'border-[#10358A] bg-[#10358A] text-white'
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
                    className="inline-flex items-center gap-1 font-semibold text-[#10358A] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8]/40 rounded cursor-pointer"
                  >
                    <Mail className="h-3.5 w-3.5" />
                    <span>Forgot password?</span>
                  </button>
                </div>

                {/* Primary Royal-Blue Gradient Login CTA */}
                <button
                  type="submit"
                  className="mt-1 flex h-11 w-full items-center justify-center gap-2 rounded-xl text-[15px] font-bold text-white shadow-[0_6px_18px_rgba(16,53,140,0.38)] transition-all hover:brightness-110 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8] focus-visible:ring-offset-2 cursor-pointer"
                  style={{
                    background:
                      'linear-gradient(180deg, #2563EB 0%, #10358A 70%, #071E54 100%)',
                  }}
                >
                  <LogIn className="h-4 w-4" />
                  <span>Login</span>
                </button>
              </form>

              {/* Horizontal OR Divider */}
              <div className="my-4 flex items-center gap-3">
                <span className="h-px flex-1 bg-slate-200" />
                <span className="rounded-full bg-[#0B2C7A] px-3 py-0.5 text-[11px] font-bold tracking-wide text-white">
                  OR
                </span>
                <span className="h-px flex-1 bg-slate-200" />
              </div>

              {/* Outlined Contact Administrator CTA */}
              <button
                type="button"
                onClick={() => setSupportModal('helpdesk')}
                className="flex h-11 w-full items-center justify-center gap-2.5 rounded-xl border-[1.5px] border-[#60A5FA] bg-white px-4 text-[13.5px] font-bold text-[#10358A] transition-colors hover:bg-[#EFF6FF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8]/40 cursor-pointer"
              >
                <Users className="h-4 w-4 text-[#10358A]" />
                <span>Contact Administrator</span>
              </button>

              {/* Preserved Google Account Cloud Sync Strip */}
              <div className="mt-3.5">
                {cloudConnected ? (
                  <div className="flex items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-[#ECFDF5] px-3.5 py-2 text-[12px] font-medium text-[#059669]">
                    <span className="inline-flex items-center gap-1.5 truncate">
                      <Cloud className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">
                        Cloud Synced{cloudEmail ? ` (${cloudEmail})` : ''}
                      </span>
                    </span>
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  </div>
                ) : (
                  onConnectCloud && (
                    <button
                      type="button"
                      onClick={onConnectCloud}
                      disabled={isConnectingCloud}
                      className="gsi-material-button flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-[#F8FAFC] px-3.5 text-[12px] font-semibold text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-60 cursor-pointer"
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
                        {isConnectingCloud
                          ? 'Connecting Google Cloud Database...'
                          : 'Connect Google Account for Cloud Sync'}
                      </span>
                    </button>
                  )
                )}

                {cloudNotice && (
                  <p className="mt-2 text-center text-[11.5px] font-medium text-slate-600">
                    {cloudNotice}
                  </p>
                )}
              </div>
            </div>

            {/* Curved Deep-Navy Footer Wave with Tagline */}
            <div className="relative overflow-hidden rounded-b-[26px] pt-6 pb-4 text-center text-white">
              <div
                aria-hidden="true"
                className="absolute inset-0"
                style={{
                  background:
                    'linear-gradient(155deg, #10358A 0%, #0B2C7A 55%, #071E54 100%)',
                }}
              />
              <svg
                aria-hidden="true"
                viewBox="0 0 430 34"
                preserveAspectRatio="none"
                className="pointer-events-none absolute top-0 left-0 h-7 w-full"
              >
                <path
                  d="M0 0 L430 0 L430 16 C310 36, 130 6, 0 28 Z"
                  fill="#DBEAFE"
                  opacity="0.7"
                />
                <path
                  d="M0 0 L430 0 L430 8 C310 30, 130 0, 0 22 Z"
                  fill="#FFFFFF"
                />
              </svg>
              <div className="relative z-10 px-6 pt-1">
                <p className="font-serif text-[13.5px] italic tracking-wide text-blue-50">
                  Quality Printing for a Better Future
                </p>
                <span
                  aria-hidden="true"
                  className="mx-auto mt-1 block h-[2px] w-24 rounded-full bg-white/75"
                />
              </div>
            </div>
          </div>

          {/* Preserved Live Portal Link Banner & App Utilities */}
          <LivePortalBanner
            cloudConnected={cloudConnected}
            cloudEmail={cloudEmail}
            compact
          />

          <div className="mt-3 flex flex-wrap items-center justify-center gap-3 text-[12px] text-slate-600">
            <button
              type="button"
              onClick={openRecoveryModal}
              className="font-semibold text-[#10358A] hover:underline cursor-pointer"
            >
              Recovery Verification
            </button>
            <span aria-hidden="true" className="text-slate-300">
              ·
            </span>
            <PWAInstallButton variant="inline" />
          </div>
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
