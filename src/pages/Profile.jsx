import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Search, User } from "lucide-react";
import { PROFILE } from "@/constants/testIds";
import { userApi, parseApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export default function Profile() {
        const { username: routeUsername } = useParams();
        const { user: me } = useAuth();
        const [profile, setProfile] = useState(null);
        const [loading, setLoading] = useState(true);
        const [error, setError] = useState("");
        const [lookup, setLookup] = useState("");
        const [lookupResult, setLookupResult] = useState(null);
        const [lookupError, setLookupError] = useState("");
        const [looking, setLooking] = useState(false);

        useEffect(() => {
                (async () => {
                        setLoading(true);
                        setError("");
                        try {
                                const res = routeUsername
                                        ? await userApi.byUsername(routeUsername)
                                        : await userApi.profile();
                                setProfile(res.data);
                        } catch (err) {
                                setError(parseApiError(err, "Could not load profile"));
                        } finally {
                                setLoading(false);
                        }
                })();
        }, [routeUsername]);

        const doLookup = async (e) => {
                e.preventDefault();
                if (!lookup.trim()) return;
                setLooking(true);
                setLookupError("");
                setLookupResult(null);
                try {
                        const res = await userApi.byUsername(lookup.trim());
                        setLookupResult(res.data);
                } catch (err) {
                        setLookupError(parseApiError(err, "User not found"));
                } finally {
                        setLooking(false);
                }
        };

        const isSelf = !routeUsername || (me?.username && profile?.username === me.username);

        return (
                <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1fr_380px]">
                        <section>
                                <p className="overline mb-4 text-neutral-500">
                                        {isSelf ? "Your profile" : "Profile"}
                                </p>
                                <h1 className="font-display text-5xl font-bold leading-none tracking-tight md:text-6xl">
                                        {loading ? "…" : profile?.name || "—"}
                                </h1>
                                {error && (
                                        <div className="mt-6 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                                                {error}
                                        </div>
                                )}
                                {profile && (
                                        <div className="mt-10 grid grid-cols-1 gap-px bg-neutral-200 md:grid-cols-3">
                                                <div className="bg-white p-6">
                                                        <p className="overline text-neutral-500">Username</p>
                                                        <p
                                                                data-testid={PROFILE.usernameLabel}
                                                                className="mt-2 font-mono text-lg text-neutral-900"
                                                        >
                                                                @{profile.username}
                                                        </p>
                                                </div>
                                                <div className="bg-white p-6">
                                                        <p className="overline text-neutral-500">Name</p>
                                                        <p data-testid={PROFILE.nameLabel} className="mt-2 text-lg text-neutral-900">
                                                                {profile.name}
                                                        </p>
                                                </div>
                                                <div className="bg-white p-6">
                                                        <p className="overline text-neutral-500">Email</p>
                                                        <p
                                                                data-testid={PROFILE.emailLabel}
                                                                className="mt-2 text-sm text-neutral-900"
                                                        >
                                                                {profile.email}
                                                        </p>
                                                </div>
                                        </div>
                                )}
                        </section>

                        <aside className="border border-neutral-200 bg-white p-8">
                                <p className="overline mb-4 text-neutral-500">Look up a user</p>
                                <form onSubmit={doLookup} className="flex gap-2">
                                        <input
                                                value={lookup}
                                                onChange={(e) => setLookup(e.target.value)}
                                                data-testid={PROFILE.lookupInput}
                                                placeholder="username"
                                                className="min-w-0 flex-1 border border-neutral-300 bg-white px-3 py-2.5 font-mono text-sm focus:border-neutral-900 focus:outline-none"
                                        />
                                        <button
                                                type="submit"
                                                disabled={looking}
                                                data-testid={PROFILE.lookupButton}
                                                className="inline-flex items-center gap-2 bg-neutral-900 px-4 py-2.5 text-xs font-medium text-white hover:bg-[#002FA7] transition-colors disabled:opacity-60"
                                        >
                                                <Search size={12} />
                                                Find
                                        </button>
                                </form>
                                {lookupResult && (
                                        <div
                                                data-testid={PROFILE.lookupResult}
                                                className="mt-6 border border-neutral-200 p-5"
                                        >
                                                <div className="flex items-center gap-3">
                                                        <div className="flex h-10 w-10 items-center justify-center border border-neutral-300 bg-white">
                                                                <User size={14} />
                                                        </div>
                                                        <div>
                                                                <p className="font-display text-base font-semibold tracking-tight">
                                                                        {lookupResult.name}
                                                                </p>
                                                                <p className="font-mono text-xs text-neutral-500">
                                                                        @{lookupResult.username}
                                                                </p>
                                                        </div>
                                                </div>
                                                <p className="mt-3 text-xs text-neutral-500">{lookupResult.email}</p>
                                        </div>
                                )}
                                {lookupError && (
                                        <p data-testid={PROFILE.lookupError} className="mt-4 text-xs text-red-600">
                                                {lookupError}
                                        </p>
                                )}
                        </aside>
                </div>
        );
}
