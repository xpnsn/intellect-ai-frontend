import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { OTP } from "@/constants/testIds";
import { authApi, parseApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { AuthShell } from "@/pages/Login";

export default function VerifyOtp() {
        const { user, refreshProfile, markVerified, logout } = useAuth();
        const nav = useNavigate();
        const [digits, setDigits] = useState(["", "", "", "", "", ""]);
        const [busy, setBusy] = useState(false);
        const [status, setStatus] = useState("");
        const [error, setError] = useState("");
        const [cooldown, setCooldown] = useState(0);
        const [sending, setSending] = useState(false);

        // On mount, request an OTP once. (Backend has 2-min resend cooldown, which we handle.)
        useEffect(() => {
                (async () => {
                        try {
                                setSending(true);
                                const res = await authApi.generateOtp();
                                setStatus(res.data?.message || "Sent");
                                setCooldown(120);
                        } catch (err) {
                                const msg = parseApiError(err);
                                if (/already verified/i.test(msg)) {
                                        markVerified();
                                        nav("/dashboard", { replace: true });
                                        return;
                                }
                                // Extract seconds from "Timeout of Xm Ys" if present
                                const m = /Timeout of (?:(\d+)m\s*)?(\d+)s/i.exec(msg);
                                if (m) {
                                        const secs = (parseInt(m[1] || "0") * 60) + parseInt(m[2] || "0");
                                        setCooldown(secs);
                                        setStatus("You just requested one — hang tight.");
                                } else {
                                        setError(msg);
                                }
                        } finally {
                                setSending(false);
                        }
                })();
                // eslint-disable-next-line react-hooks/exhaustive-deps
        }, []);

        useEffect(() => {
                if (cooldown <= 0) return;
                const t = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
                return () => clearInterval(t);
        }, [cooldown]);

        const code = useMemo(() => digits.join(""), [digits]);

        const onDigit = (i, v) => {
                const clean = v.replace(/\D/g, "").slice(0, 1);
                const next = [...digits];
                next[i] = clean;
                setDigits(next);
                if (clean && i < 5) {
                        const el = document.getElementById(`otp-cell-${i + 1}`);
                        el?.focus();
                }
        };

        const onKeyDown = (i, e) => {
                if (e.key === "Backspace" && !digits[i] && i > 0) {
                        const el = document.getElementById(`otp-cell-${i - 1}`);
                        el?.focus();
                }
        };

        const onPaste = (e) => {
                const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
                if (!text) return;
                e.preventDefault();
                const next = text.split("").concat(Array(6).fill("")).slice(0, 6);
                setDigits(next);
                const focusIdx = Math.min(text.length, 5);
                const el = document.getElementById(`otp-cell-${focusIdx}`);
                el?.focus();
        };

        const onSubmit = async (e) => {
                e.preventDefault();
                if (code.length !== 6) return;
                setError("");
                setBusy(true);
                try {
                        await authApi.validateOtp(code);
                        toast.success("Verified. Welcome to Intellect.AI");
                        try {
                                await refreshProfile();
                        } catch {
                                markVerified();
                        }
                        nav("/dashboard", { replace: true });
                } catch (err) {
                        setError(parseApiError(err, "Invalid code"));
                        setDigits(["", "", "", "", "", ""]);
                } finally {
                        setBusy(false);
                }
        };

        const resend = async () => {
                setError("");
                try {
                        setSending(true);
                        const res = await authApi.generateOtp();
                        setStatus(res.data?.message || "Sent again");
                        setCooldown(120);
                        toast.success("Code sent");
                } catch (err) {
                        const msg = parseApiError(err);
                        const m = /Timeout of (?:(\d+)m\s*)?(\d+)s/i.exec(msg);
                        if (m) {
                                const secs = (parseInt(m[1] || "0") * 60) + parseInt(m[2] || "0");
                                setCooldown(secs);
                        }
                        setError(msg);
                } finally {
                        setSending(false);
                }
        };

        return (
                <AuthShell heading="Check your inbox." sub={`We sent a 6-digit code${user?.email ? ` to ${user.email}` : ""}. Enter it below to verify.`}>
                        <form onSubmit={onSubmit} className="space-y-8">
                                <div className="flex justify-between gap-2" onPaste={onPaste} data-testid={OTP.input}>
                                        {digits.map((d, i) => (
                                                <input
                                                        key={i}
                                                        id={`otp-cell-${i}`}
                                                        inputMode="numeric"
                                                        autoComplete="one-time-code"
                                                        value={d}
                                                        onChange={(e) => onDigit(i, e.target.value)}
                                                        onKeyDown={(e) => onKeyDown(i, e)}
                                                        maxLength={1}
                                                        aria-label={`Digit ${i + 1}`}
                                                        data-testid={`otp-cell-${i}`}
                                                        className="h-16 w-full border border-neutral-300 bg-white text-center font-mono text-2xl focus:border-neutral-900 focus:outline-none"
                                                />
                                        ))}
                                </div>
                                {status && (
                                        <p data-testid={OTP.statusMessage} className="text-sm text-neutral-500">
                                                {status}
                                        </p>
                                )}
                                {error && (
                                        <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                                                {error}
                                        </div>
                                )}
                                <button
                                        type="submit"
                                        disabled={busy || code.length !== 6}
                                        data-testid={OTP.submitButton}
                                        className="w-full bg-neutral-900 px-4 py-3.5 text-sm font-medium text-white hover:bg-[#002FA7] transition-colors disabled:opacity-60"
                                >
                                        {busy ? "Verifying…" : "Verify"}
                                </button>
                                <div className="flex items-center justify-between text-sm">
                                        <button
                                                type="button"
                                                onClick={resend}
                                                disabled={cooldown > 0 || sending}
                                                data-testid={OTP.resendButton}
                                                className="text-neutral-900 underline underline-offset-8 disabled:cursor-not-allowed disabled:text-neutral-400 disabled:no-underline"
                                        >
                                                {cooldown > 0
                                                        ? `Resend in ${Math.floor(cooldown / 60)}m ${cooldown % 60}s`
                                                        : sending
                                                        ? "Sending…"
                                                        : "Resend code"}
                                        </button>
                                        <button
                                                type="button"
                                                onClick={() => {
                                                        logout();
                                                        nav("/login", { replace: true });
                                                }}
                                                className="text-neutral-500 hover:text-neutral-900"
                                        >
                                                Use another account
                                        </button>
                                </div>
                        </form>
                </AuthShell>
        );
}
