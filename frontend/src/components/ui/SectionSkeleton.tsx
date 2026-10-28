import React from 'react';

interface SectionSkeletonProps {
  className?: string;
  height?: string;
  rows?: number;
}

export const SectionSkeleton: React.FC<SectionSkeletonProps> = ({
  className = '',
  height = 'h-64',
  rows = 4,
}) => {
  return (
    <div className={`glass-panel p-6 bg-white border border-slate-200 shadow-sm animate-pulse ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <div className="h-4 bg-slate-100 rounded w-1/3" />
        <div className="h-4 bg-slate-100 rounded w-16" />
      </div>

      <div className={`w-full ${height} bg-slate-50 rounded-lg flex flex-col justify-around p-4 border border-slate-100`}>
        {Array.from({ length: rows }).map((_, idx) => (
          <div
            key={idx}
            className="h-3 bg-slate-200/80 rounded"
            style={{ width: `${85 - idx * 12}%` }}
          />
        ))}
      </div>
    </div>
  );
};
