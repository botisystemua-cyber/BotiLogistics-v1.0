export default function Skeleton() {
  return (
    <div className="p-4 space-y-4 animate-fade-in">
      <div className="skeleton h-8 w-48" />
      <div className="skeleton h-28 w-full" />
      <div className="skeleton h-28 w-full" />
      <div className="flex gap-3">
        <div className="skeleton h-24 flex-1" />
        <div className="skeleton h-24 flex-1" />
      </div>
      <div className="skeleton h-20 w-full" />
    </div>
  );
}
