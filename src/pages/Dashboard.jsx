import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Plus, X, Film, Loader2, Trash2 } from 'lucide-react';

const API_URL = "http://127.0.0.1:8000";

export function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const queryClient = useQueryClient();

  // 1. Fetch Series List
  const { data: seriesList, isLoading, error } = useQuery({
    queryKey: ['series'],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/series`);
      return res.data.series;
    }
  });

  // 2. Create Series Mutation
  const createMutation = useMutation({
    mutationFn: async (title) => {
      return axios.post(`${API_URL}/series`, { 
        title: title, 
        description: "Created via Web" 
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['series']);
      setShowModal(false);
      setNewTitle("");
    },
    onError: (err) => alert("Error creating series: " + err.message)
  });

  // 3. Delete Series Mutation
  const deleteMutation = useMutation({
    mutationFn: async (seriesId) => {
        return axios.delete(`${API_URL}/series/${seriesId}`);
    },
    onSuccess: () => {
        queryClient.invalidateQueries(['series']);
    },
    onError: (err) => alert("Error deleting series: " + err.message)
  });

  const handleCreate = (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    createMutation.mutate(newTitle);
  };

  const handleDelete = (e, seriesId, seriesTitle) => {
    e.stopPropagation(); // Prevents opening the series when clicking delete
    if (confirm(`Are you sure you want to delete "${seriesTitle}"? This cannot be undone.`)) {
        deleteMutation.mutate(seriesId);
    }
  };

  if (error) return <div className="p-8 text-red-500">Error connecting to backend: {error.message}</div>;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Top Bar */}
      <div className="flex justify-between items-center mb-8 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Series Dashboard</h1>
          <p className="text-slate-500 text-sm mt-1">Manage your productions</p>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-sm font-semibold text-slate-700">{user?.name}</div>
            <button onClick={logout} className="text-xs text-red-500 hover:underline">Sign Out</button>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* Create New Card - ADMIN ONLY */}
        {user?.role === 'admin' && (
          <button 
            onClick={() => setShowModal(true)}
            className="group flex flex-col items-center justify-center h-48 border-2 border-dashed border-slate-300 rounded-xl hover:border-indigo-500 hover:bg-indigo-50/50 transition-all bg-white"
          >
            <div className="bg-indigo-100 p-3 rounded-full mb-3 group-hover:scale-110 transition-transform">
              <Plus className="w-6 h-6 text-indigo-600" />
            </div>
            <span className="font-semibold text-slate-600 group-hover:text-indigo-700">Create New Series</span>
          </button>
        )}

        {/* Loading State */}
        {isLoading && <div className="text-slate-400 p-4">Loading series...</div>}
        
        {/* Series Cards */}
        {seriesList?.map((series) => (
          <div 
            key={series.id} 
            onClick={() => navigate(`/series/${series.id}`)}
            className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow cursor-pointer relative overflow-hidden group"
          >
            {/* Delete Button - ADMIN ONLY */}
            {user?.role === 'admin' && (
                <button 
                    onClick={(e) => handleDelete(e, series.id, series.title)}
                    className="absolute top-4 right-4 z-20 p-2 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-full transition-all"
                    title="Delete Series"
                >
                    <Trash2 className="w-5 h-5" />
                </button>
            )}

            {/* Background Icon */}
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity z-0">
              <Film className="w-24 h-24 text-indigo-900" />
            </div>
            
            <h3 className="text-xl font-bold text-slate-800 mb-2 relative z-10 pr-8">{series.title}</h3>
            <p className="text-sm text-slate-500 relative z-10 font-mono text-xs mb-6 truncate">ID: {series.id}</p>
            
            <div className="flex items-center gap-2 text-indigo-600 text-sm font-medium relative z-10 group-hover:underline">
              Open Production →
            </div>
          </div>
        ))}
      </div>

      {/* MODAL: Create New Series */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-slate-800">New Series</h3>
              <button onClick={() => setShowModal(false)}><X className="w-5 h-5 text-slate-400 hover:text-slate-600"/></button>
            </div>
            
            <form onSubmit={handleCreate}>
              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 mb-2">Series Title</label>
                <input 
                  autoFocus
                  type="text" 
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="e.g. Mission Mummy"
                />
              </div>
              
              <div className="flex justify-end gap-3">
                <button 
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-md"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={createMutation.isPending || !newTitle}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {createMutation.isPending ? (
                    <> <Loader2 className="w-4 h-4 animate-spin"/> Creating... </>
                  ) : "Create Series"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}