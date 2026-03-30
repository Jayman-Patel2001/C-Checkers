export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="h-7 w-40 bg-slate-200 rounded-lg" />
          <div className="h-4 w-56 bg-slate-100 rounded" />
        </div>
        <div className="h-9 w-24 bg-slate-200 rounded-lg" />
      </div>
      {[...Array(2)].map((_, i) => (
        <div key={i} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3.5 border-b bg-slate-50 flex gap-2">
            <div className="w-4 h-4 bg-slate-200 rounded" />
            <div className="h-4 w-24 bg-slate-200 rounded" />
          </div>
          {[...Array(4)].map((_, j) => (
            <div key={j} className="flex items-center gap-4 px-5 py-3.5 border-b border-slate-50">
              <div className="flex-1 h-4 bg-slate-200 rounded" />
              <div className="w-40 h-3 bg-slate-100 rounded" />
              <div className="w-14 h-5 bg-slate-100 rounded-full" />
              <div className="flex gap-1">
                {[...Array(3)].map((_, k) => (
                  <div key={k} className="w-7 h-7 bg-slate-100 rounded-lg" />
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
