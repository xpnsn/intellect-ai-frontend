import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { authApi, userApi, parseApiError } from "@/lib/api";

const AuthContext = createContext(null);

const TOKEN_KEY = "intellect_token";
const USER_KEY = "intellect_user";
const VERIFIED_KEY = "intellect_verified";

export function AuthProvider({ children }) {
        const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || null);
        const [user, setUser] = useState(() => {
                try {
                        const raw = localStorage.getItem(USER_KEY);
                        return raw ? JSON.parse(raw) : null;
                } catch {
                        return null;
                }
        });
        const [isVerified, setIsVerified] = useState(() => localStorage.getItem(VERIFIED_KEY) === "true");
        const [bootstrapping, setBootstrapping] = useState(!!localStorage.getItem(TOKEN_KEY));

        // Persist token/user
        useEffect(() => {
                if (token) localStorage.setItem(TOKEN_KEY, token);
                else localStorage.removeItem(TOKEN_KEY);
        }, [token]);
        useEffect(() => {
                if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
                else localStorage.removeItem(USER_KEY);
        }, [user]);
        useEffect(() => {
                localStorage.setItem(VERIFIED_KEY, String(isVerified));
        }, [isVerified]);

        // On mount, if we have a token, try /user/profile to determine verification + user info
        useEffect(() => {
                if (!token) {
                        setBootstrapping(false);
                        return;
                }
                let cancelled = false;
                (async () => {
                        try {
                                const res = await userApi.profile();
                                if (cancelled) return;
                                setUser(res.data);
                                setIsVerified(true);
                        } catch (err) {
                                if (cancelled) return;
                                const msg = parseApiError(err);
                                if (err?.response?.status === 401 && /not verified/i.test(msg)) {
                                        setIsVerified(false);
                                } else if (err?.response?.status === 401) {
                                        // token invalid → clear
                                        setToken(null);
                                        setUser(null);
                                        setIsVerified(false);
                                }
                        } finally {
                                if (!cancelled) setBootstrapping(false);
                        }
                })();
                return () => {
                        cancelled = true;
                };
        }, [token]);

        const login = useCallback(async (username, password) => {
                const res = await authApi.login({ username, password });
                const jwt = typeof res.data === "string" ? res.data.trim() : "";
                if (!jwt) throw new Error("Empty token from server");
                setToken(jwt);
                // Try profile to detect verified state
                try {
                        const p = await userApi.profile();
                        setUser(p.data);
                        setIsVerified(true);
                        return { verified: true, user: p.data };
                } catch (err) {
                        const msg = parseApiError(err);
                        if (err?.response?.status === 401 && /not verified/i.test(msg)) {
                                setIsVerified(false);
                                setUser({ username });
                                return { verified: false, user: { username } };
                        }
                        throw err;
                }
        }, []);

        const signUp = useCallback(async ({ username, password, name, email }) => {
                const res = await authApi.signUp({ username, password, name, email });
                const jwt = typeof res.data === "string" ? res.data.trim() : "";
                if (!jwt) throw new Error("Empty token from server");
                setToken(jwt);
                setUser({ username, name, email });
                setIsVerified(false);
                return { verified: false };
        }, []);

        const refreshProfile = useCallback(async () => {
                const p = await userApi.profile();
                setUser(p.data);
                setIsVerified(true);
                return p.data;
        }, []);

        const markVerified = useCallback(() => {
                setIsVerified(true);
        }, []);

        const logout = useCallback(() => {
                setToken(null);
                setUser(null);
                setIsVerified(false);
                localStorage.removeItem(TOKEN_KEY);
                localStorage.removeItem(USER_KEY);
                localStorage.removeItem(VERIFIED_KEY);
        }, []);

        const value = useMemo(
                () => ({ token, user, isVerified, bootstrapping, login, signUp, logout, refreshProfile, markVerified }),
                [token, user, isVerified, bootstrapping, login, signUp, logout, refreshProfile, markVerified]
        );

        return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
        const ctx = useContext(AuthContext);
        if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
        return ctx;
}
