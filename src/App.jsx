import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// --- Contexts ---
import { AuthProvider, useAuth } from './context/AuthContext';

// --- Pages ---
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
// import { EpisodeDirector } from './pages/EpisodeDirector'; // Un-comment this when you create the file

// --- Configuration ---
const queryClient = new QueryClient();

// --- Protected Route Wrapper ---
// This kicks users back to /login if they aren't signed in
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
      
      {/* Protected Routes */}
      <Route path="/dashboard" element={
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      } />

      {/* TODO: Add your Episode Route here later
         <Route path="/series/:seriesId/episode/:episodeId" element={
           <ProtectedRoute><EpisodeDirector /></ProtectedRoute>
         } /> 
      */}
      
      {/* Default Redirect: Send unknown URLs to Dashboard */}
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