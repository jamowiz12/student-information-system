"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { apiRequest, ApiError } from "@/lib/api";

type RegistrationErrors = {
  name?: string[];
  email?: string[];
  password?: string[];
};

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [errors, setErrors] = useState<RegistrationErrors>({});
  const [formError, setFormError] = useState("");
  const [registered, setRegistered] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    setFormError("");

    if (password.length < 8) {
      setErrors({ password: ["Use a password with at least 8 characters."] });
      return;
    }
    if (password !== passwordConfirmation) {
      setErrors({ password: ["The passwords do not match."] });
      return;
    }

    setIsSubmitting(true);
    try {
      await apiRequest("/register", {
        method: "POST",
        body: { name: name.trim(), email: email.trim(), password },
      });
      setRegistered(true);
      setPassword("");
      setPasswordConfirmation("");
    } catch (requestError) {
      if (requestError instanceof ApiError) {
        setErrors(requestError.fieldErrors as RegistrationErrors);
        setFormError(
          Object.keys(requestError.fieldErrors).length
            ? ""
            : requestError.message,
        );
      } else {
        setFormError("Account creation failed. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="register-heading">
        <Link className="brand" href="/">Student Information System</Link>
        <p className="eyebrow">Get started</p>
        <h1 id="register-heading">Create your account</h1>
        <p className="muted">Register to securely access student records.</p>

        {registered ? (
          <div className="success-panel" role="status">
            <p>Your account was created. You can now sign in.</p>
            <Link className="button button-primary button-full" href="/login">
              Go to sign in
            </Link>
          </div>
        ) : (
          <form className="form-stack" onSubmit={handleSubmit}>
            <label className="field">
              <span>Full name</span>
              <input
                autoComplete="name"
                type="text"
                name="name"
                required
                maxLength={255}
                value={name}
                onChange={(event) => setName(event.target.value)}
                aria-describedby={errors.name ? "name-error" : undefined}
              />
              {errors.name?.[0] && <span className="field-error" id="name-error">{errors.name[0]}</span>}
            </label>
            <label className="field">
              <span>Email address</span>
              <input
                autoComplete="email"
                type="email"
                name="email"
                required
                maxLength={255}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                aria-describedby={errors.email ? "email-error" : undefined}
              />
              {errors.email?.[0] && <span className="field-error" id="email-error">{errors.email[0]}</span>}
            </label>
            <label className="field">
              <span>Password</span>
              <input
                autoComplete="new-password"
                type="password"
                name="password"
                required
                minLength={8}
                maxLength={255}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                aria-describedby={errors.password ? "password-error" : "password-help"}
              />
              <span className="field-hint" id="password-help">Use at least 8 characters.</span>
              {errors.password?.[0] && <span className="field-error" id="password-error">{errors.password[0]}</span>}
            </label>
            <label className="field">
              <span>Confirm password</span>
              <input
                autoComplete="new-password"
                type="password"
                name="password_confirmation"
                required
                minLength={8}
                maxLength={255}
                value={passwordConfirmation}
                onChange={(event) => setPasswordConfirmation(event.target.value)}
              />
            </label>
            {formError && <p className="form-error" role="alert">{formError}</p>}
            <button className="button button-primary button-full" disabled={isSubmitting}>
              {isSubmitting ? "Creating account..." : "Create account"}
            </button>
          </form>
        )}

        {!registered && (
          <p className="auth-switch">
            Already registered? <Link href="/login">Sign in</Link>
          </p>
        )}
      </section>
    </main>
  );
}
