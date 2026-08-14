import { useEffect, useMemo, useRef, useState } from "react";
import {
        Play,
        Send,
        Square,
        Zap,
        Check,
        X,
        BookOpen,
        Upload,
        FileText,
        ArrowRight,
        Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { TUTOR } from "@/constants/testIds";
import { useAuth } from "@/context/AuthContext";
import { classifyPayload, createStompClient, send } from "@/lib/ws";
import { documentApi, parseApiError } from "@/lib/api";

/**
 * AI Adaptive Tutor.
 *
 *  Behaviour:
 *  - Start with topic + level (level informational).
 *  - Answer → feedback view: user's picked option highlighted green (correct) or red
 *    (incorrect); explanation shown; next question is cached from the evaluate response
 *    and revealed only when the user clicks "Next".
 *  - Session-scoped documents: user can upload PDFs; RAG toggle becomes usable once ≥1
 *    doc is uploaded. When RAG is ON at "Next" time, we request `/app/ai/quiz/rag`
 *    instead of using the cached roadmap question.
 *  - `topicCompleted=true` → completion screen.
 */
export default function AiTutor() {
        const { token } = useAuth();
        const clientRef = useRef(null);

        // --- Setup / lifecycle
        const [sessionActive, setSessionActive] = useState(false);
        const [starting, setStarting] = useState(false);
        const [topic, setTopic] = useState("");
        const [level, setLevel] = useState("beginner");
        const [sessionId, setSessionId] = useState(null); // client-generated UUID
        const [error, setError] = useState("");
        const [ended, setEnded] = useState(false);
        const [completed, setCompleted] = useState(false);

        // --- Question / answer state
        const [question, setQuestion] = useState(null);
        const [selected, setSelected] = useState(null);
        const [answeredOption, setAnsweredOption] = useState(null); // frozen selection during feedback
        const [feedback, setFeedback] = useState(null); // last evaluate response (display subset)
        const [pendingNextQuestion, setPendingNextQuestion] = useState(null); // cached from evaluate
        const [awaitingRag, setAwaitingRag] = useState(false); // true while waiting for /rag reply

        // --- Progression / mastery
        const [conceptMastery, setConceptMastery] = useState({});
        const [totals, setTotals] = useState({ answered: 0, correct: 0 });
        const [difficulty, setDifficulty] = useState(null);

        // --- Documents / RAG
        const [documents, setDocuments] = useState([]); // [{id, filename, chunks}]
        const [uploading, setUploading] = useState(false);
        const [ragEnabled, setRagEnabled] = useState(false);
        const fileInputRef = useRef(null);

        useEffect(() => {
                return () => {
                        clientRef.current?.deactivate().catch(() => {});
                };
        }, []);

        // Auto-disable RAG if all documents are removed
        useEffect(() => {
                if (documents.length === 0 && ragEnabled) setRagEnabled(false);
        }, [documents.length, ragEnabled]);

        const startSession = () => {
                if (!topic.trim()) {
                        setError("Enter a topic to begin.");
                        return;
                }
                setError("");
                setStarting(true);
                // Generate a stable session id for this AI tutor session. Reused for uploads.
                const sid =
                        (typeof crypto !== "undefined" && crypto.randomUUID?.()) ||
                        `sid-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
                setSessionId(sid);

                const client = createStompClient({
                        token,
                        onConnect: () => {
                                setSessionActive(true);
                                setStarting(false);
                                setEnded(false);
                                setCompleted(false);
                                setQuestion(null);
                                setSelected(null);
                                setAnsweredOption(null);
                                setFeedback(null);
                                setPendingNextQuestion(null);
                                setAwaitingRag(false);
                                setConceptMastery({});
                                setTotals({ answered: 0, correct: 0 });
                                setDifficulty(null);
                                setDocuments([]);
                                setRagEnabled(false);
                                send(client, "/app/ai/quiz/start", { topic: topic.trim(), level });
                        },
                        onMessage: (payload) => {
                                const kind = classifyPayload(payload);
                                if (kind === "question") {
                                        // Either the first question of the session, or the RAG-sourced response
                                        // we're waiting for after user clicked Next with RAG enabled.
                                        setQuestion(payload);
                                        setSelected(null);
                                        setAwaitingRag(false);
                                        if (payload.difficulty != null) setDifficulty(payload.difficulty);
                                } else if (kind === "ai-feedback") {
                                        setFeedback({
                                                previousCorrect: !!payload.previousCorrect,
                                                explanation: payload.explanation,
                                                concept: payload.concept,
                                                conceptMastered: !!payload.conceptMastered,
                                                advanced: !!payload.advanced,
                                                nextConcept: payload.nextConcept,
                                                previousDifficulty: payload.previousDifficulty,
                                                newDifficulty: payload.newDifficulty,
                                        });
                                        if (payload.concept) {
                                                setConceptMastery((prev) => ({
                                                        ...prev,
                                                        [payload.concept]: {
                                                                attempts: payload.conceptAttempts ?? 0,
                                                                correct: payload.conceptCorrect ?? 0,
                                                                accuracy: payload.conceptAccuracy ?? 0,
                                                                mastered: !!payload.conceptMastered,
                                                        },
                                                }));
                                        }
                                        if (payload.totalAnswered != null || payload.totalCorrect != null) {
                                                setTotals({
                                                        answered: payload.totalAnswered ?? 0,
                                                        correct: payload.totalCorrect ?? 0,
                                                });
                                        }
                                        if (payload.newDifficulty != null) setDifficulty(payload.newDifficulty);

                                        if (payload.topicCompleted) {
                                                setCompleted(true);
                                                setQuestion(null);
                                                setPendingNextQuestion(null);
                                        } else {
                                                // Cache the next question. Do NOT display it until user clicks Next.
                                                setPendingNextQuestion(payload.nextQuestion || null);
                                        }
                                }
                        },
                        onError: (msg) => {
                                setError(msg);
                                setStarting(false);
                                setAwaitingRag(false);
                        },
                        onClose: () => {
                                setSessionActive(false);
                        },
                });
                clientRef.current = client;
                client.activate();
        };

        const submit = () => {
                if (!selected || !clientRef.current) return;
                setAnsweredOption(selected);
                if (!send(clientRef.current, "/app/quiz/answer", { answer: selected })) {
                        setError("Not connected.");
                }
        };

        const goToNext = () => {
                if (ragEnabled && documents.length > 0) {
                        // Request a document-grounded question. The response will arrive on
                        // /user/queue/questions as a normal QuestionDto (handled above).
                        setAwaitingRag(true);
                        setQuestion(null);
                        setFeedback(null);
                        setSelected(null);
                        setAnsweredOption(null);
                        setPendingNextQuestion(null);
                        const body = topic.trim() ? { topicOverride: topic.trim() } : {};
                        if (!send(clientRef.current, "/app/ai/quiz/rag", body)) {
                                setError("Not connected.");
                                setAwaitingRag(false);
                        }
                        return;
                }
                // Reveal the cached question we already got in the evaluate response.
                if (pendingNextQuestion) {
                        setQuestion(pendingNextQuestion);
                        setPendingNextQuestion(null);
                }
                setFeedback(null);
                setSelected(null);
                setAnsweredOption(null);
        };

        const endSession = async () => {
                try {
                        if (clientRef.current?.connected) {
                                send(clientRef.current, "/app/quiz/end", {});
                        }
                } catch {}
                setEnded(true);
                setSessionActive(false);
                setQuestion(null);
                setPendingNextQuestion(null);
                setFeedback(null);
                try {
                        await clientRef.current?.deactivate();
                } catch {}
        };

        const onPickFile = (e) => {
                const file = e.target.files?.[0];
                e.target.value = ""; // allow re-upload of same filename
                if (!file) return;
                if (!/\.(pdf|txt|md|docx?)$/i.test(file.name)) {
                        toast.error("Only PDF/DOC/TXT/MD files are supported.");
                        return;
                }
                doUpload(file);
        };

        const doUpload = async (file) => {
                if (!sessionId) {
                        toast.error("Session not ready yet.");
                        return;
                }
                setUploading(true);
                try {
                        const res = await documentApi.upload(sessionId, file);
                        const data = res.data || {};
                        setDocuments((prev) => [
                                ...prev,
                                {
                                        id: data.documentId || data.document_id || `${Date.now()}`,
                                        filename: data.filename || file.name,
                                        chunks: data.chunksIndexed ?? data.chunks_indexed ?? 0,
                                },
                        ]);
                        toast.success(`Uploaded ${file.name}`);
                } catch (err) {
                        toast.error(parseApiError(err, "Upload failed"));
                } finally {
                        setUploading(false);
                }
        };

        const dropDocument = (id) => {
                // No backend delete endpoint yet — this only removes it from the visible list.
                setDocuments((prev) => prev.filter((d) => d.id !== id));
        };

        const masteryEntries = useMemo(
                () => Object.entries(conceptMastery).sort((a, b) => b[1].accuracy - a[1].accuracy),
                [conceptMastery]
        );

        const accuracy = totals.answered ? Math.round((totals.correct / totals.answered) * 100) : 0;
        const inFeedback = !!feedback && !completed;

        // ---------- Screen: Start ----------
        if (!sessionActive && !ended && !completed) {
                return (
                        <div className="mx-auto max-w-2xl space-y-8">
                                <div>
                                        <p className="overline mb-4 text-neutral-500">AI Adaptive Tutor</p>
                                        <h1 className="font-display text-5xl font-bold leading-none tracking-tight md:text-6xl">
                                                Pick a topic. <br />
                                                Get out-questioned.
                                        </h1>
                                        <p className="mt-4 text-neutral-600">
                                                The AI service builds a roadmap for your topic, escalates by mastery,
                                                and ends the session automatically once you've cleared the roadmap.
                                                You can also upload documents to be quizzed from them.
                                        </p>
                                </div>
                                <div className="space-y-5 border border-neutral-200 bg-white p-8">
                                        <div>
                                                <span className="overline mb-2 block text-neutral-500">Topic</span>
                                                <input
                                                        value={topic}
                                                        onChange={(e) => setTopic(e.target.value)}
                                                        data-testid={TUTOR.topicInput}
                                                        placeholder="e.g. SQL, Newtonian mechanics, TCP/IP"
                                                        className="w-full border border-neutral-300 bg-white px-4 py-3 text-base focus:border-neutral-900 focus:outline-none"
                                                />
                                        </div>
                                        <div>
                                                <span className="overline mb-2 block text-neutral-500">
                                                        Starting level (informational)
                                                </span>
                                                <div className="grid grid-cols-3 gap-2">
                                                        {["beginner", "intermediate", "advanced"].map((lv) => (
                                                                <button
                                                                        key={lv}
                                                                        type="button"
                                                                        onClick={() => setLevel(lv)}
                                                                        data-testid={`${TUTOR.levelSelect}-${lv}`}
                                                                        className={`border px-4 py-3 text-sm capitalize transition-colors ${
                                                                                level === lv
                                                                                        ? "border-neutral-900 bg-neutral-900 text-white"
                                                                                        : "border-neutral-300 bg-white hover:border-neutral-900"
                                                                        }`}
                                                                >
                                                                        {lv}
                                                                </button>
                                                        ))}
                                                </div>
                                                <p className="mt-2 text-xs text-neutral-500">
                                                        The adaptive engine always starts on its EASY roadmap and escalates
                                                        as you demonstrate mastery. You can upload a PDF and toggle
                                                        <span className="font-medium"> Ask from document</span> after the session begins.
                                                </p>
                                        </div>
                                        {error && (
                                                <div data-testid={TUTOR.errorAlert} className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                                                        {error}
                                                </div>
                                        )}
                                        <button
                                                onClick={startSession}
                                                disabled={starting}
                                                data-testid={TUTOR.startButton}
                                                className="inline-flex w-full items-center justify-center gap-2 bg-neutral-900 px-4 py-3.5 text-sm font-medium text-white hover:bg-[#002FA7] transition-colors disabled:opacity-60"
                                        >
                                                <Play size={14} />
                                                {starting ? "Connecting…" : "Start session"}
                                        </button>
                                </div>
                        </div>
                );
        }

        // ---------- Screen: Completion (topic done OR user-ended) ----------
        if (ended || completed) {
                const headline = completed ? "Topic complete." : "Nice work.";
                const overline = completed ? "Roadmap finished" : "Session complete";
                return (
                        <div className="mx-auto max-w-3xl space-y-10" data-testid={TUTOR.summaryPanel}>
                                <div>
                                        <p className="overline mb-4 text-neutral-500">{overline}</p>
                                        <h1 className="font-display text-5xl font-bold leading-none tracking-tight md:text-6xl">
                                                {headline}
                                        </h1>
                                        <p className="mt-4 text-neutral-600">
                                                You answered {totals.answered} question{totals.answered === 1 ? "" : "s"} — {accuracy}% correct.
                                        </p>
                                </div>
                                <MasteryBoard entries={masteryEntries} />
                                <div className="flex gap-3">
                                        <button
                                                onClick={() => {
                                                        setEnded(false);
                                                        setCompleted(false);
                                                        setConceptMastery({});
                                                        setTotals({ answered: 0, correct: 0 });
                                                        setFeedback(null);
                                                        setDocuments([]);
                                                        setTopic("");
                                                }}
                                                className="bg-neutral-900 px-5 py-3 text-sm font-medium text-white hover:bg-[#002FA7] transition-colors"
                                        >
                                                Start another session
                                        </button>
                                </div>
                        </div>
                );
        }

        // ---------- Screen: Active session ----------
        return (
                <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_340px]">
                        <div>
                                {question && !inFeedback && (
                                        <div className="fade-slide-in">
                                                <div className="mb-6 flex flex-wrap items-center gap-3">
                                                        <span
                                                                data-testid={TUTOR.difficultyPill}
                                                                className="overline border border-neutral-300 bg-white px-3 py-1 text-neutral-700"
                                                        >
                                                                <Zap size={10} className="mr-1 inline" />
                                                                Difficulty {question.difficulty ?? 1}
                                                        </span>
                                                        {question.concept && (
                                                                <span
                                                                        data-testid={TUTOR.conceptPill}
                                                                        className="overline border border-neutral-300 bg-white px-3 py-1 text-neutral-700"
                                                                >
                                                                        {question.concept}
                                                                </span>
                                                        )}
                                                        {ragEnabled && documents.length > 0 && (
                                                                <span className="overline border border-[#002FA7] bg-[#002FA7]/5 px-3 py-1 text-[#002FA7]">
                                                                        <BookOpen size={10} className="mr-1 inline" />
                                                                        From documents
                                                                </span>
                                                        )}
                                                </div>
                                                <h1
                                                        data-testid={TUTOR.questionText}
                                                        className="font-display text-3xl font-bold leading-tight tracking-tight md:text-4xl"
                                                >
                                                        {question.title}
                                                </h1>
                                                <ul className="mt-10 space-y-3">
                                                        {question.options?.map((opt, i) => {
                                                                const letter = String.fromCharCode(65 + i);
                                                                const isSel = selected === letter;
                                                                return (
                                                                        <li key={i}>
                                                                                <button
                                                                                        onClick={() => setSelected(letter)}
                                                                                        data-testid={`${TUTOR.optionButton}-${i}`}
                                                                                        className={`flex w-full items-center gap-4 border bg-white p-5 text-left transition-colors hover-lift ${
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
                                                                                                {letter}
                                                                                        </span>
                                                                                        <span className="text-base leading-relaxed">{opt}</span>
                                                                                </button>
                                                                        </li>
                                                                );
                                                        })}
                                                </ul>
                                                <div className="mt-10 flex flex-wrap items-center justify-between gap-3">
                                                        <button
                                                                onClick={endSession}
                                                                data-testid={TUTOR.endSessionButton}
                                                                className="inline-flex items-center gap-2 border border-neutral-300 bg-white px-4 py-2.5 text-sm hover-lift"
                                                        >
                                                                <Square size={12} />
                                                                End session
                                                        </button>
                                                        <button
                                                                onClick={submit}
                                                                disabled={!selected}
                                                                data-testid={TUTOR.submitAnswerButton}
                                                                className="inline-flex items-center gap-2 bg-neutral-900 px-6 py-3 text-sm font-medium text-white hover:bg-[#002FA7] transition-colors disabled:opacity-40"
                                                        >
                                                                <Send size={14} />
                                                                Submit answer
                                                        </button>
                                                </div>
                                        </div>
                                )}

                                {inFeedback && (
                                        <FeedbackView
                                                question={question}
                                                answeredOption={answeredOption}
                                                feedback={feedback}
                                                onNext={goToNext}
                                                waitingCache={!pendingNextQuestion && !ragEnabled}
                                                ragOnly={ragEnabled && documents.length > 0}
                                        />
                                )}

                                {!question && !inFeedback && (
                                        <div className="border border-neutral-200 bg-white p-16 text-center">
                                                <p className="overline text-neutral-500">
                                                        {awaitingRag ? "Fetching from documents…" : "Thinking…"}
                                                </p>
                                                <h2 className="mt-3 font-display text-2xl font-semibold tracking-tight">
                                                        Generating your next question.
                                                </h2>
                                        </div>
                                )}

                                {error && (
                                        <div data-testid={TUTOR.errorAlert} className="mt-6 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                                                {error}
                                        </div>
                                )}
                        </div>

                        <aside className="space-y-6">
                                <ProgressCard
                                        answered={totals.answered}
                                        accuracy={accuracy}
                                        difficulty={difficulty}
                                />

                                <DocumentPanel
                                        documents={documents}
                                        uploading={uploading}
                                        ragEnabled={ragEnabled}
                                        onToggleRag={(v) => setRagEnabled(v)}
                                        onPickFile={onPickFile}
                                        onDropDocument={dropDocument}
                                        fileInputRef={fileInputRef}
                                />

                                <MasteryBoard entries={masteryEntries} />
                        </aside>
                </div>
        );
}

