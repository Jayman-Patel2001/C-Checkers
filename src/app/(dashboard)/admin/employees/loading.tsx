export default function Loading() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="h-7 w-36 bg-slate-200 rounded-lg" />
          <div className="h-4 w-52 bg-slate-100 rounded" />
        </div>
        <div className="h-9 w-28 bg-slate-200 rounded-lg" />
      </div>
      <div className="flex gap-2">
        <div className="h-9 w-24 bg-slate-200 rounded-lg" />
        <div className="h-9 w-24 bg-slate-100 rounded-lg" />
      </div>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="border-b border-slate-100 bg-slate-50 px-5 py-3 flex gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-3 w-20 bg-slate-200 rounded" />
          ))}
        </div>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-slate-50">
            <div className="w-9 h-9 bg-slate-100 rounded-full" />
            <div className="flex-1 space-y-1">
              <div className="h-4 w-32 bg-slate-200 rounded" />
              <div className="h-3 w-44 bg-slate-100 rounded" />
            </div>
            <div className="h-5 w-12 bg-slate-100 rounded-full" />
            <div className="h-5 w-16 bg-slate-100 rounded-full" />
            <div className="flex gap-1">
              {[...Array(3)].map((_, j) => (
                <div key={j} className="w-7 h-7 bg-slate-100 rounded-lg" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
