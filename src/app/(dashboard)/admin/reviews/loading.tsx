export default function Loading() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="h-7 w-36 bg-slate-200 rounded-lg" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 space-y-2">
            <div className="h-3 w-16 bg-slate-100 rounded" />
            <div className="h-6 w-10 bg-slate-200 rounded" />
          </div>
        ))}
      </div>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="border-b border-slate-100 bg-slate-50 px-4 py-3 flex gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-3 w-20 bg-slate-200 rounded" />
          ))}
        </div>
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-slate-50">
            <div className="h-4 w-24 bg-slate-200 rounded" />
            <div className="flex-1 h-4 bg-slate-100 rounded" />
            <div className="h-5 w-14 bg-slate-100 rounded-full" />
            <div className="h-4 w-14 bg-slate-100 rounded" />
            <div className="h-5 w-16 bg-slate-100 rounded-full" />
            <div className="h-8 w-20 bg-slate-100 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}
