/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { ShieldCheck, Activity, X, ArrowLeft } from "lucide-react";
import { UserAccount } from "../types";
import { emailPasswordSignIn, googleSignIn } from "../lib/auth";
import AnimatedButton from "./AnimatedButton";

interface LoginScreenProps {
  onLoginSuccess: (user: UserAccount) => void;
}

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [agreed, setAgreed] = useState(() => {
    return localStorage.getItem("oncosync_agreement_signed") === "true";
  });
  const [showAgreementView, setShowAgreementView] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginSuccess, setLoginSuccess] = useState(false);

  // If already agreed in the past (one-time requirement), checking is persisted
  useEffect(() => {
    localStorage.setItem("oncosync_agreement_signed", agreed ? "true" : "false");
  }, [agreed]);

  const handleGoogleLogin = async () => {
    if (!agreed) {
      setError("Please check and accept the Institutional User Agreement first.");
      return;
    }
    
    setIsLoggingIn(true);
    setError("");
    try {
      const result = await googleSignIn();
      if (result) {
        const email = result.user.email || "";
        const namePart = result.user.displayName || email.split("@")[0] || "User";
        const name = namePart.split(/[._-]/).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");

        onLoginSuccess({
          uid: result.user.uid,
          name,
          email,
          role: "user",
          avatarColor: "bg-natural-brown"
        });
      }
    } catch (err: any) {
      console.error('Google login failed:', err);
      const firebaseCode = err?.code || 'unknown';
      const firebaseMessage = err?.message || 'Failed to sign in with Google.';
      const firebaseDebugTip = firebaseCode === 'auth/invalid-credential'
        ? 'Confirm Google OAuth consent and provider configuration in the Firebase console.'
        : '';

      setError(`Firebase Auth error [${firebaseCode}]: ${firebaseMessage}${firebaseDebugTip ? ` (${firebaseDebugTip})` : ''}`);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!agreed) {
      setError("Please check and accept the Institutional User Agreement first.");
      return;
    }

    if (!email || !email.includes("@")) {
      setError("Please enter a valid institutional email address.");
      return;
    }

    if (password.length < 4) {
      setError("Security credentials must be at least 4 characters.");
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();
    setIsLoggingIn(true);

    try {
      const firebaseUser = await emailPasswordSignIn(normalizedEmail, password);
      const namePart = firebaseUser.displayName || normalizedEmail.split("@")[0];
      const formatName = namePart
        .split(/[._-]/)
        .map(p => p.charAt(0).toUpperCase() + p.slice(1))
        .join(" ");

      onLoginSuccess({
        uid: firebaseUser.uid,
        name: formatName,
        email: normalizedEmail,
        role: "user",
        avatarColor: "bg-natural-brown"
      });
      setLoginSuccess(true);
    } catch (err: any) {
      console.error(err);
      const firebaseCode = err?.code || "";
      const firebaseMessage = err?.message || "Authentication failed.";

      if (firebaseCode === "auth/user-not-found") {
        setError("Firebase Auth: user not found. Confirm that the login exists in Firebase Authentication.");
      } else if (firebaseCode === "auth/wrong-password") {
        setError("Firebase Auth: incorrect password. Please re-enter your credentials.");
      } else if (firebaseCode === "auth/network-request-failed") {
        setError("Firebase Auth network error. Check your internet connection and retry.");
      } else {
        setError(`Firebase Auth error [${firebaseCode || 'unknown'}]: ${firebaseMessage}`);
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleAcceptAndClose = () => {
    setAgreed(true);
    setShowAgreementView(false);
  };

  if (showAgreementView) {
    return (
      <div className="min-h-screen bg-natural-bg dark:bg-natural-bg flex flex-col justify-center py-12 sm:px-6 lg:px-8 transition-colors duration-200 relative overflow-hidden page-fade-in">
        <div className="sm:mx-auto sm:w-full sm:max-w-2xl relative z-10 px-4 sm:px-0">
          <div className="minimal-card rounded-3xl overflow-hidden shadow-2xl relative">
            
            {/* Header with Title and "X" Close Button */}
            <div className="px-6 py-5 border-b border-natural-border/40 flex items-center justify-between bg-theme-surface dark:bg-slate-900">
              <h3 className="text-base font-bold text-slate-800 dark:text-theme-on-accent">
                Terms and User Agreement
              </h3>
              <button 
                type="button"
                onClick={() => setShowAgreementView(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-theme-on-accent hover:bg-slate-150 dark:hover:bg-slate-800 transition-colors"
                title="Back to login"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 sm:p-8 space-y-6">
              <div className="space-y-4 text-slate-700 dark:text-slate-200 text-sm leading-relaxed">
                <p>
                  I confirm I am the Data Controller under PDPA No. 9 of 2022 (Sri Lanka). 
                  I am solely responsible for patient consent and compliance. 
                  The developer bears no responsibility for data use.
                </p>
                <p className="text-amber-800 dark:text-amber-400 font-bold">
                  This web application has been developed for educational purposes only. Not for sale.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="pt-6 border-t border-natural-border/30 flex flex-col sm:flex-row items-center gap-3">
                <button
                  type="button"
                  onClick={handleAcceptAndClose}
                  className="w-full sm:w-auto px-5 py-2.5 text-white rounded-xl text-xs font-bold shadow-md transition-colors cursor-pointer text-center"
                  style={{ backgroundColor: "#2563EB" }}
                >
                  I Confirm & Accept
                </button>
                <button
                  type="button"
                  onClick={() => setShowAgreementView(false)}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  style={{ border: "1px solid #2563EB", color: "#2563EB", backgroundColor: "transparent" }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#2563EB10"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back to Login
                </button>
              </div>

              {/* Copyrights and Version */}
              <div className="text-[11.5px] text-slate-500 dark:text-slate-400 pt-4 border-t border-natural-border/10 space-y-0.5">
                <p className="font-semibold">© All Copyrights reserved for AI DMS Developers</p>
                <p>Version 10.20260530.1 Beta</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-natural-bg dark:bg-natural-bg flex flex-col justify-center py-12 sm:px-6 lg:px-8 transition-colors duration-200 relative overflow-hidden page-fade-in">
      
      <div className="sm:mx-auto sm:w-full sm:max-w-md lg:max-w-lg relative z-10">
        <div className="flex justify-center">
          <div className="h-16 w-16 rounded-2xl flex items-center justify-center text-white shadow-md border border-theme-highlight/10" style={{ backgroundColor: "#2563EB" }}>
            <Activity className="h-10 w-10 animate-pulse" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-bold tracking-tight" style={{ color: "#2563EB" }}>
          AI DMS
        </h2>
        <p className="mt-2 text-center text-sm text-slate-500 dark:text-slate-400 font-semibold">
          Professional Oncology Data Storage & AI Form-Fill Panel
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md lg:max-w-lg relative z-10 px-4 sm:px-0">
        <div className="minimal-card py-8 px-6 sm:px-10 rounded-3xl">
          
          {/* Status Indicators */}
          <div className="mb-6 rounded-2xl p-4 flex gap-3 text-sm text-white" style={{ backgroundColor: "#10B981" }}>
            <ShieldCheck className="h-5 w-5 flex-shrink-0 animate-bounce" />
            <div>
              <p className="font-bold text-xs">Medical Security Protocol Active</p>
              <p className="text-[11.5px] font-semibold mt-0.5 opacity-85">Dual end-to-end data validation. Compliance secured.</p>
            </div>
          </div>

          <form onSubmit={handleFormSubmit} className="space-y-4 animate-fade-in">
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-400 rounded-xl text-xs text-center font-bold">
                {error}
              </div>
            )}

            <div>
              <label className="label-form block mb-1">
                Institutional Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. john.doe@clinic.org"
                className="w-full p-2.5 bg-theme-surface dark:bg-slate-900 border border-slate-400 dark:border-slate-700 rounded-xl text-xs focus:ring-1 focus:ring-natural-accent focus:border-natural-accent outline-none text-slate-800 dark:text-theme-on-accent"
              />
            </div>

            <div>
              <label className="label-form block mb-1">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full p-2.5 bg-theme-surface dark:bg-slate-900 border border-slate-400 dark:border-slate-700 rounded-xl text-xs focus:ring-1 focus:ring-natural-accent focus:border-natural-accent outline-none text-slate-800 dark:text-theme-on-accent"
              />
            </div>

            <AnimatedButton
              type="submit"
              disabled={isLoggingIn}
              loading={isLoggingIn}
              success={loginSuccess}
              variant="primary"
              size="lg"
              fullWidth
              className="border-transparent text-white"
              style={{ backgroundColor: "#2563EB" }}
            >
              Access Clinical Center
            </AnimatedButton>
            
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={isLoggingIn}
              className="w-full flex justify-center items-center gap-2 py-3 px-4 border rounded-xl shadow-sm text-xs font-bold transition-all cursor-pointer"
              style={{ borderColor: "#4285F4", color: "#4285F4", backgroundColor: "transparent" }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#4285F410"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
            >
               Sign in with Google
            </button>

            {/* Terms & User Agreement link at the login card bottom line */}
            <div className="pt-4 mt-4 border-t border-natural-border/30 text-[11.5px] text-slate-700 dark:text-slate-300 flex flex-col items-center justify-center text-center">
              <div className="flex flex-col items-center gap-2">
                {!agreed && (
                  <button
                    type="button"
                    onClick={() => setAgreed(true)}
                    className="px-4 py-1.5 text-white rounded-lg text-xs font-bold transition-colors"
                    style={{ backgroundColor: "#2563EB" }}
                  >
                    I Agree to Terms
                  </button>
                )}
                
                <button
                  type="button"
                  onClick={() => {
                    console.log("Agreement link clicked");
                    setShowAgreementView(true);
                  }}
                  className="font-semibold underline cursor-pointer focus:outline-none relative z-50 text-[11.5px]"
                  style={{ color: "#2563EB" }}
                >
                  View User Agreement
                </button>
                  
                {agreed && (
                  <span className="font-bold text-[11.5px]" style={{ color: "#10B981" }}>
                    Institutional Agreement Accepted
                  </span>
                )}
              </div>
              
              {/* Footer micro branding */}
              <div className="text-[11.5px] font-bold pt-1.5 mt-2 border-t border-natural-border/10 flex flex-col gap-0.5 text-slate-600 dark:text-slate-400 w-full items-center justify-center">
                <span>© AI DMS Developers · v10.20260530.1 Beta</span>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
