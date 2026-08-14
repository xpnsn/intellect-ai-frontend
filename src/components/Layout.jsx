import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { NAV } from "@/constants/testIds";

const linkBase =
        "overline text-neutral-500 hover:text-neutral-900 transition-colors duration-200 py-2";
const linkActive = "text-neutral-900 border-b-2 border-neutral-900";

export default function Layout() {
        const { user, logout } = useAuth();
        const navigate = useNavigate();

        const onLogout = () => {
                logout();
                navigate("/login", { replace: true });
        };

        return (
                <div className="min-h-screen bg-[#FAFAFA] text-neutral-900">
                        <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white/85 backdrop-blur-xl">
                                <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 md:px-10">
                                        <Link
                                                to="/dashboard"
                                                data-testid={NAV.brand}
                                                className="font-display text-xl font-bold tracking-tight"
                                        >
                                                Intellect<span className="text-[#002FA7]">.AI</span>
                                        </Link>
                                        <nav className="flex items-center gap-8">
                                                <NavLink
                                                        to="/dashboard"
                                                        data-testid={NAV.dashboardLink}
                                                        className={({ isActive }) =>
                                                                `${linkBase} ${isActive ? linkActive : ""}`
                                                        }
                                                >
                                                        Quizzes
                                                </NavLink>
                                                <NavLink
                                                        to="/tutor"
                                                        data-testid={NAV.tutorLink}
                                                        className={({ isActive }) =>
                                                                `${linkBase} ${isActive ? linkActive : ""}`
                                                        }
                                                >
                                                        AI Tutor
                                                </NavLink>
                                                <NavLink
                                                        to="/profile"
                                                        data-testid={NAV.profileLink}
                                                        className={({ isActive }) =>
                                                                `${linkBase} ${isActive ? linkActive : ""}`
                                                        }
                                                >
                                                        Profile
                                                </NavLink>
                                        </nav>
                                        <div className="flex items-center gap-4">
                                                {user?.username && (
                                                        <span className="hidden text-sm text-neutral-500 md:inline">
                                                                @{user.username}
                                                        </span>
                                                )}
                                                <button
                                                        onClick={onLogout}
                                                        data-testid={NAV.logoutButton}
                                                        className="inline-flex items-center gap-2 border border-neutral-300 bg-white px-4 py-2 text-sm hover-lift"
                                                >
                                                        <LogOut size={14} />
                                                        <span>Sign out</span>
                                                </button>
                                        </div>
                                </div>
                        </header>
                        <main className="mx-auto max-w-7xl px-6 py-10 md:px-10 md:py-16">
                                <Outlet />
                        </main>
                        <footer className="border-t border-neutral-200 py-8 text-center">
                                <p className="overline text-neutral-400">Intellect.AI · Learn by doing</p>
                        </footer>
                </div>
        );
}
