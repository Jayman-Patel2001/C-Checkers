export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-40 bg-slate-200 rounded-lg" />
      <div className="h-32 bg-slate-100 rounded-2xl" />
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 7 }).map((_, i) => <div key={i} className="h-20 bg-slate-100 rounded-xl" />)}
      </div>
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 bg-slate-100 rounded-xl" />)}
      </div>
    </div>
  );
}