function ProgressCard({ answered, accuracy, difficulty }) {
        return (
                <div className="border border-neutral-200 bg-white p-6">
                        <p className="overline text-neutral-500">Progress</p>
                        <div className="mt-4 grid grid-cols-2 gap-4">
                                <Stat label="Answered" value={answered} />
                                <Stat label="Accuracy" value={`${accuracy}%`} />
                        </div>
                        {difficulty != null && (
                                <div className="mt-4 border-t border-neutral-200 pt-4">
                                        <p className="overline text-neutral-500">Current difficulty</p>
                                        <p className="mt-1 font-display text-2xl font-bold tracking-tight">
                                                {difficulty}
                                        </p>
                                </div>
                        )}
                </div>
        );
}

function Stat({ label, value }) {
        return (
                <div>
                        <p className="overline text-neutral-500">{label}</p>
                        <p className="mt-1 font-display text-2xl font-bold tracking-tight">{value}</p>
                </div>
        );
}

function DocumentPanel({
        documents,
        uploading,
        ragEnabled,
        onToggleRag,
        onPickFile,
        onDropDocument,
        fileInputRef,
}) {
        const canToggle = documents.length > 0;
        return (
                <div className="border border-neutral-200 bg-white p-6">
                        <div className="flex items-baseline justify-between gap-2">
                                <p className="overline text-neutral-500">Documents</p>
                                <span className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">
                                        {documents.length} loaded
                                </span>
                        </div>

                        {/* Upload */}
                        <input
                                ref={fileInputRef}
                                type="file"
                                accept=".pdf,.txt,.md,.doc,.docx"
                                onChange={onPickFile}
                                data-testid={TUTOR.uploadInput}
                                className="hidden"
                        />
                        <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploading}
                                data-testid={TUTOR.uploadButton}
                                className="mt-4 inline-flex w-full items-center justify-center gap-2 border border-neutral-900 bg-white px-4 py-2.5 text-xs hover-lift disabled:opacity-60"
                        >
                                <Upload size={12} />
                                {uploading ? "Uploading…" : "Upload PDF"}
                        </button>

                        {/* List */}
                        {documents.length > 0 ? (
                                <ul className="mt-5 space-y-2 border-t border-neutral-200 pt-4">
                                        {documents.map((d) => (
                                                <li
                                                        key={d.id}
                                                        data-testid={TUTOR.documentRow}
                                                        className="flex items-center justify-between gap-2 border border-neutral-200 bg-white px-3 py-2"
                                                >
                                                        <div className="flex min-w-0 items-center gap-2">
                                                                <FileText size={12} className="flex-none text-neutral-500" />
                                                                <span className="truncate font-mono text-xs" title={d.filename}>
                                                                        {d.filename}
                                                                </span>
                                                        </div>
                                                        <div className="flex flex-none items-center gap-2">
                                                                <span className="font-mono text-[10px] text-neutral-400">
                                                                        {d.chunks} chunks
                                                                </span>
                                                                <button
                                                                        onClick={() => onDropDocument(d.id)}
                                                                        className="text-neutral-400 hover:text-red-600"
                                                                        title="Remove from list"
                                                                >
                                                                        <Trash2 size={12} />
                                                                </button>
                                                        </div>
                                                </li>
                                        ))}
                                </ul>
                        ) : (
                                <p className="mt-4 text-xs text-neutral-500">
                                        Upload a PDF to enable document-grounded questions.
                                </p>
                        )}

                        {/* Toggle */}
                        <label
                                className={`mt-5 flex items-center justify-between border p-3 ${
                                        canToggle
                                                ? "cursor-pointer border-neutral-300 bg-white hover:border-neutral-900"
                                                : "cursor-not-allowed border-dashed border-neutral-200 bg-neutral-50 opacity-60"
                                }`}
                        >
                                <div>
                                        <p className="overline text-neutral-700">Ask from document</p>
                                        <p className="mt-1 text-[11px] text-neutral-500">
                                                {canToggle
                                                        ? "Next question is drawn from your uploaded docs."
                                                        : "Upload a document first."}
                                        </p>
                                </div>
                                <input
                                        type="checkbox"
                                        checked={ragEnabled}
                                        onChange={(e) => onToggleRag(e.target.checked)}
                                        disabled={!canToggle}
                                        data-testid={TUTOR.ragToggle}
                                        className="h-4 w-4 accent-[#002FA7]"
                                />
                        </label>
                </div>
        );
}

