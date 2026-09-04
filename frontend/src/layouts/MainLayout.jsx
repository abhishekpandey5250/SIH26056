import React from 'react';
import { Navbar } from '../components/Navbar.jsx';

export const MainLayout = ({ children, health, isLoading }) => {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar health={health} isLoading={isLoading} />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
      <footer className="border-t border-slate-200 bg-white py-4">
        <div className="max-w-7xl mx-auto px-4 text-center text-xs text-slate-500">
          Smart India Hackathon 2026 Prototype — Problem Statement SIH26056 (Ministry of Statistics and Programme Implementation)
        </div>
      </footer>
    </div>
  );
};
