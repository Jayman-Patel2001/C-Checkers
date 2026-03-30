export default function Loading() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="h-7 w-36 bg-slate-200 rounded-lg" />
      <div className="flex gap-2 flex-wrap">
        <div className="h-9 w-28 bg-slate-200 rounded-lg" />
        <div className="h-9 w-28 bg-slate-100 rounded-lg" />
        <div className="h-9 w-28 bg-slate-100 rounded-lg" />
      </div>
      {[...Array(3)].map((_, i) => (
        <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="h-5 w-32 bg-slate-200 rounded" />
              <div className="h-3 w-44 bg-slate-100 rounded" />
            </div>
            <div className="h-5 w-16 bg-slate-100 rounded-full" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[...Array(3)].map((_, j) => (
              <div key={j} className="bg-slate-50 rounded-lg p-3 space-y-1">
                <div className="h-3 w-16 bg-slate-200 rounded" />
                <div className="h-5 w-12 bg-slate-200 rounded" />
              </div>
            ))}
          </div>
          <div className="h-2 bg-slate-100 rounded-full" />
        </div>
      ))}
    </div>
  );
}
