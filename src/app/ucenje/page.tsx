'use client';
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BookOpen, Clock, CheckCircle, Lock } from "lucide-react";

type ProgressEntry = { contentKey: string; status: string; bestPercent: number; passedAt: string | null };
type Segment = { id: string; externalId: string; topicId: string; title: string; position: number; estimatedStudyMinutes: number };
type Topic = { id: string; externalId: string; title: string; position: number };
type ContentData = { topics: Topic[]; segments: Segment[]; progress: ProgressEntry[] };

export default function UcenjePage() {
  const [data, setData] = useState<ContentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/content").then((r) => r.json()).then(setData).catch(() => setError("Greška pri dohvatu sadržaja.")).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="text-slate-500">Učitavanje...</div></div>;
  if (error || !data) return <div className="flex items-center justify-center min-h-screen"><div className="text-red-500">{error ?? "Greška"}</div></div>;

  return (
    <main className="max-w-3xl mx-auto p-6">
      <Link href="/" className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-900 mb-6 text-sm"><ArrowLeft className="h-4 w-4" />Natrag</Link>
      <h1 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2"><BookOpen className="h-6 w-6 text-blue-600" />Nastavni materijali</h1>
      {data.topics.sort((a, b) => a.position - b.position).map((topic) => {
        const topicSegments = data.segments.filter((s) => s.topicId === topic.id).sort((a, b) => a.position - b.position);
        return (
          <div key={topic.id} className="mb-8">
            <h2 className="text-lg font-semibold text-slate-800 mb-3 pb-2 border-b">{topic.position}. {topic.title}</h2>
            <div className="space-y-2">
              {topicSegments.map((seg) => {
                const prog = data.progress.find((p) => p.contentKey === `segment:${seg.externalId}`);
                const status = prog?.status ?? "locked";
                const isPassed = status === "passed";
                const isLocked = status === "locked";
                return (
                  <div key={seg.id} className={`flex items-center gap-3 p-3 rounded-lg border ${isLocked ? "bg-slate-50 text-slate-400 border-slate-200" : "bg-white hover:border-blue-300 cursor-pointer border-slate-200"}`}>
                    {isPassed ? <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" /> : isLocked ? <Lock className="h-5 w-5 text-slate-300 flex-shrink-0" /> : <BookOpen className="h-5 w-5 text-blue-500 flex-shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <div className={`font-medium text-sm ${isLocked ? "text-slate-400" : "text-slate-800"}`}>{seg.title}</div>
                      <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                        <Clock className="h-3 w-3" />{seg.estimatedStudyMinutes} min
                        {prog && prog.bestPercent > 0 && <span className="ml-2 text-blue-500">{prog.bestPercent}%</span>}
                      </div>
                    </div>
                    {!isLocked && <Link href={`/provjera?kind=segment&scopeExternalId=${seg.externalId}`} className="text-xs text-blue-600 hover:underline flex-shrink-0">Test</Link>}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </main>
  );
}
