
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./lib/supabase";
import LegacyDashboard from "./App.backup";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;

      if (error) setMessage(error.message);
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        if (active) {
          setSession(newSession);
          setLoading(false);
        }
      }
    );

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setBusy(true);

    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { full_name: name.trim() },
          },
        });

        if (error) throw error;

        if (data.session) {
          setMessage("Account created successfully.");
        } else {
          setMessage(
            "Signup submitted. Please check your email to confirm your account."
          );
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) throw error;
      }
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Something went wrong."
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    const { error } = await supabase.auth.signOut();

    if (error) setMessage(error.message);
  }

  if (loading) {
    return <div className="auth-loading">Loading LIC Saathi...</div>;
  }

  if (session) {
    return (
      <>
        <button
          className="auth-logout"
          onClick={handleLogout}
          type="button"
        >
          Log out
        </button>
        <LegacyDashboard />
      </>
    );
  }

  return (
    
<main className="auth-page">
  <section className="auth-brand-panel">
    <div className="auth-brand-top">
      <div className="auth-brand-mark">LIC</div>
      <div>
        <p className="auth-brand-name">LIC Saathi</p>
        <p className="auth-brand-eyebrow">AGENT BUSINESS PORTAL</p>
      </div>
    </div>

    <div className="auth-brand-content">
      <h2>Your business.<br />Better organized.</h2>
      <p>
        Manage customers, policies and premium follow-ups in one
        organized workspace built for insurance agents.
      </p>

      <div className="auth-benefits">
        <div className="auth-benefit">
          <span className="auth-benefit-icon">✓</span>
          Customer and policy records
        </div>
        <div className="auth-benefit">
          <span className="auth-benefit-icon">✓</span>
          Premium tracking and follow-ups
        </div>
        <div className="auth-benefit">
          <span className="auth-benefit-icon">✓</span>
          Personal agent workspace
        </div>
      </div>
    </div>

    <div className="auth-brand-footer">
      LIC Saathi · A simpler way to organize your insurance business.
    </div>
  </section>

  <section className="auth-form-panel">
    <div className="auth-card">
      <h1>{mode === "login" ? "Welcome back" : "Create your account"}</h1>
      <p className="auth-subtitle">
        {mode === "login"
          ? "Sign in to continue to your workspace."
          : "Get started with your personal agent workspace."}
      </p>

      <div className="auth-tabs">
        <button
          type="button"
          className={mode === "login" ? "active" : ""}
          onClick={() => {
            setMode("login");
            setMessage("");
          }}
        >
          Login
        </button>
        <button
          type="button"
          className={mode === "signup" ? "active" : ""}
          onClick={() => {
            setMode("signup");
            setMessage("");
          }}
        >
          Sign Up
        </button>
      </div>

      <form onSubmit={handleSubmit} className="auth-form">
        {mode === "signup" && (
          <label>
            Full name
            <input
              type="text"
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              placeholder="Enter your full name"
            />
          </label>
        )}

        <label>
          Email address
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            placeholder="you@example.com"
          />
        </label>

        <label>
          Password
          <input
            type="password"
            autoComplete={
              mode === "login" ? "current-password" : "new-password"
            }
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={6}
            required
            placeholder="At least 6 characters"
          />
        </label>

        {message && (
          <p className="auth-message" role="status">
            {message}
          </p>
        )}

        <button className="auth-submit" type="submit" disabled={busy}>
          {busy
            ? "Please wait..."
            : mode === "login"
              ? "Sign in to your account →"
              : "Create account →"}
        </button>
      </form>

      <p className="auth-footer">
        Your account is managed through Supabase Authentication.
      </p>
    </div>
  </section>
</main>

  );
}
