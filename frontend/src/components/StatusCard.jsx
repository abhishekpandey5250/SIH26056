import React from 'react';
import { AlertTriangle, Server, Database, ShieldCheck } from 'lucide-react';

export const StatusCard = ({ health }) => {
  const isHealthy = health?.status === 'healthy';
  const isDegraded = health?.status === 'degraded';
  const isUnreachable = health?.status === 'unreachable';

  if (isHealthy) {
    return null; // Don't clutter UI when all services are healthy
  }

  return (
    <div className="mb-6 rounded-lg p-4 border bg-amber-50 border-amber-200 text-amber-900 flex items-start space-x-3">
      <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
      <div className="text-xs">
        <span className="font-semibold text-amber-950">
          {isDegraded ? 'Degraded Database Mode' : 'Backend Connectivity Warning'}:
        </span>{' '}
        {isDegraded
          ? 'MongoDB service is currently offline or unreachable. The system is operating in fault-tolerant in-memory calculation mode.'
          : 'Unable to connect to the backend service. Please ensure the Express server is running on port 5000.'}
      </div>
    </div>
  );
};
