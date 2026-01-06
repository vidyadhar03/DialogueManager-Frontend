import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'; // <--- Added useQueryClient
import axios from 'axios';
import { ArrowLeft, Users, Save, CheckCircle2, Loader2 } from 'lucide-react';

// Components
import { UploadZone } from '../components/UploadZone';
import { DirectorTable } from '../components/DirectorTable';
import { VoiceSelector } from '../components/VoiceSelector';
import { uploadExcel } from '../api';

const API_URL = "http://127.0.0.1:8000";

export function EpisodeDirector() {
  const { seriesId, episodeId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient(); // <--- Init Client
  
  const [scriptData, setScriptData] = useState(null);
  const [showCastingModal, setShowCastingModal] = useState(false);
  const [characterMap, setCharacterMap] = useState({});

  // 1. Fetch Voices
  const { data: voices } = useQuery({
    queryKey: ['voices'],
    queryFn: async () => (await axios.get(`${API_URL}/voices`)).data.voices
  });

  // 2. FETCH SCRIPT (The Persistence Layer)
  const { data: remoteScript, isLoading: isLoadingScript } = useQuery({
    queryKey: ['script', seriesId, episodeId],
    queryFn: async () => {
        const res = await axios.get(`${API_URL}/series/${seriesId}/episodes/${episodeId}/script`);
        return res.data.script;
    },
    // If we find data, sync it to our local state immediately
    retry: 1
  });

  // Sync remote script to local state when it loads
  useEffect(() => {
    if (remoteScript && remoteScript.length > 0) {
        setScriptData(remoteScript);
    }
  }, [remoteScript]);

  // 3. UPLOAD & SAVE (Modified)
  const saveScriptToDbMutation = useMutation({
      mutationFn: async (data) => {
          return axios.post(`${API_URL}/series/${seriesId}/episodes/${episodeId}/script`, { data });
      },
      onSuccess: () => {
          queryClient.invalidateQueries(['script', seriesId, episodeId]); // Refresh from DB
      }
  });

  const uploadMutation = useMutation({
    mutationFn: uploadExcel,
    onSuccess: (data) => {
      // Instead of just setting state, we SAVE it to DB first
      const rawData = data.data;
      saveScriptToDbMutation.mutate(rawData);
      setScriptData(rawData);
      setShowCastingModal(true);
    },
    onError: (err) => alert("Error uploading: " + err.message)
  });

  // 4. Casting Logic (Also needs to save to DB)
  const updateLinesMutation = useMutation({
    mutationFn: async ({ updates }) => {
        // We loop and update each line in the DB. 
        // Note: For production, a batch update endpoint is better, but this works for now.
        const promises = updates.map(update => 
            axios.patch(`${API_URL}/series/${seriesId}/episodes/${episodeId}/script/${update.id}`, update.payload)
        );
        return Promise.all(promises);
    },
    onSuccess: () => {
        queryClient.invalidateQueries(['script', seriesId, episodeId]);
        setShowCastingModal(false);
    }
  });

  const applyVoicesToScript = () => {
    if (!scriptData) return;
    
    // Find lines that need updating
    const updates = [];
    const updatedScript = scriptData.map(line => {
        const charName = line.characters[0];
        if (charName && characterMap[charName]) {
            updates.push({ 
                id: line.id, 
                payload: { voice_id: characterMap[charName] } 
            });
            return { ...line, voice_id: characterMap[charName] };
        }
        return line;
    });
    
    // Optimistic Update
    setScriptData(updatedScript);
    
    // Persist to DB
    if (updates.length > 0) {
        updateLinesMutation.mutate({ updates });
    } else {
        setShowCastingModal(false);
    }
  };

  // 5. Unique Character Logic
  const uniqueCharacters = useMemo(() => {
    if (!scriptData) return [];
    const chars = new Set();
    scriptData.forEach(line => {
        if (line.characters && line.characters.length > 0) chars.add(line.characters[0]); 
    });
    return Array.from(chars).sort();
  }, [scriptData]);


  if (isLoadingScript) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin w-8 h-8 text-indigo-600"/></div>;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-4">
            <button 
                onClick={() => navigate(`/series/${seriesId}`)}
                className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors"
            >
                <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
                <h1 className="text-xl font-bold text-slate-800">Episode Director</h1>
                <p className="text-xs text-slate-500 font-mono">ID: {episodeId}</p>
            </div>
        </div>

        {scriptData && (
            <button 
                onClick={() => setShowCastingModal(true)}
                className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 font-medium transition-all shadow-sm"
            >
                <Users className="w-4 h-4" />
                Character Casting
            </button>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 p-8 max-w-[1600px] mx-auto w-full">
        {!scriptData || scriptData.length === 0 ? (
          <div className="max-w-2xl mx-auto mt-20">
             <UploadZone 
               onFileSelect={(file) => uploadMutation.mutate(file)} 
               isUploading={uploadMutation.isPending || saveScriptToDbMutation.isPending}
             />
             {saveScriptToDbMutation.isPending && <p className="text-center text-indigo-600 mt-4 animate-pulse">Saving script to database...</p>}
          </div>
        ) : (
          <DirectorTable 
            data={scriptData} 
            availableVoices={voices || []} 
            episodeId={episodeId}
            seriesId={seriesId} // <--- Pass this down for row updates
          />
        )}
      </div>

      {/* CASTING MODAL (Same as before) */}
      {showCastingModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
                <div className="p-6 border-b border-slate-100 bg-slate-50">
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <Users className="w-5 h-5 text-indigo-600"/> 
                        Cast Your Characters
                    </h2>
                    <p className="text-slate-500 text-sm mt-1">We found <strong>{uniqueCharacters.length}</strong> unique characters. Assign voices globally here.</p>
                </div>
                
                <div className="p-6 overflow-y-auto flex-1 space-y-3">
                    {uniqueCharacters.map(char => (
                        <div key={char} className="flex items-center justify-between bg-white p-3 rounded-lg border border-slate-200 shadow-sm hover:border-indigo-300 transition-colors">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-bold text-lg">{char.charAt(0)}</div>
                                <span className="font-bold text-slate-800">{char}</span>
                            </div>
                            <div className="w-64">
                                <VoiceSelector 
                                    voices={voices}
                                    value={characterMap[char]}
                                    onChange={(val) => setCharacterMap(prev => ({ ...prev, [char]: val }))}
                                />
                            </div>
                        </div>
                    ))}
                </div>

                <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                    <button onClick={() => setShowCastingModal(false)} className="px-5 py-2.5 text-slate-600 hover:bg-white border border-transparent rounded-lg font-medium">Cancel</button>
                    <button 
                        onClick={applyVoicesToScript}
                        disabled={updateLinesMutation.isPending}
                        className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium shadow-md flex items-center gap-2"
                    >
                        {updateLinesMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin"/> : <CheckCircle2 className="w-4 h-4" />}
                        Apply & Save
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}