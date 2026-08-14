import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LOGIN } from "@/constants/testIds";
import { useAuth } from "@/context/AuthContext";
import { parseApiError } from "@/lib/api";

export default function Login() {
        const { login } = useAuth();
        const nav = useNavigate();
        const loc = useLocation();
        const from = loc.state?.from || "/dashboard";
        const [username, setUsername] = useState("");
        const [password, setPassword] = useState("");
        const [busy, setBusy] = useState(false);
        const [error, setError] = useState("");

        const onSubmit = async (e) => {
                e.preventDefault();
                setError("");
                setBusy(true);
                try {
                        const result = await login(username.trim(), password);
                        if (!result.verified) nav("/verify", { replace: true });
                        else nav(from, { replace: true });
                } catch (err) {
                        setError(parseApiError(err, "Invalid username or password"));
                } finally {
                        setBusy(false);
                }
        };

        return (
                <AuthShell heading="Welcome back." sub="Sign in to continue where you left off.">
                        <form onSubmit={onSubmit} className="space-y-6">
                                <Field label="Username">
                                        <input
                                                type="text"
                                                autoComplete="username"
                                                data-testid={LOGIN.usernameInput}
                                                value={username}
                                                onChange={(e) => setUsername(e.target.value)}
                                                required
                                                minLength={3}
                                                className="w-full border border-neutral-300 bg-white px-4 py-3 text-sm focus:border-neutral-900 focus:outline-none"
                                        />
                                </Field>
                                <Field label="Password">
                                        <input
                                                type="password"
                                                autoComplete="current-password"
                                                data-testid={LOGIN.passwordInput}
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                required
                                                minLength={8}
                                                className="w-full border border-neutral-300 bg-white px-4 py-3 text-sm focus:border-neutral-900 focus:outline-none"
                                        />
                                </Field>
                                {error && (
                                        <div
                                                data-testid={LOGIN.errorAlert}
                                                className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                                        >
                                                {error}
                                        </div>
                                )}
                                <button
                                        type="submit"
                                        disabled={busy}
                                        data-testid={LOGIN.submitButton}
                                        className="w-full bg-neutral-900 px-4 py-3.5 text-sm font-medium text-white hover:bg-[#002FA7] transition-colors disabled:opacity-60"
                                >
                                        {busy ? "Signing in…" : "Sign in"}
                                </button>
                                <p className="text-center text-sm text-neutral-500">
                                        No account yet?{" "}
                                        <Link
                                                to="/signup"
                                                data-testid={LOGIN.registerLink}
                                                className="text-neutral-900 underline underline-offset-8"
                                        >
                                                Create one
                                        </Link>
                                </p>
                        </form>
                </AuthShell>
        );
}

export function AuthShell({ heading, sub, children }) {
        return (
                <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
                        <aside className="relative hidden overflow-hidden bg-neutral-900 lg:block">
                                <div
                                        className="absolute inset-0 opacity-70"
                                        style={{
                                                backgroundImage:
                                                        "url(https://images.unsplash.com/photo-1614850715649-1d0106293bd1?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2NDJ8MHwxfHNlYXJjaHwxfHxtaW5pbWFsaXN0JTIwYWJzdHJhY3QlMjBnZW9tZXRyaWMlMjBiYWNrZ3JvdW5kfGVufDB8fHx8MTc4MzI3MTY2Mnww&ixlib=rb-4.1.0&q=85)",
                                                backgroundSize: "cover",
                                                backgroundPosition: "center",
                                        }}
                                />
                                <div className="relative z-10 flex h-full flex-col justify-between p-12 text-white">
                                        <Link to="/" className="font-display text-2xl font-bold tracking-tight">
                                                Intellect<span className="text-white/60">.AI</span>
                                        </Link>
                                        <div>
                                                <p className="overline mb-4 text-white/60">Manifesto</p>
                                                <p className="max-w-md font-display text-3xl font-semibold leading-tight tracking-tight">
                                                        Real understanding comes from being asked the right question at the
                                                        right time.
                                                </p>
                                        </div>
                                </div>
                        </aside>
                        <section className="flex items-center justify-center bg-[#FAFAFA] p-8 md:p-16">
                                <div className="w-full max-w-md">
                                        <Link to="/" className="mb-10 inline-block font-display text-lg font-bold tracking-tight lg:hidden">
                                                Intellect<span className="text-[#002FA7]">.AI</span>
                                        </Link>
                                        <p className="overline mb-4 text-neutral-500">Authentication</p>
                                        <h1 className="font-display text-4xl font-bold leading-none tracking-tight md:text-5xl">
                                                {heading}
                                        </h1>
                                        <p className="mt-4 text-neutral-600">{sub}</p>
                                        <div className="mt-10">{children}</div>
                                </div>
                        </section>
                </div>
        );
}

export function Field({ label, children }) {
        return (
                <label className="block">
                        <span className="overline mb-2 block text-neutral-500">{label}</span>
                        {children}
                </label>
        );
}