function FeedbackView({ question, answeredOption, feedback, onNext, waitingCache, ragOnly }) {
        const correct = !!feedback.previousCorrect;
        return (
                <div className="fade-slide-in">
                        <div
                                data-testid={correct ? TUTOR.feedbackCorrect : TUTOR.feedbackWrong}
                                className={`mb-8 border p-5 ${
                                        correct
                                                ? "border-emerald-200 bg-emerald-50"
                                                : "border-red-200 bg-red-50"
                                }`}
                        >
                                <p className="overline flex items-center gap-2 text-neutral-700">
                                        {correct ? <Check size={14} /> : <X size={14} />}
                                        {correct ? "Correct" : "Incorrect"}
                                        {feedback.concept ? ` · ${feedback.concept}` : ""}
                                </p>
                                <p
                                        data-testid={TUTOR.feedbackExplanation}
                                        className="mt-2 text-sm leading-relaxed text-neutral-800"
                                >
                                        {feedback.explanation}
                                </p>
                                {(feedback.conceptMastered || feedback.advanced) && (
                                        <div className="mt-3 flex flex-wrap items-center gap-2">
                                                {feedback.conceptMastered && (
                                                        <span className="overline border border-emerald-300 bg-white px-2.5 py-1 text-emerald-700">
                                                                Concept mastered
                                                        </span>
                                                )}
                                                {feedback.advanced && feedback.nextConcept && (
                                                        <span className="overline border border-neutral-900 bg-white px-2.5 py-1 text-neutral-900">
                                                                Advanced → {feedback.nextConcept}
                                                        </span>
                                                )}
                                                {feedback.previousDifficulty != null &&
                                                        feedback.newDifficulty != null &&
                                                        feedback.newDifficulty !== feedback.previousDifficulty && (
                                                                <span className="overline border border-neutral-300 bg-white px-2.5 py-1 text-neutral-700">
                                                                        Difficulty {feedback.previousDifficulty} → {feedback.newDifficulty}
                                                                </span>
                                                        )}
                                        </div>
                                )}
                        </div>

                        <h1 className="font-display text-3xl font-bold leading-tight tracking-tight md:text-4xl">
                                {question?.title}
                        </h1>

                        <ul className="mt-10 space-y-3">
                                {question?.options?.map((opt, i) => {
                                        const isPicked = opt === answeredOption;
                                        let cls = "border-neutral-200 bg-white text-neutral-500";
                                        let letterCls = "border-neutral-200 bg-white text-neutral-500";
                                        if (isPicked) {
                                                if (correct) {
                                                        cls = "border-emerald-400 bg-emerald-50 text-neutral-900";
                                                        letterCls = "border-emerald-500 bg-emerald-500 text-white";
                                                } else {
                                                        cls = "border-red-400 bg-red-50 text-neutral-900";
                                                        letterCls = "border-red-500 bg-red-500 text-white";
                                                }
                                        }
                                        return (
                                                <li key={i}>
                                                        <div
                                                                data-testid={`tutor-option-review-${i}`}
                                                                className={`flex w-full items-center gap-4 border p-5 text-left ${cls}`}
                                                        >
                                                                <span
                                                                        className={`inline-flex h-8 w-8 flex-none items-center justify-center border font-mono text-sm ${letterCls}`}
                                                                >
                                                                        {isPicked ? (
                                                                                correct ? (
                                                                                        <Check size={14} />
                                                                                ) : (
                                                                                        <X size={14} />
                                                                                )
                                                                        ) : (
                                                                                String.fromCharCode(65 + i)
                                                                        )}
                                                                </span>
                                                                <span className="text-base leading-relaxed">{opt}</span>
                                                                {isPicked && (
                                                                        <span className="ml-auto overline text-neutral-500">
                                                                                Your answer
                                                                        </span>
                                                                )}
                                                        </div>
                                                </li>
                                        );
                                })}
                        </ul>

                        <div className="mt-10 flex flex-wrap items-center justify-between gap-3">
                                <p className="text-xs text-neutral-500">
                                        {ragOnly
                                                ? "Next question will come from your uploaded documents."
                                                : waitingCache
                                                ? "Preparing next question…"
                                                : "Next question is ready."}
                                </p>
                                <button
                                        onClick={onNext}
                                        data-testid={TUTOR.nextButton}
                                        className="inline-flex items-center gap-2 bg-neutral-900 px-6 py-3 text-sm font-medium text-white hover:bg-[#002FA7] transition-colors"
                                >
                                        Next question
                                        <ArrowRight size={14} />
                                </button>
                        </div>
                </div>
        );
}

