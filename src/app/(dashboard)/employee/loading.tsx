export default function Loading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between">
        <div className="space-y-1">
          <div className="h-3 w-20 bg-slate-100 rounded" />
          <div className="h-8 w-24 bg-slate-200 rounded" />
        </div>
        <div className="h-10 w-28 bg-slate-200 rounded-lg" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 space-y-2">
            <div className="w-7 h-7 bg-slate-100 rounded-lg" />
            <div className="h-5 w-16 bg-slate-200 rounded" />
          </div>
        ))}
      </div>
      <div className="space-y-2">
        <div className="h-5 w-32 bg-slate-200 rounded" />
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between">
            <div className="space-y-1">
              <div className="h-4 w-36 bg-slate-200 rounded" />
              <div className="h-3 w-20 bg-slate-100 rounded" />
            </div>
            <div className="flex gap-1">
              {[...Array(2)].map((_, j) => (
                <div key={j} className="w-8 h-8 bg-slate-100 rounded-lg" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
