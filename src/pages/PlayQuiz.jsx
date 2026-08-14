import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { X, Send, ArrowLeft } from "lucide-react";
import { PLAY } from "@/constants/testIds";
import { useAuth } from "@/context/AuthContext";
import { classifyPayload, createStompClient, send } from "@/lib/ws";

/**
 * Regular-mode WebSocket play screen.
 *
 * Flow:
 *   connect → publish /app/quiz/start {quizId} → receive QuestionDto
 *   → user picks + submits → publish /app/quiz/answer {answer}
 *   → receive either QuestionDto (more questions) or QuizResult (finished).
 *
 * We branch on payload shape (no discriminator field in the backend).
 */
export default function PlayQuiz() {
        const { id: quizId } = useParams();
        const { token } = useAuth();
        const nav = useNavigate();

        const clientRef = useRef(null);
        const [connState, setConnState] = useState("connecting");
        const [question, setQuestion] = useState(null);
        const [selected, setSelected] = useState(null);
        const [answered, setAnswered] = useState(0);
        const [result, setResult] = useState(null);
        const [error, setError] = useState("");

        useEffect(() => {
                if (!token || !quizId) return;
                const client = createStompClient({
                        token,
                        onConnect: () => {
                                setConnState("connected");
                                send(client, "/app/quiz/start", { quizId });
                        },
                        onMessage: (payload) => {
                                const kind = classifyPayload(payload);
                                if (kind === "question") {
                                        setQuestion(payload);
                                        setSelected(null);
                                } else if (kind === "regular-result") {
                                        setResult(payload);
                                        setQuestion(null);
                                } else if (kind === "ai-feedback") {
                                        setError("Received AI-mode payload on a regular quiz — unexpected.");
                                }
                        },
                        onError: (msg) => setError(msg),
                        onClose: () => setConnState("closed"),
                });
                clientRef.current = client;
                client.activate();
                return () => {
                        // Best-effort: tell server we're done before tearing down the socket.
                        try {
                                if (client.connected) send(client, "/app/quiz/end", {});
                        } catch {}
                        client.deactivate().catch(() => {});
                };
        }, [token, quizId]);

        const submit = () => {
                if (!selected) return;
                if (!send(clientRef.current, "/app/quiz/answer", { answer: selected })) {
                        setError("Not connected. Try refreshing.");
                        return;
                }
                setAnswered((n) => n + 1);
        };

        const scorePercent = useMemo(() => {
                if (!result) return 0;
                if (!result.totalQuestions) return 0;
                return Math.round((result.correctAnswers / result.totalQuestions) * 100);
        }, [result]);

        return (
                <div data-testid={PLAY.root} className="min-h-screen bg-[#FAFAFA] text-neutral-900">
                        <header className="border-b border-neutral-200 bg-white">
                                <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-5 md:px-10">
                                        <Link
                                                to="/dashboard"
                                                data-testid={PLAY.exitButton}
                                                className="inline-flex items-center gap-2 overline text-neutral-500 hover:text-neutral-900"
                                        >
                                                <ArrowLeft size={14} />
                                                Exit
                                        </Link>
                                        <div data-testid={PLAY.progressLabel} className="overline text-neutral-500">
                                                {result
                                                        ? "Complete"
                                                        : question
                                                        ? `Question ${answered + 1}`
                                                        : connState === "connecting"
                                                        ? "Connecting…"
                                                        : "Waiting…"}
                                        </div>
                                </div>
                        </header>

                        <main className="mx-auto max-w-4xl px-6 py-16 md:px-10 md:py-24">
                                {error && (
                                        <div data-testid={PLAY.errorAlert} className="mb-8 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                                                {error}
                                        </div>
                                )}

                                {!question && !result && !error && (
                                        <div data-testid={PLAY.connectingState} className="text-center">
                                                <p className="overline text-neutral-500">Establishing WebSocket…</p>
                                                <h1 className="mt-4 font-display text-3xl font-bold tracking-tight">
                                                        Getting your first question ready.
                                                </h1>
                                        </div>
                                )}

                                {question && !result && (
                                        <div className="fade-slide-in">
                                                <div className="mb-6 flex items-center gap-3">
                                                        {question.concept && (
                                                                <span className="overline border border-neutral-300 bg-white px-3 py-1 text-neutral-600">
                                                                        {question.concept}
                                                                </span>
                                                        )}
                                                        <span className="overline text-neutral-500">
                                                                Difficulty {question.difficulty ?? 1}
                                                        </span>
                                                </div>
                                                <h1
                                                        data-testid={PLAY.questionText}
                                                        className="font-display text-4xl font-bold leading-tight tracking-tight md:text-5xl"
                                                >
                                                        {question.title}
                                                </h1>
                                                <ul className="mt-12 space-y-3">
                                                        {question.options?.map((opt, i) => {
                                                                const isSel = selected === opt;
                                                                return (
                                                                        <li key={i}>
                                                                                <button
                                                                                        onClick={() => setSelected(opt)}
                                                                                        data-testid={`${PLAY.optionButton}-${i}`}
                                                                                        className={`group flex w-full items-center gap-4 border bg-white p-5 text-left transition-colors hover-lift ${
                                                                                                isSel
                                                                                                        ? "border-neutral-900 bg-neutral-50"
                                                                                                        : "border-neutral-300"
                                                                                        }`}
                                                                                >
                                                                                        <span
                                                                                                className={`inline-flex h-8 w-8 flex-none items-center justify-center border font-mono text-sm ${
                                                                                                        isSel
                                                                                                                ? "border-neutral-900 bg-neutral-900 text-white"
                                                                                                                : "border-neutral-300 bg-white"
                                                                                                }`}
                                                                                        >
                                                                                                {String.fromCharCode(65 + i)}
                                                                                        </span>
                                                                                        <span className="text-base leading-relaxed">{opt}</span>
                                                                                </button>
                                                                        </li>
                                                                );
                                                        })}
                                                </ul>
                                                <div className="mt-12 flex justify-end">
                                                        <button
                                                                onClick={submit}
                                                                disabled={!selected}
                                                                data-testid={PLAY.submitAnswerButton}
                                                                className="inline-flex items-center gap-2 bg-neutral-900 px-6 py-3.5 text-sm font-medium text-white hover:bg-[#002FA7] transition-colors disabled:opacity-40"
                                                        >
                                                                <Send size={14} />
                                                                Submit answer
                                                        </button>
                                                </div>
                                        </div>
                                )}

                                {result && (
                                        <div className="fade-slide-in border border-neutral-200 bg-white p-10 md:p-16">
                                                <p className="overline text-neutral-500">Result</p>
                                                <h1 className="mt-3 font-display text-6xl font-bold tracking-tight md:text-7xl">
                                                        <span data-testid={PLAY.resultScore}>{scorePercent}</span>
                                                        <span className="text-neutral-400">%</span>
                                                </h1>
                                                <p className="mt-6 text-lg text-neutral-600">
                                                        You got <span data-testid={PLAY.resultCorrect}>{result.correctAnswers}</span> out of{" "}
                                                        <span data-testid={PLAY.resultTotal}>{result.totalQuestions}</span> correct.
                                                </p>
                                                <div className="mt-12 flex flex-wrap items-center gap-3">
                                                        <button
                                                                onClick={() => nav("/dashboard")}
                                                                className="bg-neutral-900 px-5 py-3 text-sm font-medium text-white hover:bg-[#002FA7] transition-colors"
                                                        >
                                                                Back to dashboard
                                                        </button>
                                                        <button
                                                                onClick={() => window.location.reload()}
                                                                className="border border-neutral-300 bg-white px-5 py-3 text-sm hover-lift"
                                                        >
                                                                Retry quiz
                                                        </button>
                                                </div>
                                                <div className="mt-10 border-t border-neutral-200 pt-6">
                                                        <p className="overline mb-3 text-neutral-500">Your answers</p>
                                                        <ol className="space-y-2">
                                                                {(result.answers || []).map((a, i) => (
                                                                        <li key={i} className="font-mono text-xs text-neutral-500">
                                                                                Q{i + 1} · {a}
                                                                        </li>
                                                                ))}
                                                        </ol>
                                                </div>
                                        </div>
                                )}
                        </main>
                </div>
        );
}
