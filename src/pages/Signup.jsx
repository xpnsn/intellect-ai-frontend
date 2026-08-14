import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { REGISTER } from "@/constants/testIds";
import { useAuth } from "@/context/AuthContext";
import { parseApiError } from "@/lib/api";
import { AuthShell, Field } from "@/pages/Login";

const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/;

export default function Signup() {
        const { signUp } = useAuth();
        const nav = useNavigate();
        const [form, setForm] = useState({ username: "", name: "", email: "", password: "" });
        const [busy, setBusy] = useState(false);
        const [error, setError] = useState("");

        const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

        const onSubmit = async (e) => {
                e.preventDefault();
                setError("");
                if (form.password.length < 8) {
                        setError("Password must be at least 8 characters.");
                        return;
                }
                if (!PASSWORD_PATTERN.test(form.password)) {
                        setError(
                                "Password must contain an upper, a lower, a digit, and a special character."
                        );
                        return;
                }
                setBusy(true);
                try {
                        await signUp({
                                username: form.username.trim(),
                                name: form.name.trim(),
                                email: form.email.trim(),
                                password: form.password,
                        });
                        nav("/verify", { replace: true });
                } catch (err) {
                        const msg = parseApiError(err, "Sign up failed");
                        // The backend returns 500 for duplicate username/email — soften the message.
                        if (err?.response?.status === 500) {
                                setError("Username or email may already be in use. Try different values.");
                        } else {
                                setError(msg);
                        }
                } finally {
                        setBusy(false);
                }
        };

        return (
                <AuthShell heading="Create your account." sub="Six-digit email verification follows immediately after.">
                        <form onSubmit={onSubmit} className="space-y-5">
                                <Field label="Username">
                                        <input
                                                type="text"
                                                data-testid={REGISTER.usernameInput}
                                                value={form.username}
                                                onChange={set("username")}
                                                required
                                                minLength={3}
                                                maxLength={30}
                                                pattern="[a-zA-Z0-9._\-]+"
                                                className="w-full border border-neutral-300 bg-white px-4 py-3 text-sm focus:border-neutral-900 focus:outline-none"
                                        />
                                </Field>
                                <Field label="Full name">
                                        <input
                                                type="text"
                                                data-testid={REGISTER.nameInput}
                                                value={form.name}
                                                onChange={set("name")}
                                                required
                                                minLength={2}
                                                maxLength={80}
                                                className="w-full border border-neutral-300 bg-white px-4 py-3 text-sm focus:border-neutral-900 focus:outline-none"
                                        />
                                </Field>
                                <Field label="Email">
                                        <input
                                                type="email"
                                                data-testid={REGISTER.emailInput}
                                                value={form.email}
                                                onChange={set("email")}
                                                required
                                                maxLength={120}
                                                className="w-full border border-neutral-300 bg-white px-4 py-3 text-sm focus:border-neutral-900 focus:outline-none"
                                        />
                                </Field>
                                <Field label="Password">
                                        <input
                                                type="password"
                                                data-testid={REGISTER.passwordInput}
                                                value={form.password}
                                                onChange={set("password")}
                                                required
                                                minLength={8}
                                                maxLength={72}
                                                className="w-full border border-neutral-300 bg-white px-4 py-3 text-sm focus:border-neutral-900 focus:outline-none"
                                        />
                                        <span className="mt-2 block text-xs text-neutral-500">
                                                Must have upper, lower, digit and a special character.
                                        </span>
                                </Field>
                                {error && (
                                        <div
                                                data-testid={REGISTER.errorAlert}
                                                className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                                        >
                                                {error}
                                        </div>
                                )}
                                <button
                                        type="submit"
                                        disabled={busy}
                                        data-testid={REGISTER.submitButton}
                                        className="w-full bg-neutral-900 px-4 py-3.5 text-sm font-medium text-white hover:bg-[#002FA7] transition-colors disabled:opacity-60"
                                >
                                        {busy ? "Creating account…" : "Create account"}
                                </button>
                                <p className="text-center text-sm text-neutral-500">
                                        Already have an account?{" "}
                                        <Link
                                                to="/login"
                                                data-testid={REGISTER.loginLink}
                                                className="text-neutral-900 underline underline-offset-8"
                                        >
                                                Sign in
                                        </Link>
                                </p>
                        </form>
                </AuthShell>
        );
}
