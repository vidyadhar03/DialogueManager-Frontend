import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// --- Contexts ---
import { AuthProvider, useAuth } from './context/AuthContext';

// --- Pages ---
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { SeriesDetails } from './pages/SeriesDetails'; // <--- NEW
import { EpisodeDirector } from './pages/EpisodeDirector'; // <--- NEW (Your Excel Tool)

// --- Configuration ---
const queryClient = new QueryClient();

// --- Protected Route Wrapper ---
const ProtectedRoute = ({ children }) => {
  const { user } = useAuth();
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

// --- Main Routes ---
function AppRoutes() {
  return (
    <Routes>
      {/* Public Route */}
      <Route path="/login" element={<Login />} />
      
      {/* 1. DASHBOARD: List of Series */}
      <Route path="/dashboard" element={
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      } />

      {/* 2. SERIES DETAILS: List of Episodes */}
      <Route path="/series/:seriesId" element={
        <ProtectedRoute>
          <SeriesDetails />
        </ProtectedRoute>
      } />

      {/* 3. EPISODE DIRECTOR: The Actual Tool */}
      <Route path="/series/:seriesId/episode/:episodeId" element={
        <ProtectedRoute>
          <EpisodeDirector />
        </ProtectedRoute>
      } />
      
      {/* Default Redirect */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

// --- App Shell ---
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
            <AppRoutes />
          </div>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}