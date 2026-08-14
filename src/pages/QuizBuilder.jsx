import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Copy, Plus, Trash2, Check } from "lucide-react";
import { BUILDER } from "@/constants/testIds";
import { quizApi, questionApi, parseApiError } from "@/lib/api";

/**
 * QuizBuilder handles both /quiz/new and /quiz/:id/edit.
 *
 * IntellectAI quirks handled here:
 *  - POST /quiz returns a QuizDto with NO id. To recover it, we re-fetch GET /quiz
 *    and match on title (with description as tiebreak) picking the latest.
 *  - POST /question returns a QuestionDto with NO id. To enable deletion we
 *    re-fetch the quiz metadata (which does include questionId[]) and infer
 *    the newest question id.
 *  - GET /question/quiz/{id} returns questions WITHOUT id or correctAnswer —
 *    editing is not supported by the backend; we show a read-only preview and
 *    align local ids with the quiz's questionId[] order.
 */
export default function QuizBuilder() {
        const nav = useNavigate();
        const { id: routeId } = useParams();
        const isNew = !routeId;

        const [quizId, setQuizId] = useState(routeId || null);
        const [title, setTitle] = useState("");
        const [description, setDescription] = useState("");
        const [savingMeta, setSavingMeta] = useState(false);
        const [savedOnce, setSavedOnce] = useState(!isNew);
        const [copyOk, setCopyOk] = useState(false);

        // Questions: [{id?, title, options, correctAnswer}]. `id` is the numeric Long from backend.
        const [questions, setQuestions] = useState([]);
        const [draft, setDraft] = useState({ title: "", options: ["", ""], correctIndex: 0 });
        const [addingQ, setAddingQ] = useState(false);

        // Bootstrap for edit-mode
        useEffect(() => {
                if (isNew) return;
                (async () => {
                        try {
                                const [meta, list] = await Promise.all([
                                        quizApi.getById(routeId),
                                        questionApi.byQuiz(routeId),
                                ]);
                                setTitle(meta.data?.title || "");
                                setDescription(meta.data?.description || "");
                                // Fetch full quiz entity via list to learn questionId[] ordering
                                const allRes = await quizApi.list();
                                const full = (allRes.data || []).find((q) => q.id === routeId);
                                const ids = full?.questionId || [];
                                const items = (list.data || []).map((q, i) => ({
                                        id: ids[i] ?? null,
                                        title: q.title,
                                        options: q.options || [],
                                        correctAnswer: "",
                                }));
                                setQuestions(items);
                        } catch (err) {
                                toast.error(parseApiError(err, "Could not load quiz"));
                        }
                })();
                // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [routeId]);

        // Recover the freshly-created quiz's id by re-listing and matching on title+desc.
        const recoverQuizId = async (t, d) => {
                const res = await quizApi.list();
                const list = res.data || [];
                const matches = list.filter((q) => q.title === t && q.description === d);
                if (matches.length) return matches[matches.length - 1].id;
                const looser = list.filter((q) => q.title === t);
                return looser[looser.length - 1]?.id || null;
        };

        const saveMeta = async () => {
                if (title.trim().length < 3 || description.trim().length < 10) {
                        toast.error("Title 3–120 chars; description 10–1000 chars.");
                        return;
                }
                setSavingMeta(true);
                try {
                        if (!quizId) {
                                await quizApi.create({ title: title.trim(), description: description.trim() });
                                const newId = await recoverQuizId(title.trim(), description.trim());
                                if (!newId) throw new Error("Created but could not resolve new quiz ID");
                                setQuizId(newId);
                                setSavedOnce(true);
                                toast.success("Quiz created");
                                nav(`/quiz/${newId}/edit`, { replace: true });
                        } else {
                                await quizApi.update(quizId, {
                                        title: title.trim(),
                                        description: description.trim(),
                                });
                                toast.success("Quiz updated");
                        }
                } catch (err) {
                        toast.error(parseApiError(err, "Save failed"));
                } finally {
                        setSavingMeta(false);
                }
        };

        const addOption = () =>
                setDraft((d) => (d.options.length >= 6 ? d : { ...d, options: [...d.options, ""] }));
        const removeOption = (i) =>
                setDraft((d) => {
                        if (d.options.length <= 2) return d;
                        const options = d.options.filter((_, idx) => idx !== i);
                        const correctIndex = Math.min(d.correctIndex, options.length - 1);
                        return { ...d, options, correctIndex };
                });
        const setOption = (i, v) =>
                setDraft((d) => {
                        const options = [...d.options];
                        options[i] = v;
                        return { ...d, options };
                });

        const addQuestion = async () => {
                if (!quizId) {
                        toast.error("Save the quiz first.");
                        return;
                }
                const qt = draft.title.trim();
                const opts = draft.options.map((o) => o.trim()).filter((o) => o.length > 0);
                if (qt.length < 5) return toast.error("Question must be at least 5 characters.");
                if (opts.length < 2) return toast.error("Provide at least 2 non-empty options.");
                const correct = draft.options[draft.correctIndex]?.trim();
                if (!correct || !opts.includes(correct))
                        return toast.error("Pick a correct answer that exists in your options.");
                setAddingQ(true);
                try {
                        await questionApi.create({
                                title: qt,
                                options: opts,
                                correctAnswer: correct,
                                quizId,
                        });
                        // Fetch updated quiz to recover latest question id list order
                        const listRes = await quizApi.list();
                        const full = (listRes.data || []).find((q) => q.id === quizId);
                        const ids = full?.questionId || [];
                        const newId = ids[ids.length - 1] ?? null;
                        setQuestions((prev) => [
                                ...prev,
                                { id: newId, title: qt, options: opts, correctAnswer: correct },
                        ]);
                        setDraft({ title: "", options: ["", ""], correctIndex: 0 });
                        toast.success("Question added");
                } catch (err) {
                        toast.error(parseApiError(err, "Could not add question"));
                } finally {
                        setAddingQ(false);
                }
        };

        const removeQuestion = async (idx) => {
                const q = questions[idx];
                if (!q?.id) {
                        toast.error("This question can't be deleted from here (id not known).");
                        return;
                }
                if (!confirm("Delete this question?")) return;
                try {
                        await questionApi.remove(q.id);
                        setQuestions((qs) => qs.filter((_, i) => i !== idx));
                        toast.success("Question deleted");
                } catch (err) {
                        toast.error(parseApiError(err, "Delete failed"));
                }
        };

        const copyId = async () => {
                if (!quizId) return;
                try {
                        await navigator.clipboard.writeText(quizId);
                        setCopyOk(true);
                        setTimeout(() => setCopyOk(false), 1500);
                } catch {}
        };

        return (
                <div className="space-y-14">
                        <div className="flex items-center justify-between">
                                <Link
                                        to="/dashboard"
                                        data-testid={BUILDER.backButton}
                                        className="inline-flex items-center gap-2 overline text-neutral-500 hover:text-neutral-900"
                                >
                                        <ArrowLeft size={14} />
                                        Back to dashboard
                                </Link>
                                {quizId && (
                                        <div className="flex items-center gap-3">
                                                <span
                                                        data-testid={BUILDER.quizIdBadge}
                                                        className="border border-neutral-300 bg-white px-3 py-1.5 font-mono text-xs text-neutral-600"
                                                >
                                                        {quizId}
                                                </span>
                                                <button
                                                        onClick={copyId}
                                                        data-testid={BUILDER.copyQuizIdButton}
                                                        className="inline-flex items-center gap-2 border border-neutral-300 bg-white px-3 py-1.5 text-xs hover-lift"
                                                >
                                                        {copyOk ? <Check size={12} /> : <Copy size={12} />}
                                                        {copyOk ? "Copied" : "Copy ID"}
                                                </button>
                                        </div>
                                )}
                        </div>

                        {/* Meta */}
                        <section>
                                <p className="overline mb-4 text-neutral-500">
                                        {isNew && !quizId ? "New quiz" : "Quiz details"}
                                </p>
                                <div className="space-y-6 border border-neutral-200 bg-white p-8 md:p-10">
                                        <div>
                                                <span className="overline mb-2 block text-neutral-500">Title</span>
                                                <input
                                                        value={title}
                                                        onChange={(e) => setTitle(e.target.value)}
                                                        maxLength={120}
                                                        data-testid={BUILDER.titleInput}
                                                        placeholder="e.g. SQL Fundamentals"
                                                        className="w-full border border-neutral-300 bg-white px-4 py-3 font-display text-2xl font-semibold tracking-tight focus:border-neutral-900 focus:outline-none"
                                                />
                                        </div>
                                        <div>
                                                <span className="overline mb-2 block text-neutral-500">Description</span>
                                                <textarea
                                                        value={description}
                                                        onChange={(e) => setDescription(e.target.value)}
                                                        maxLength={1000}
                                                        rows={4}
                                                        data-testid={BUILDER.descriptionInput}
                                                        placeholder="A short description of what this quiz covers."
                                                        className="w-full resize-none border border-neutral-300 bg-white px-4 py-3 text-sm leading-relaxed focus:border-neutral-900 focus:outline-none"
                                                />
                                        </div>
                                        <div className="flex items-center justify-end">
                                                <button
                                                        onClick={saveMeta}
                                                        disabled={savingMeta}
                                                        data-testid={BUILDER.saveQuizButton}
                                                        className="inline-flex items-center gap-2 bg-neutral-900 px-5 py-3 text-sm font-medium text-white hover:bg-[#002FA7] transition-colors disabled:opacity-60"
                                                >
                                                        {savingMeta ? "Saving…" : quizId ? "Save changes" : "Create quiz"}
                                                </button>
                                        </div>
                                </div>
                        </section>

                        {/* Questions */}
                        {savedOnce && quizId && (
                                <section>
                                        <p className="overline mb-4 text-neutral-500">Questions</p>
                                        <div className="space-y-px bg-neutral-200">
                                                {questions.length === 0 && (
                                                        <div className="border border-neutral-200 bg-white p-10 text-center">
                                                                <p className="text-sm text-neutral-500">
                                                                        No questions yet. Add the first one below.
                                                                </p>
                                                        </div>
                                                )}
                                                {questions.map((q, i) => (
                                                        <div
                                                                key={i}
                                                                data-testid={BUILDER.questionRow}
                                                                className="flex items-start justify-between gap-6 bg-white p-6"
                                                        >
                                                                <div className="flex-1">
                                                                        <p className="overline text-neutral-500">Q{i + 1}</p>
                                                                        <h4 className="mt-2 font-display text-lg font-semibold leading-tight tracking-tight">
                                                                                {q.title}
                                                                        </h4>
                                                                        <ul className="mt-3 grid grid-cols-1 gap-1 md:grid-cols-2">
                                                                                {q.options.map((o, j) => (
                                                                                        <li key={j} className="font-mono text-xs text-neutral-600">
                                                                                                {String.fromCharCode(65 + j)}. {o}
                                                                                        </li>
                                                                                ))}
                                                                        </ul>
                                                                </div>
                                                                <button
                                                                        onClick={() => removeQuestion(i)}
                                                                        disabled={!q.id}
                                                                        data-testid={BUILDER.deleteQuestionButton}
                                                                        title={q.id ? "Delete" : "Cannot delete existing question (id unknown)"}
                                                                        className="inline-flex items-center justify-center border border-neutral-300 bg-white p-2.5 text-neutral-500 hover:border-red-400 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                                                                >
                                                                        <Trash2 size={14} />
                                                                </button>
                                                        </div>
                                                ))}
                                        </div>

                                        {/* Question composer */}
                                        <div className="mt-8 border border-neutral-200 bg-white p-8">
                                                <p className="overline mb-4 text-neutral-500">Add a question</p>
                                                <input
                                                        value={draft.title}
                                                        onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                                                        maxLength={300}
                                                        data-testid={BUILDER.questionTitleInput}
                                                        placeholder="Question text"
                                                        className="w-full border border-neutral-300 bg-white px-4 py-3 font-display text-lg focus:border-neutral-900 focus:outline-none"
                                                />
                                                <div className="mt-6 space-y-3">
                                                        {draft.options.map((opt, i) => (
                                                                <div key={i} className="flex items-center gap-3">
                                                                        <input
                                                                                type="radio"
                                                                                name="correct"
                                                                                checked={draft.correctIndex === i}
                                                                                onChange={() => setDraft({ ...draft, correctIndex: i })}
                                                                                data-testid={`${BUILDER.correctAnswerSelect}-${i}`}
                                                                                className="h-4 w-4 accent-neutral-900"
                                                                                title="Mark as correct answer"
                                                                        />
                                                                        <input
                                                                                value={opt}
                                                                                onChange={(e) => setOption(i, e.target.value)}
                                                                                maxLength={200}
                                                                                data-testid={`${BUILDER.optionInput}-${i}`}
                                                                                placeholder={`Option ${String.fromCharCode(65 + i)}`}
                                                                                className="flex-1 border border-neutral-300 bg-white px-4 py-2.5 text-sm focus:border-neutral-900 focus:outline-none"
                                                                        />
                                                                        <button
                                                                                onClick={() => removeOption(i)}
                                                                                disabled={draft.options.length <= 2}
                                                                                data-testid={BUILDER.removeOptionButton}
                                                                                className="inline-flex items-center justify-center border border-neutral-300 bg-white p-2 text-neutral-500 hover:border-red-400 hover:text-red-600 disabled:opacity-40"
                                                                        >
                                                                                <Trash2 size={12} />
                                                                        </button>
                                                                </div>
                                                        ))}
                                                </div>
                                                <div className="mt-6 flex items-center justify-between">
                                                        <button
                                                                onClick={addOption}
                                                                disabled={draft.options.length >= 6}
                                                                data-testid={BUILDER.addOptionButton}
                                                                className="inline-flex items-center gap-2 border border-neutral-300 bg-white px-4 py-2 text-xs hover-lift disabled:opacity-40"
                                                        >
                                                                <Plus size={12} />
                                                                Add option
                                                        </button>
                                                        <button
                                                                onClick={addQuestion}
                                                                disabled={addingQ}
                                                                data-testid={BUILDER.addQuestionButton}
                                                                className="inline-flex items-center gap-2 bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-[#002FA7] transition-colors disabled:opacity-60"
                                                        >
                                                                <Plus size={14} />
                                                                {addingQ ? "Adding…" : "Add question"}
                                                        </button>
                                                </div>
                                        </div>
                                </section>
                        )}
                </div>
        );
}
