import { Link } from "react-router-dom";
import { ArrowUpRight, Sparkles, Zap, GraduationCap } from "lucide-react";

export default function Landing() {
        return (
                <div className="min-h-screen bg-[#FAFAFA] text-neutral-900">
                        {/* Header */}
                        <header className="border-b border-neutral-200">
                                <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 md:px-10">
                                        <div className="font-display text-xl font-bold tracking-tight">
                                                Intellect<span className="text-[#002FA7]">.AI</span>
                                        </div>
                                        <div className="flex items-center gap-4">
                                                <Link
                                                        to="/login"
                                                        className="overline text-neutral-600 hover:text-neutral-900"
                                                        data-testid="landing-login-link"
                                                >
                                                        Sign in
                                                </Link>
                                                <Link
                                                        to="/signup"
                                                        className="inline-flex items-center gap-2 bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-[#002FA7] transition-colors"
                                                        data-testid="landing-signup-link"
                                                >
                                                        Create account
                                                        <ArrowUpRight size={16} />
                                                </Link>
                                        </div>
                                </div>
                        </header>

                        {/* Hero */}
                        <section className="relative overflow-hidden">
                                <div className="grid-lines-bg absolute inset-0 pointer-events-none" />
                                <div className="relative mx-auto max-w-7xl px-6 py-24 md:px-10 md:py-32">
                                        <div className="max-w-4xl">
                                                <p className="overline mb-6 text-neutral-500">
                                                        A quiz engine · adaptive AI tutor
                                                </p>
                                                <h1 className="font-display text-5xl font-bold leading-none tracking-tight md:text-7xl">
                                                        Learn by
                                                        <br />
                                                        being <span className="text-[#002FA7]">questioned</span>.
                                                </h1>
                                                <p className="mt-8 max-w-2xl text-lg leading-relaxed text-neutral-600">
                                                        Build your own quiz banks, share them with a link, or hand the wheel
                                                        to an adaptive AI tutor that tunes difficulty to what you actually
                                                        know — one question at a time.
                                                </p>
                                                <div className="mt-10 flex flex-wrap items-center gap-4">
                                                        <Link
                                                                to="/signup"
                                                                className="inline-flex items-center gap-2 bg-neutral-900 px-6 py-3.5 text-sm font-medium text-white hover:bg-[#002FA7] transition-colors"
                                                                data-testid="landing-cta-primary"
                                                        >
                                                                Get started — it's free
                                                                <ArrowUpRight size={16} />
                                                        </Link>
                                                        <Link
                                                                to="/login"
                                                                className="border border-neutral-300 bg-white px-6 py-3.5 text-sm font-medium hover-lift"
                                                                data-testid="landing-cta-secondary"
                                                        >
                                                                I already have an account
                                                        </Link>
                                                </div>
                                        </div>
                                </div>
                        </section>

                        {/* Feature grid */}
                        <section className="border-t border-neutral-200">
                                <div className="mx-auto grid max-w-7xl grid-cols-1 md:grid-cols-3">
                                        {[
                                                {
                                                        icon: <Sparkles size={20} />,
                                                        label: "Regular Mode",
                                                        title: "Build once, share by link.",
                                                        body: "Author a fixed bank of MCQs. Anyone with the quiz ID can take it live over WebSocket. Scores are persisted.",
                                                },
                                                {
                                                        icon: <Zap size={20} />,
                                                        label: "AI Adaptive Mode",
                                                        title: "One question at a time.",
                                                        body: "Pick a topic + starting level. Difficulty steps ±1 after each answer. Concept-level mastery tracked live.",
                                                },
                                                {
                                                        icon: <GraduationCap size={20} />,
                                                        label: "Meant for practice",
                                                        title: "Study in the open.",
                                                        body: "Explanations after every AI question. Mastery bars per concept. End the session whenever you want.",
                                                },
                                        ].map((f, i) => (
                                                <div
                                                        key={i}
                                                        className="border-b border-neutral-200 p-10 md:border-b-0 md:border-r last:border-r-0"
                                                >
                                                        <div className="mb-6 flex h-10 w-10 items-center justify-center border border-neutral-300 bg-white">
                                                                {f.icon}
                                                        </div>
                                                        <p className="overline mb-3 text-neutral-500">{f.label}</p>
                                                        <h3 className="font-display text-2xl font-semibold leading-tight tracking-tight">
                                                                {f.title}
                                                        </h3>
                                                        <p className="mt-4 text-sm leading-relaxed text-neutral-600">{f.body}</p>
                                                </div>
                                        ))}
                                </div>
                        </section>

                        <footer className="border-t border-neutral-200 py-8">
                                <div className="mx-auto max-w-7xl px-6 md:px-10">
                                        <p className="overline text-neutral-400">
                                                Intellect.AI · A quiz platform for the curious
                                        </p>
                                </div>
                        </footer>
                </div>
        );
}
