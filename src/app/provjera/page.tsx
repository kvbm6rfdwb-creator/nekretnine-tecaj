'use client';
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, CheckCircle, XCircle, ClipboardList } from "lucide-react";
import { Suspense } from "react";

type Question = { externalId: string; prompt: string; questionType: string; options: Array<{ id: string; text: string }>; citations: string[] };
type Assessment = { attemptId: string; kind: string; scopeExternalId: string; passThresholdPercent: number; questions: Question[] };
type AnswerResult = { questionExternalId: string; selectedOptionIds: string[]; isCorrect: boolean; explanation: string; citations: string[] };
type Result = { passed: boolean; percent: number; correctCount: number; totalQuestions: number; answers: AnswerResult[] };

function ProvjeraContent() {
  const searchParams = useSearchParams();
  const kind = (searchParams.get("kind") ?? "segment") as "segment" | "topic" | "final";
  const scopeId = searchParams.get("scopeExternalId") ?? "";

  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAssessment = useCallback(async () => {
    setLoading(true); setError(null); setResult(null); setSelected({});
    try {
      const res = await fetch("/api/attempts/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, scopeExternalId: scopeId || undefined }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Greška pri generiranju testa.");
      setAssessment(data);
    } catch (e) { setError(e instanceof Error ? e.message : "Greška"); }
    setLoading(false);
  }, [kind, scopeId]);

  useEffect(() => { loadAssessment(); }, [loadAssessment]);

  const handleSubmit = async () => {
    if (!assessment) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/attempts/submit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ attemptId: assessment.attemptId, answers: selected }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Greška pri predaji testa.");
      setResult(data);
    } catch (e) { setError(e instanceof Error ? e.message : "Greška"); }
    setSubmitting(false);
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="text-slate-500">Generiranje testa...</div></div>;
  if (error) return <div className="max-w-2xl mx-auto p-6"><div className="text-red-500 mb-4">{error}</div><button onClick={loadAssessment} className="text-blue-600 underline">Pokušaj ponovo</button></div>;
  if (!assessment) return null;

  return (
    <main className="max-w-2xl mx-auto p-6">
      <Link href="/" className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-900 mb-6 text-sm"><ArrowLeft className="h-4 w-4" />Natrag</Link>
      <h1 className="text-2xl font-bold text-slate-900 mb-2 flex items-center gap-2"><ClipboardList className="h-6 w-6 text-green-600" />Provjera znanja</h1>
      <p className="text-sm text-slate-500 mb-6">Prag prolaza: {assessment.passThresholdPercent}%</p>

      {result && (
        <div className={`mb-6 p-4 rounded-lg border ${result.passed ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
          <div className="flex items-center gap-2 font-semibold text-lg mb-1">
            {result.passed ? <CheckCircle className="h-6 w-6 text-green-600" /> : <XCircle className="h-6 w-6 text-red-600" />}
            {result.passed ? "Položeno!" : "Nije položeno"}
          </div>
          <div className="text-slate-700">{result.correctCount}/{result.totalQuestions} točnih — {result.percent}%</div>
        </div>
      )}

      <div className="space-y-6">
        {assessment.questions.map((q, qi) => {
          const answerResult = result?.answers.find((a) => a.questionExternalId === q.externalId);
          return (
            <div key={q.externalId} className="bg-white rounded-xl border p-5">
              <p className="font-medium text-slate-900 mb-3">{qi + 1}. {q.prompt}</p>
              <div className="space-y-2">
                {q.options.map((opt) => {
                  const isSelected = (selected[q.externalId] ?? []).includes(opt.id);
                  const isCorrect = answerResult?.selectedOptionIds.includes(opt.id) && answerResult?.isCorrect;
                  const isWrong = answerResult && isSelected && !answerResult.isCorrect;
                  return (
                    <label key={opt.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${result ? "cursor-default" : "hover:bg-slate-50"} ${isCorrect ? "bg-green-50 border-green-300" : isWrong ? "bg-red-50 border-red-300" : isSelected ? "bg-blue-50 border-blue-300" : "border-slate-200"}`}>
                      <input type="checkbox" disabled={!!result} checked={isSelected} onChange={(e) => {
                        if (result) return;
                        setSelected((prev) => {
                          const curr = prev[q.externalId] ?? [];
                          return { ...prev, [q.externalId]: e.target.checked ? [...curr, opt.id] : curr.filter((id) => id !== opt.id) };
                        });
                      }} className="h-4 w-4" />
                      <span className="text-sm text-slate-700">{opt.text}</span>
                    </label>
                  );
                })}
              </div>
              {answerResult && (
                <div className="mt-3 p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs font-medium text-slate-700 mb-1">{answerResult.isCorrect ? "✓ Točno" : "✗ Netočno"}</p>
                  <p className="text-xs text-slate-600">{answerResult.explanation}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!result && (
        <button onClick={handleSubmit} disabled={submitting} className="mt-6 w-full bg-green-600 text-white font-semibold py-3 rounded-xl hover:bg-green-700 disabled:opacity-50 transition-colors">
          {submitting ? "Predavanje..." : "Predaj test"}
        </button>
      )}
      {result && (
        <button onClick={loadAssessment} className="mt-4 w-full bg-blue-600 text-white font-semibold py-3 rounded-xl hover:bg-blue-700 transition-colors">Novi test</button>
      )}
    </main>
  );
}

export default function ProvjeraPage() {
  return <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="text-slate-500">Učitavanje...</div></div>}><ProvjeraContent /></Suspense>;
}
