// frontend/src/components/ui/LoadingSkeleton.tsx

interface LoadingSkeletonProps {
  className?: string;
}

export default function LoadingSkeleton({
  className = "",
}: LoadingSkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded-xl overflow-hidden ${className}`}
      aria-hidden="true"
    >
      <div className="bg-blue-900/30 h-full w-full"></div>
    </div>
  );
}

export function CollectionCardSkeleton() {
  return (
    <div className="bg-blue-900/20 rounded-xl overflow-hidden shadow-lg border border-blue-800/30 animate-pulse">
      <div className="h-48 w-full bg-blue-900/50"></div>
      <div className="p-4">
        <div className="h-6 bg-blue-800/50 rounded w-3/4 mb-3"></div>
        <div className="h-4 bg-blue-800/30 rounded w-full mb-2"></div>
        <div className="h-4 bg-blue-800/30 rounded w-5/6 mb-4"></div>
        <div className="h-2 bg-blue-800/50 rounded-full w-full mb-2"></div>
        <div className="h-4 bg-blue-800/30 rounded w-1/4 mt-1"></div>
      </div>
    </div>
  );
}