function MasteryBoard({ entries }) {
        if (!entries.length) {
                return (
                        <div className="border border-neutral-200 bg-white p-6">
                                <p className="overline text-neutral-500">Concept mastery</p>
                                <p className="mt-3 text-sm text-neutral-500">
                                        Answer a few questions to see your concept map fill in.
                                </p>
                        </div>
                );
        }
        return (
                <div className="border border-neutral-200 bg-white p-6">
                        <p className="overline mb-4 text-neutral-500">Concept mastery</p>
                        <ul className="space-y-4">
                                {entries.map(([concept, m]) => {
                                        const raw = typeof m.accuracy === "number" ? m.accuracy : 0;
                                        const pct = Math.max(0, Math.min(100, raw <= 1 ? raw * 100 : raw));
                                        const width = Math.round(pct);
                                        return (
                                                <li key={concept} data-testid={TUTOR.masteryRow}>
                                                        <div className="flex items-baseline justify-between">
                                                                <span className="font-mono text-xs text-neutral-700">
                                                                        {concept}
                                                                        {m.mastered && (
                                                                                <span className="ml-2 text-emerald-700">✓</span>
                                                                        )}
                                                                </span>
                                                                <span className="font-mono text-xs text-neutral-500">
                                                                        {m.correct}/{m.attempts} · {width}%
                                                                </span>
                                                        </div>
                                                        <div className="mt-2 h-1.5 w-full bg-neutral-100">
                                                                <div
                                                                        className={`mastery-bar h-full ${m.mastered ? "bg-emerald-500" : "bg-[#002FA7]"}`}
                                                                        style={{ width: `${width}%` }}
                                                                />
                                                        </div>
                                                </li>
                                        );
                                })}
                        </ul>
                </div>
        );
}
