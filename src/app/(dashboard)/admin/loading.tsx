export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-48 bg-slate-200 rounded-lg" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
            <div className="w-10 h-10 bg-slate-100 rounded-xl" />
            <div className="h-7 w-12 bg-slate-200 rounded" />
            <div className="h-4 w-24 bg-slate-100 rounded" />
          </div>
        ))}
      </div>
      <div className="space-y-3">
        <div className="h-6 w-32 bg-slate-200 rounded" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
              <div className="flex justify-between">
                <div className="flex gap-2">
                  <div className="w-9 h-9 bg-slate-100 rounded-full" />
                  <div className="space-y-1">
                    <div className="h-4 w-28 bg-slate-200 rounded" />
                    <div className="h-3 w-36 bg-slate-100 rounded" />
                  </div>
                </div>
                <div className="h-5 w-14 bg-slate-100 rounded" />
              </div>
              <div className="h-2 bg-slate-100 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
