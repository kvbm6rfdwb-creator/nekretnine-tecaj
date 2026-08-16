'use client';
import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Mic, Send, CheckCircle, XCircle, RefreshCw, Loader2 } from "lucide-react";

type TopicOption = { externalId: string; title: string };
type OralQuestion = { externalId: string; prompt: string; citations: string[] };
type Professor = { name: string; personalityDescription: string };
type OralAttempt = { oralExamAttemptId: string; topicExternalId: string; professor: Professor; questions: OralQuestion[] };
type SingleGradeResult = { questionExternalId: string; evaluation: { isCorrect: boolean; score: number; missingKeyPoints: string[]; feedback: string; professorTone: string } };
type BatchGradeResult = { passed: boolean; results: SingleGradeResult[] };

export default function UsmeniPage() {
  const [topics, setTopics] = useState<TopicOption[]>([]);
  const [topicsLoading, setTopicsLoading] = useState(true);
  const [selectedTopicId, setSelectedTopicId] = useState("");
  const [attempt, setAttempt] = useState<OralAttempt | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [batchResult, setBatchResult] = useState<BatchGradeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/content")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.topics)) {
          setTopics(
            (data.topics as Array<{ externalId: string; title: string }>).map((t) => ({
              externalId: t.externalId,
              title: t.title,
            }))
          );
        }
      })
      .catch(() => setError("Greška pri učitavanju tema."))
      .finally(() => setTopicsLoading(false));
  }, []);

  const startAttempt = async () => {
    if (!selectedTopicId) return;
    setLoading(true);
    setError(null);
    setBatchResult(null);
    setAnswers({});
    try {
      const res = await fetch("/api/oral/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicExternalId: selectedTopicId, excludedQuestionIds: [] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Greška pri pokretanju usmenog.");
      setAttempt(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Greška");
    }
    setLoading(false);
  };

  const submitBatch = async () => {
    if (!attempt) return;
    setLoading(true);
    setError(null);
    try {
      const answersArray = attempt.questions.map((q) => ({
        questionExternalId: q.externalId,
        answer: answers[q.externalId] ?? "",
      }));
      const res = await fetch("/api/oral/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oralExamAttemptId: attempt.oralExamAttemptId, answers: answersArray }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error((data as { error: string }).error ?? "Greška pri ocjenjivanju.");
      setBatchResult(data as BatchGradeResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Greška");
    }
    setLoading(false);
  };

  const allAnswered =
    attempt !== null &&
    attempt.questions.every((q) => (answers[q.externalId] ?? "").trim().length > 0);

  const reset = () => {
    setAttempt(null);
    setBatchResult(null);
    setAnswers({});
    setError(null);
    setSelectedTopicId("");
  };

  // ── Topic picker ──────────────────────────────────────────────────────────
  if (!attempt) {
    return (
      <main className="max-w-2xl mx-auto p-6">
        <Link href="/" className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-900 mb-6 text-sm">
          <ArrowLeft className="h-4 w-4" />Natrag
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
          <Mic className="h-6 w-6 text-purple-600" />Usmeni ispit
        </h1>
        {error && <div className="text-red-500 mb-4">{error}</div>}
        <div className="bg-white rounded-xl border p-6">
          <label className="block text-sm font-medium text-slate-700 mb-2">Odaberi temu:</label>
          {topicsLoading ? (
            <div className="flex items-center gap-2 text-slate-400 text-sm mb-4">
              <Loader2 className="h-4 w-4 animate-spin" />Učitavanje tema…
            </div>
          ) : (
            <select
              value={selectedTopicId}
              onChange={(e) => setSelectedTopicId(e.target.value)}
              className="w-full border rounded-lg p-2.5 text-sm mb-4 focus:ring-2 focus:ring-purple-400 focus:outline-none"
            >
              <option value="">-- Odaberi temu --</option>
              {topics.map((t) => (
                <option key={t.externalId} value={t.externalId}>
                  {t.title}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={startAttempt}
            disabled={!selectedTopicId || loading || topicsLoading}
            className="w-full bg-purple-600 text-white font-semibold py-3 rounded-xl hover:bg-purple-700 disabled:opacity-50 transition-colors"
          >
            {loading ? "Učitavanje..." : "Počni usmeni"}
          </button>
        </div>
      </main>
    );
  }

  // ── Results view ──────────────────────────────────────────────────────────
  if (batchResult) {
    return (
      <main className="max-w-2xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-4">Usmeni ispit završen</h1>
        <div
          className={`p-4 rounded-lg mb-6 ${
            batchResult.passed
              ? "bg-green-50 border border-green-200"
              : "bg-red-50 border border-red-200"
          }`}
        >
          <div className="flex items-center gap-2 font-semibold mb-1">
            {batchResult.passed ? (
              <CheckCircle className="h-6 w-6 text-green-600" />
            ) : (
              <XCircle className="h-6 w-6 text-red-600" />
            )}
            {batchResult.passed ? "Položeno!" : "Nije položeno"}
          </div>
          <div className="text-sm text-slate-600">
            {batchResult.results.filter((r) => r.evaluation.isCorrect).length}/
            {batchResult.results.length} točnih odgovora
          </div>
        </div>

        <div className="space-y-4 mb-6">
          {batchResult.results.map((r, i) => {
            const q = attempt.questions.find((q) => q.externalId === r.questionExternalId);
            return (
              <div key={r.questionExternalId} className="bg-white rounded-xl border p-4">
                <p className="font-medium text-slate-900 mb-2 text-sm">
                  {i + 1}. {q?.prompt}
                </p>
                <div
                  className={`p-3 rounded-lg ${
                    r.evaluation.isCorrect
                      ? "bg-green-50 border border-green-200"
                      : "bg-red-50 border border-red-200"
                  }`}
                >
                  <div className="flex items-center gap-2 font-semibold text-sm mb-1">
                    {r.evaluation.isCorrect ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-600" />
                    )}
                    {r.evaluation.isCorrect ? "Točno" : "Netočno"} — {r.evaluation.score}/100
                  </div>
                  <p className="text-xs text-slate-700 mb-1">{r.evaluation.feedback}</p>
                  {r.evaluation.missingKeyPoints.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-slate-600 mb-1">Nedostajuće točke:</p>
                      <ul className="text-xs text-slate-600 list-disc list-inside">
                        {r.evaluation.missingKeyPoints.map((p, j) => (
                          <li key={j}>{p}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <button
          onClick={reset}
          className="bg-purple-600 text-white font-semibold py-2 px-6 rounded-xl hover:bg-purple-700 transition-colors flex items-center gap-2"
        >
          <RefreshCw className="h-4 w-4" />Pokušaj ponovo
        </button>
      </main>
    );
  }

  // ── Answer collection view ────────────────────────────────────────────────
  return (
    <main className="max-w-2xl mx-auto p-6">
      <Link href="/" className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-900 mb-6 text-sm">
        <ArrowLeft className="h-4 w-4" />Natrag
      </Link>
      <div className="flex items-center gap-2 mb-4">
        <Mic className="h-5 w-5 text-purple-600" />
        <span className="font-semibold text-slate-800">{attempt.professor.name}</span>
        <span className="ml-auto text-sm text-slate-500">
          {Object.values(answers).filter((a) => a.trim()).length}/{attempt.questions.length} odgovoreno
        </span>
      </div>

      <div className="space-y-5">
        {attempt.questions.map((q, i) => (
          <div key={q.externalId} className="bg-white rounded-xl border p-5">
            <p className="font-medium text-slate-900 mb-3 text-sm">
              {i + 1}. {q.prompt}
            </p>
            <textarea
              value={answers[q.externalId] ?? ""}
              onChange={(e) =>
                setAnswers((prev) => ({ ...prev, [q.externalId]: e.target.value }))
              }
              placeholder="Upišite odgovor ovdje..."
              rows={3}
              className="w-full border rounded-lg p-3 text-sm focus:ring-2 focus:ring-purple-400 focus:outline-none resize-none"
            />
          </div>
        ))}
      </div>

      {error && <div className="text-red-500 text-sm mt-4">{error}</div>}

      <button
        onClick={submitBatch}
        disabled={!allAnswered || loading}
        className="mt-6 w-full bg-purple-600 text-white font-semibold py-3 rounded-xl hover:bg-purple-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />Ocjenjivanje…
          </>
        ) : (
          <>
            <Send className="h-4 w-4" />
            {allAnswered ? "Predaj usmeni" : `Popuni sva pitanja (${Object.values(answers).filter((a) => a.trim()).length}/${attempt.questions.length})`}
          </>
        )}
      </button>
    </main>
  );
}
