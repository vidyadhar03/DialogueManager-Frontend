import React from 'react';
import { useAuth } from '../context/AuthContext';

export function Dashboard() {
  const { user, logout } = useAuth();

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">Series Dashboard</h1>
        <div className="flex items-center gap-4">
          <span className="text-slate-600">Welcome, {user?.name}</span>
          <button onClick={logout} className="text-red-600 hover:underline text-sm">Logout</button>
        </div>
      </div>
      
      <div className="bg-white p-10 rounded-lg shadow text-center border border-dashed border-slate-300">
        <p className="text-slate-500">Series list will appear here soon...</p>
        {user?.role === 'admin' && (
           <button className="mt-4 bg-indigo-600 text-white px-4 py-2 rounded">
             + Create New Series
           </button>
        )}
      </div>
    </div>
  );
}