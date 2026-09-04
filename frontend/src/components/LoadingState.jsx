import React from 'react';

export const LoadingState = () => {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-44 bg-slate-200 rounded-2xl"></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="h-24 bg-slate-200 rounded-xl"></div>
        <div className="h-24 bg-slate-200 rounded-xl"></div>
        <div className="h-24 bg-slate-200 rounded-xl"></div>
        <div className="h-24 bg-slate-200 rounded-xl"></div>
      </div>
      <div className="h-64 bg-slate-200 rounded-xl"></div>
      <div className="h-56 bg-slate-200 rounded-xl"></div>
    </div>
  );
};
