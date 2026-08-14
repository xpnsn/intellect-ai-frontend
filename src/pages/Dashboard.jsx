import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowUpRight, Play, Pencil, Trash2, Plus, Sparkles, PlusCircle } from "lucide-react";
import { DASHBOARD } from "@/constants/testIds";
import { quizApi, parseApiError } from "@/lib/api";

export default function Dashboard() {
        const nav = useNavigate();
        const [quizzes, setQuizzes] = useState([]);
        const [loading, setLoading] = useState(true);
        const [joinId, setJoinId] = useState("");

        const load = async () => {
                setLoading(true);
                try {
                        const res = await quizApi.list();
                        setQuizzes(Array.isArray(res.data) ? res.data : []);
                } catch (err) {
                        toast.error(parseApiError(err, "Could not load your quizzes"));
                } finally {
                        setLoading(false);
                }
        };

        useEffect(() => {
                load();
        }, []);

        const onDelete = async (id) => {
                if (!confirm("Delete this quiz? This cannot be undone.")) return;
                try {
                        await quizApi.remove(id);
                        setQuizzes((q) => q.filter((x) => x.id !== id));
                        toast.success("Quiz deleted");
                } catch (err) {
                        toast.error(parseApiError(err, "Delete failed"));
                }
        };

        return (
                <div data-testid={DASHBOARD.root} className="space-y-16">
                        {/* Header row */}
                        <section className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
                                <div>
                                        <p className="overline mb-4 text-neutral-500">Dashboard</p>
                                        <h1 className="font-display text-5xl font-bold leading-none tracking-tight md:text-6xl">
                                                Your quiz bank.
                                        </h1>
                                        <p className="mt-4 text-neutral-600">
                                                Author quizzes, share them by ID, or drop into adaptive AI practice.
                                        </p>
                                </div>
                                <div className="flex flex-wrap items-center gap-3">
                                        <Link
                                                to="/tutor"
                                                data-testid={DASHBOARD.aiTutorButton}
                                                className="inline-flex items-center gap-2 border border-neutral-300 bg-white px-5 py-3 text-sm hover-lift"
                                        >
                                                <Sparkles size={16} />
                                                AI Tutor
                                        </Link>
                                        <Link
                                                to="/quiz/new"
                                                data-testid={DASHBOARD.createQuizButton}
                                                className="inline-flex items-center gap-2 bg-neutral-900 px-5 py-3 text-sm font-medium text-white hover:bg-[#002FA7] transition-colors"
                                        >
                                                <Plus size={16} />
                                                New quiz
                                        </Link>
                                </div>
                        </section>

                        {/* Join by ID */}
                        <section className="border border-neutral-200 bg-white p-8 md:p-10">
                                <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
                                        <div>
                                                <p className="overline mb-3 text-neutral-500">Play any quiz</p>
                                                <h3 className="font-display text-2xl font-semibold leading-tight tracking-tight">
                                                        Have a quiz ID? Jump right in.
                                                </h3>
                                                <p className="mt-3 max-w-xl text-sm text-neutral-600">
                                                        Anyone with a quiz ID can play it. You'll connect over WebSocket and
                                                        receive a scored result at the end.
                                                </p>
                                        </div>
                                        <form
                                                onSubmit={(e) => {
                                                        e.preventDefault();
                                                        if (joinId.trim()) nav(`/play/${joinId.trim()}`);
                                                }}
                                                className="flex w-full max-w-md gap-2"
                                        >
                                                <input
                                                        type="text"
                                                        placeholder="Quiz ID (UUID)"
                                                        value={joinId}
                                                        onChange={(e) => setJoinId(e.target.value)}
                                                        data-testid={DASHBOARD.joinByIdInput}
                                                        className="min-w-0 flex-1 border border-neutral-300 bg-white px-4 py-3 font-mono text-sm focus:border-neutral-900 focus:outline-none"
                                                />
                                                <button
                                                        type="submit"
                                                        data-testid={DASHBOARD.joinByIdButton}
                                                        className="inline-flex items-center gap-2 bg-neutral-900 px-5 py-3 text-sm font-medium text-white hover:bg-[#002FA7] transition-colors"
                                                >
                                                        <Play size={14} />
                                                        Play
                                                </button>
                                        </form>
                                </div>
                        </section>

                        {/* Quizzes grid */}
                        <section>
                                <div className="mb-6 flex items-baseline justify-between">
                                        <div>
                                                <p className="overline text-neutral-500">Your quizzes</p>
                                                <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight">
                                                        {loading ? "Loading…" : `${quizzes.length} in your library`}
                                                </h2>
                                        </div>
                                </div>

                                {!loading && quizzes.length === 0 && (
                                        <div
                                                data-testid={DASHBOARD.emptyState}
                                                className="border border-dashed border-neutral-300 bg-white p-16 text-center"
                                        >
                                                <PlusCircle className="mx-auto mb-6 text-neutral-400" size={28} />
                                                <p className="overline mb-3 text-neutral-500">Nothing here yet</p>
                                                <h3 className="font-display text-2xl font-semibold tracking-tight">
                                                        Author your first quiz.
                                                </h3>
                                                <p className="mt-3 text-sm text-neutral-600">
                                                        Give it a title, a short description, and start adding multiple-choice questions.
                                                </p>
                                                <Link
                                                        to="/quiz/new"
                                                        className="mt-8 inline-flex items-center gap-2 bg-neutral-900 px-5 py-3 text-sm font-medium text-white hover:bg-[#002FA7] transition-colors"
                                                >
                                                        <Plus size={16} />
                                                        Create quiz
                                                </Link>
                                        </div>
                                )}

                                <div className="grid grid-cols-1 gap-px bg-neutral-200 md:grid-cols-2 lg:grid-cols-3">
                                        {quizzes.map((q) => (
                                                <article
                                                        key={q.id}
                                                        data-testid={DASHBOARD.quizCard}
                                                        className="group flex flex-col justify-between bg-white p-8 hover-lift"
                                                >
                                                        <div>
                                                                <p className="overline text-neutral-500">
                                                                        {(q.questionId?.length || 0)} question
                                                                        {(q.questionId?.length || 0) === 1 ? "" : "s"}
                                                                </p>
                                                                <h3 className="mt-3 font-display text-xl font-semibold leading-tight tracking-tight">
                                                                        {q.title}
                                                                </h3>
                                                                <p className="mt-3 line-clamp-3 text-sm text-neutral-600">
                                                                        {q.description}
                                                                </p>
                                                                <p className="mt-4 font-mono text-[10px] uppercase tracking-widest text-neutral-400">
                                                                        {q.id}
                                                                </p>
                                                        </div>
                                                        <div className="mt-8 flex items-center gap-2">
                                                                <Link
                                                                        to={`/play/${q.id}`}
                                                                        data-testid={DASHBOARD.quizPlayButton}
                                                                        className="inline-flex flex-1 items-center justify-center gap-2 bg-neutral-900 px-3 py-2.5 text-xs font-medium text-white hover:bg-[#002FA7] transition-colors"
                                                                >
                                                                        <Play size={12} />
                                                                        Play
                                                                </Link>
                                                                <Link
                                                                        to={`/quiz/${q.id}/edit`}
                                                                        data-testid={DASHBOARD.quizEditButton}
                                                                        className="inline-flex items-center justify-center gap-2 border border-neutral-300 bg-white px-3 py-2.5 text-xs hover-lift"
                                                                >
                                                                        <Pencil size={12} />
                                                                        Edit
                                                                </Link>
                                                                <button
                                                                        onClick={() => onDelete(q.id)}
                                                                        data-testid={DASHBOARD.quizDeleteButton}
                                                                        className="inline-flex items-center justify-center border border-neutral-300 bg-white p-2.5 text-neutral-500 hover:border-red-400 hover:text-red-600 transition-colors"
                                                                        aria-label="Delete quiz"
                                                                >
                                                                        <Trash2 size={12} />
                                                                </button>
                                                        </div>
                                                </article>
                                        ))}
                                </div>
                        </section>
                </div>
        );
}
