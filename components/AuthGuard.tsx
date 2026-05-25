import React, { useState, useEffect } from 'react';

interface User {
  email: string;
  name: string;
  emailVerified: boolean;
  verificationCode: string;
}

interface AuthGuardProps {
  children: React.ReactNode;
}

const STORAGE_KEY_USER = 'yt_studio_user';
const STORAGE_KEY_USERS_DB = 'yt_studio_users_db';

export default function AuthGuard({ children }: AuthGuardProps) {
  // If the developer bypass environment variable is not explicitly 'true',
  const enableAuth = true;

  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_USER);
    return saved ? JSON.parse(saved) : null;
  });

  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Verification states
  const [verificationInput, setVerificationInput] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [showMailboxSim, setShowMailboxSim] = useState(false);

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(prev => prev - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // If auth is not enabled, bypass and render children directly
  if (!enableAuth) {
    return <>{children}</>;
  }

  const getUsersDB = (): Record<string, { name: string; passwordHash: string; emailVerified: boolean; verificationCode: string }> => {
    const db = localStorage.getItem(STORAGE_KEY_USERS_DB);
    return db ? JSON.parse(db) : {};
  };

  const saveUsersDB = (db: any) => {
    localStorage.setItem(STORAGE_KEY_USERS_DB, JSON.stringify(db));
  };

  const handleAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!email || !password || (isSignUp && !name)) {
      setError('Please fill in all required fields.');
      return;
    }

    const db = getUsersDB();

    if (isSignUp) {
      if (db[email]) {
        setError('An account with this email already exists.');
        return;
      }

      // Generate a 6-digit verification code
      const code = Math.floor(100000 + Math.random() * 900000).toString();

      // Create new user in DB
      db[email] = {
        name,
        passwordHash: password, // In mock, plaintext password is fine
        emailVerified: false,
        verificationCode: code
      };
      saveUsersDB(db);

      const newUser: User = {
        email,
        name,
        emailVerified: false,
        verificationCode: code
      };

      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(newUser));
      setCurrentUser(newUser);
      setSuccess(`Account created! A verification code was sent to ${email}.`);
      setResendCooldown(30);
      setShowMailboxSim(true);
    } else {
      const userRecord = db[email];
      if (!userRecord || userRecord.passwordHash !== password) {
        setError('Invalid email or password.');
        return;
      }

      const loggedInUser: User = {
        email,
        name: userRecord.name,
        emailVerified: userRecord.emailVerified,
        verificationCode: userRecord.verificationCode
      };

      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(loggedInUser));
      setCurrentUser(loggedInUser);
      if (!loggedInUser.emailVerified) {
        setResendCooldown(30);
        setShowMailboxSim(true);
      }
    }
  };

  const handleVerifyCode = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!currentUser) return;

    const db = getUsersDB();
    const userRecord = db[currentUser.email];

    if (!userRecord) {
      setError('User record not found.');
      return;
    }

    if (userRecord.verificationCode === verificationInput.trim()) {
      // Update DB and current session
      userRecord.emailVerified = true;
      db[currentUser.email] = userRecord;
      saveUsersDB(db);

      const verifiedUser = { ...currentUser, emailVerified: true };
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(verifiedUser));
      setCurrentUser(verifiedUser);
      setSuccess('Email successfully verified!');
    } else {
      setError('Invalid verification code. Please check your simulated mailbox.');
    }
  };

  const handleResendEmail = () => {
    if (resendCooldown > 0 || !currentUser) return;
    
    const db = getUsersDB();
    const userRecord = db[currentUser.email];
    if (!userRecord) return;

    const newCode = Math.floor(100000 + Math.random() * 900000).toString();
    userRecord.verificationCode = newCode;
    db[currentUser.email] = userRecord;
    saveUsersDB(db);

    const updatedUser = { ...currentUser, verificationCode: newCode };
    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(updatedUser));
    setCurrentUser(updatedUser);

    setResendCooldown(30);
    setSuccess('A new verification code has been generated and sent.');
    setShowMailboxSim(true);
  };

  const handleLogout = () => {
    localStorage.removeItem(STORAGE_KEY_USER);
    setCurrentUser(null);
    setEmail('');
    setPassword('');
    setName('');
    setError('');
    setSuccess('');
    setVerificationInput('');
    setShowMailboxSim(false);
  };

  // 1. Auth Guard - Login/Signup screen
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 font-sans text-white">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/30 via-slate-950 to-slate-950 pointer-events-none" />
        
        <div className="w-full max-w-md bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 shadow-2xl z-10 space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">
              AI Creator Studio
            </h1>
            <p className="text-slate-400 text-sm">
              {isSignUp ? 'Create an account to start simulation' : 'Sign in to access your dashboard'}
            </p>
          </div>

          {error && (
            <div className="bg-red-500/15 border border-red-500/30 text-red-400 text-xs p-3.5 rounded-xl text-center">
              ⚠️ {error}
            </div>
          )}

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            {isSignUp && (
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Full Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-800 focus:border-indigo-500 focus:outline-none rounded-xl p-3 text-white transition-all"
                  placeholder="John Doe"
                />
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-800 focus:border-indigo-500 focus:outline-none rounded-xl p-3 text-white transition-all"
                placeholder="you@example.com"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-800 focus:border-indigo-500 focus:outline-none rounded-xl p-3 text-white transition-all"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-lg shadow-indigo-500/10 active:scale-[0.98] cursor-pointer"
            >
              {isSignUp ? 'Sign Up' : 'Log In'}
            </button>
          </form>

          <div className="text-center pt-2">
            <button
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError('');
                setSuccess('');
              }}
              className="text-indigo-400 hover:text-indigo-300 text-sm font-semibold transition-colors cursor-pointer"
            >
              {isSignUp ? 'Already have an account? Log In' : "Don't have an account? Sign Up"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. Verification Guard - if user exists but has not verified email
  if (currentUser && !currentUser.emailVerified) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 font-sans text-white">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/30 via-slate-950 to-slate-950 pointer-events-none" />
        
        <div className="w-full max-w-md bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 shadow-2xl z-10 space-y-6">
          <div className="text-center space-y-3">
            <div className="inline-block bg-indigo-500/10 p-4 rounded-full border border-indigo-500/30">
              <span className="text-3xl">✉️</span>
            </div>
            <h1 className="text-2xl font-bold">Verify Your Email</h1>
            <p className="text-slate-400 text-sm">
              We sent a verification code to <span className="text-white font-semibold">{currentUser.email}</span>. Please verify to continue.
            </p>
          </div>

          {success && (
            <div className="bg-green-500/15 border border-green-500/30 text-green-400 text-xs p-3.5 rounded-xl text-center">
              ✅ {success}
            </div>
          )}

          {error && (
            <div className="bg-red-500/15 border border-red-500/30 text-red-400 text-xs p-3.5 rounded-xl text-center">
              ⚠️ {error}
            </div>
          )}

          <form onSubmit={handleVerifyCode} className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block text-center">Enter 6-Digit Code</label>
              <input
                type="text"
                maxLength={6}
                required
                value={verificationInput}
                onChange={(e) => setVerificationInput(e.target.value.replace(/\D/g, ''))}
                className="w-full bg-slate-950/80 border border-slate-800 focus:border-indigo-500 focus:outline-none rounded-xl p-3 text-center tracking-widest text-xl font-bold text-white transition-all"
                placeholder="000000"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-lg active:scale-[0.98] cursor-pointer"
            >
              Verify Code
            </button>
          </form>

          <div className="flex flex-col gap-2 pt-2 text-center text-sm">
            <button
              onClick={handleResendEmail}
              disabled={resendCooldown > 0}
              className="text-indigo-400 hover:text-indigo-300 font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              {resendCooldown > 0 ? `Resend Code in ${resendCooldown}s` : 'Resend Verification Code'}
            </button>
            <button
              onClick={handleLogout}
              className="text-slate-500 hover:text-slate-400 font-semibold transition-colors mt-2 cursor-pointer"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Local Mailbox Simulator (Visible in Local Dev environments) */}
        {showMailboxSim && (
          <div className="mt-8 w-full max-w-md bg-slate-900 border border-indigo-900/50 rounded-2xl p-6 shadow-xl z-10 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-500"></span>
                </span>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Local Dev Mailbox Simulation</h4>
              </div>
              <button 
                onClick={() => setShowMailboxSim(false)}
                className="text-slate-500 hover:text-white text-xs cursor-pointer"
              >
                Hide
              </button>
            </div>
            <div className="bg-slate-950 p-4 rounded-xl space-y-2 text-xs border border-slate-800">
              <p className="text-slate-400 font-semibold">From: <span className="text-indigo-400">noreply@creatorstudio.ai</span></p>
              <p className="text-slate-400 font-semibold">To: <span className="text-white">{currentUser.email}</span></p>
              <p className="text-slate-400 font-semibold border-b border-slate-800/80 pb-2 mb-2">Subject: <span className="text-white">Verify your AI Studio email</span></p>
              <p className="text-slate-300 leading-relaxed">
                Hi {currentUser.name}, thank you for signing up! Please verify your email using the verification code below:
              </p>
              <div className="my-4 text-center">
                <span className="bg-indigo-950 border border-indigo-800 text-indigo-300 font-mono font-bold text-lg py-1.5 px-4 rounded-lg tracking-wider">
                  {currentUser.verificationCode}
                </span>
              </div>
              <p className="text-slate-500 text-[10px] text-center italic">
                Copy this code and paste it into the verification input block above.
              </p>
              <div className="pt-2 text-center">
                <button
                  onClick={() => {
                    setVerificationInput(currentUser.verificationCode);
                    setSuccess("Code auto-filled from simulation mailbox!");
                  }}
                  className="bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 border border-indigo-600/30 text-[10px] font-bold py-1 px-3 rounded-full transition-all cursor-pointer"
                >
                  ⚡ Auto-Fill Code
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 3. User is authenticated and verified: render children
  return <>{children}</>;
}
