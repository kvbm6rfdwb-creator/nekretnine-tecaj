import Link from "next/link";
import { BookOpen, ClipboardList, GraduationCap, Mic } from "lucide-react";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col items-center justify-center p-8">
      <div className="max-w-2xl w-full">
        <div className="text-center mb-10">
          <GraduationCap className="h-16 w-16 mx-auto text-slate-700 mb-4" />
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Tečaj za agenta nekretnina</h1>
          <p className="text-slate-600">Interaktivni tečaj za pripremu stručnog ispita agenta posredovanja u prometu nekretnina</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link href="/ucenje" className="flex flex-col items-center gap-3 p-6 bg-white rounded-xl shadow-sm border hover:shadow-md hover:border-slate-300 transition-all">
            <BookOpen className="h-8 w-8 text-blue-600" />
            <div className="text-center">
              <div className="font-semibold text-slate-900">Učenje</div>
              <div className="text-sm text-slate-500">Pregledaj nastavne materijale</div>
            </div>
          </Link>
          <Link href="/provjera" className="flex flex-col items-center gap-3 p-6 bg-white rounded-xl shadow-sm border hover:shadow-md hover:border-slate-300 transition-all">
            <ClipboardList className="h-8 w-8 text-green-600" />
            <div className="text-center">
              <div className="font-semibold text-slate-900">Provjera znanja</div>
              <div className="text-sm text-slate-500">Testovi i završni ispit</div>
            </div>
          </Link>
          <Link href="/usmeni" className="flex flex-col items-center gap-3 p-6 bg-white rounded-xl shadow-sm border hover:shadow-md hover:border-slate-300 transition-all sm:col-span-2">
            <Mic className="h-8 w-8 text-purple-600" />
            <div className="text-center">
              <div className="font-semibold text-slate-900">Usmeni ispit</div>
              <div className="text-sm text-slate-500">Vježba usmenog odgovaranja s AI profesorom</div>
            </div>
          </Link>
        </div>
      </div>
    </main>
  );
}
