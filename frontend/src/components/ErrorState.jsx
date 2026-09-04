import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

export const ErrorState = ({ message, onRetry }) => {
  return (
    <div className="bg-white rounded-xl border border-rose-200 p-8 text-center my-6 shadow-sm">
      <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-3">
        <AlertCircle className="w-6 h-6" />
      </div>
      <h3 className="text-base font-bold text-slate-900">
        Unable to Load Airfare Index Data
      </h3>
      <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-4">
        {message || 'An error occurred while connecting to the backend index services.'}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center px-4 py-2 text-xs font-semibold rounded-lg text-white bg-sky-600 hover:bg-sky-700 transition-colors shadow-sm"
        >
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
          Retry Connection
        </button>
      )}
    </div>
  );
};
