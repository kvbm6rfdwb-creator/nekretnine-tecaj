'use client';
import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Mic, Send, CheckCircle, XCircle, RefreshCw } from "lucide-react";

type OralQuestion = { externalId: string; prompt: string; citations: string[] };
type Professor = { name: string; personalityDescription: string };
type OralAttempt = { oralExamAttemptId: string; topicExternalId: string; professor: Professor; questions: OralQuestion[] };
type GradeResult = { evaluation: { isCorrect: boolean; score: number; missingKeyPoints: string[]; feedback: string; professorTone: string }; attemptStatus: string; mustRestartProfessor: boolean; remainingQuestionCount: number };

const TOPICS = [
  { id: "tema_1", label: "Tema 1" },
  { id: "tema_2", label: "Tema 2" },
  { id: "tema_3", label: "Tema 3" },
  { id: "tema_4", label: "Tema 4" },
  { id: "tema_5", label: "Tema 5" },
];

export default function UsmeniPage() {
  const [selectedTopicId, setSelectedTopicId] = useState("");
  const [attempt, setAttempt] = useState<OralAttempt | null>(null);
  const [currentQIdx, setCurrentQIdx] = useState(0);
  const [answer, setAnswer] = useState("");
  const [gradeResult, setGradeResult] = useState<GradeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Array<{ q: OralQuestion; result: GradeResult }>>([]);
  const [finished, setFinished] = useState(false);

  const startAttempt = async () => {
    if (!selectedTopicId) return;
    setLoading(true); setError(null); setResults([]); setFinished(false); setCurrentQIdx(0);
    try {
      const res = await fetch("/api/oral/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topicExternalId: selectedTopicId, excludedQuestionIds: [] }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Greška pri pokretanju usmenog.");
      setAttempt(data);
    } catch (e) { setError(e instanceof Error ? e.message : "Greška"); }
    setLoading(false);
  };

  const submitAnswer = async () => {
    if (!attempt || !answer.trim()) return;
    const q = attempt.questions[currentQIdx];
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/oral/grade", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ oralExamAttemptId: attempt.oralExamAttemptId, questionExternalId: q.externalId, answer }) });
      const data: GradeResult = await res.json();
      if (!res.ok) { const d = data as unknown as { error: string }; throw new Error(d.error ?? "Greška pri ocjenjivanju."); }
      setGradeResult(data);
      setResults((prev) => [...prev, { q, result: data }]);
    } catch (e) { setError(e instanceof Error ? e.message : "Greška"); }
    setLoading(false);
  };

  const nextQuestion = () => {
    if (!attempt || !gradeResult) return;
    if (gradeResult.mustRestartProfessor) { setAttempt(null); setGradeResult(null); setAnswer(""); return; }
    if (currentQIdx + 1 >= attempt.questions.length || gradeResult.attemptStatus === "passed") { setFinished(true); return; }
    setCurrentQIdx((i) => i + 1); setGradeResult(null); setAnswer("");
  };

  if (!attempt) {
    return (
      <main className="max-w-2xl mx-auto p-6">
        <Link href="/" className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-900 mb-6 text-sm"><ArrowLeft className="h-4 w-4" />Natrag</Link>
        <h1 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2"><Mic className="h-6 w-6 text-purple-600" />Usmeni ispit</h1>
        {error && <div className="text-red-500 mb-4">{error}</div>}
        <div className="bg-white rounded-xl border p-6">
          <label className="block text-sm font-medium text-slate-700 mb-2">Odaberi temu:</label>
          <select value={selectedTopicId} onChange={(e) => setSelectedTopicId(e.target.value)} className="w-full border rounded-lg p-2.5 text-sm mb-4 focus:ring-2 focus:ring-purple-400 focus:outline-none">
            <option value="">-- Odaberi temu --</option>
            {TOPICS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
          <button onClick={startAttempt} disabled={!selectedTopicId || loading} className="w-full bg-purple-600 text-white font-semibold py-3 rounded-xl hover:bg-purple-700 disabled:opacity-50 transition-colors">
            {loading ? "Učitavanje..." : "Počni usmeni"}
          </button>
        </div>
      </main>
    );
  }

  if (finished) {
    const passed = results.every((r) => r.result.evaluation.isCorrect);
    return (
      <main className="max-w-2xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-4">Usmeni ispit završen</h1>
        <div className={`p-4 rounded-lg mb-6 ${passed ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
          <div className="flex items-center gap-2 font-semibold">
            {passed ? <CheckCircle className="h-6 w-6 text-green-600" /> : <XCircle className="h-6 w-6 text-red-600" />}
            {passed ? "Položeno!" : "Nije položeno"}
          </div>
        </div>
        <button onClick={() => { setAttempt(null); setFinished(false); setResults([]); setGradeResult(null); setAnswer(""); }} className="bg-purple-600 text-white font-semibold py-2 px-6 rounded-xl hover:bg-purple-700 transition-colors flex items-center gap-2">
          <RefreshCw className="h-4 w-4" />Pokušaj ponovo
        </button>
      </main>
    );
  }

  const currentQ = attempt.questions[currentQIdx];
  return (
    <main className="max-w-2xl mx-auto p-6">
      <Link href="/" className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-900 mb-6 text-sm"><ArrowLeft className="h-4 w-4" />Natrag</Link>
      <div className="bg-white rounded-xl border p-6">
        <div className="flex items-center gap-2 mb-4">
          <Mic className="h-5 w-5 text-purple-600" />
          <span className="font-semibold text-slate-800">{attempt.professor.name}</span>
          <span className="ml-auto text-sm text-slate-500">Pitanje {currentQIdx + 1}/{attempt.questions.length}</span>
        </div>
        <p className="text-slate-900 font-medium mb-4">{currentQ.prompt}</p>
        {!gradeResult ? (
          <>
            <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Upišite odgovor ovdje..." className="w-full border rounded-lg p-3 text-sm min-h-[100px] focus:ring-2 focus:ring-purple-400 focus:outline-none mb-3 resize-none" />
            {error && <div className="text-red-500 text-sm mb-2">{error}</div>}
            <button onClick={submitAnswer} disabled={!answer.trim() || loading} className="w-full bg-purple-600 text-white font-semibold py-2.5 rounded-xl hover:bg-purple-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
              <Send className="h-4 w-4" />{loading ? "Ocjenjivanje..." : "Predaj odgovor"}
            </button>
          </>
        ) : (
          <div className={`p-4 rounded-lg border ${gradeResult.evaluation.isCorrect ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
            <div className="flex items-center gap-2 font-semibold mb-2">
              {gradeResult.evaluation.isCorrect ? <CheckCircle className="h-5 w-5 text-green-600" /> : <XCircle className="h-5 w-5 text-red-600" />}
              {gradeResult.evaluation.isCorrect ? "Točno" : "Netočno"} — {gradeResult.evaluation.score}/100
            </div>
            <p className="text-sm text-slate-700 mb-2">{gradeResult.evaluation.feedback}</p>
            {gradeResult.evaluation.missingKeyPoints.length > 0 && (
              <div><p className="text-xs font-medium text-slate-600 mb-1">Nedostajuće točke:</p><ul className="text-xs text-slate-600 list-disc list-inside">{gradeResult.evaluation.missingKeyPoints.map((p, i) => <li key={i}>{p}</li>)}</ul></div>
            )}
            <button onClick={nextQuestion} className="mt-3 w-full bg-slate-800 text-white font-semibold py-2 rounded-xl hover:bg-slate-900 transition-colors">
              {gradeResult.mustRestartProfessor ? "Profesor te vratio na početak — pokušaj ponovo" : gradeResult.remainingQuestionCount === 0 ? "Završi" : "Sljedeće pitanje"}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
