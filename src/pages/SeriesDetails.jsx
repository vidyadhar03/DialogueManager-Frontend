import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { ArrowLeft, Plus, PlayCircle, Loader2, Mic } from 'lucide-react';

const API_URL = "http://127.0.0.1:8000";

export function SeriesDetails() {
  const { seriesId } = useParams(); // Get ID from URL
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [newEpTitle, setNewEpTitle] = useState("");

  // 1. Fetch Series Info (Title, etc.)
  const { data: series } = useQuery({
    queryKey: ['series', seriesId],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/series/${seriesId}`);
      return res.data;
    }
  });

  // 2. Fetch Episodes List
  const { data: episodes, isLoading } = useQuery({
    queryKey: ['episodes', seriesId],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/series/${seriesId}/episodes`);
      return res.data.episodes;
    }
  });

  // 3. Create Episode Mutation
  const createMutation = useMutation({
    mutationFn: async (title) => {
      return axios.post(`${API_URL}/series/${seriesId}/episodes`, { title, status: "Draft" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['episodes', seriesId]); // Refresh list
      setShowModal(false);
      setNewEpTitle("");
    }
  });

  const handleCreate = (e) => {
    e.preventDefault();
    if (newEpTitle.trim()) createMutation.mutate(newEpTitle);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header & Back Button */}
      <button 
        onClick={() => navigate('/dashboard')} 
        className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 mb-6 transition-colors font-medium text-sm"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Dashboard
      </button>

      <div className="flex justify-between items-end mb-8 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">{series?.title || "Loading..."}</h1>
          <p className="text-slate-500 mt-1 text-sm">Manage episodes and character voices</p>
        </div>
        <button 
           onClick={() => setShowModal(true)}
           className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 flex items-center gap-2 shadow-sm transition-all"
        >
          <Plus className="w-4 h-4" /> New Episode
        </button>
      </div>

      {/* Global Settings (Placeholder for Phase 2) */}
      <div className="bg-slate-50 p-4 rounded-lg mb-8 border border-slate-200 flex justify-between items-center">
        <div className="flex items-center gap-3">
            <div className="bg-white p-2 rounded-full border border-slate-200 text-indigo-600">
                <Mic className="w-5 h-5"/>
            </div>
            <div>
                <h3 className="font-semibold text-slate-700 text-sm">Global Character Map</h3>
                <p className="text-xs text-slate-500">Assign voices once for the whole series (Coming Soon).</p>
            </div>
        </div>
        <button disabled className="text-sm text-slate-400 font-medium cursor-not-allowed">Manage Voices →</button>
      </div>

      {/* Episodes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading && <div className="text-slate-400">Loading episodes...</div>}
        
        {episodes?.map((ep) => (
          <div 
            key={ep.id} 
            onClick={() => navigate(`/series/${seriesId}/episode/${ep.id}`)}
            className="group bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-300 cursor-pointer transition-all relative overflow-hidden"
          >
            <div className="flex justify-between items-start mb-4 relative z-10">
                <div className="bg-indigo-50 text-indigo-700 p-2 rounded-lg group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                    <PlayCircle className="w-6 h-6" />
                </div>
                <span className="text-xs font-mono bg-slate-100 text-slate-500 px-2 py-1 rounded-md uppercase tracking-wider">{ep.status}</span>
            </div>
            
            <h3 className="font-bold text-slate-800 text-lg group-hover:text-indigo-600 transition-colors relative z-10">{ep.title}</h3>
            <p className="text-xs text-slate-400 mt-2 font-mono relative z-10">ID: {ep.id}</p>
          </div>
        ))}

        {/* Empty State */}
        {!isLoading && episodes?.length === 0 && (
            <div className="col-span-full py-16 text-center border-2 border-dashed border-slate-300 rounded-xl bg-slate-50/50">
                <p className="text-slate-500 mb-2">No episodes created yet.</p>
                <button onClick={() => setShowModal(true)} className="text-indigo-600 font-medium hover:underline">Create your first episode</button>
            </div>
        )}
      </div>

      {/* CREATE MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-4">New Episode</h3>
            <form onSubmit={handleCreate}>
              <div className="mb-4">
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Episode Title</label>
                  <input 
                    autoFocus
                    type="text" 
                    value={newEpTitle}
                    onChange={(e) => setNewEpTitle(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    placeholder="e.g. The Beginning"
                  />
              </div>
              <div className="flex justify-end gap-2">
                <button 
                    type="button" 
                    onClick={() => setShowModal(false)} 
                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                >
                    Cancel
                </button>
                <button 
                    type="submit" 
                    disabled={createMutation.isPending || !newEpTitle.trim()} 
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2 font-medium disabled:opacity-50"
                >
                  {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin"/>} 
                  Create Episode
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}