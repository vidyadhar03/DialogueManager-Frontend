import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { ArrowLeft, Users, Save, CheckCircle2 } from 'lucide-react'; // Icons

// Components
import { UploadZone } from '../components/UploadZone';
import { DirectorTable } from '../components/DirectorTable';
import { VoiceSelector } from '../components/VoiceSelector';
import { uploadExcel } from '../api';

const API_URL = "http://127.0.0.1:8000";

export function EpisodeDirector() {
  const { seriesId, episodeId } = useParams();
  const navigate = useNavigate();
  
  const [scriptData, setScriptData] = useState(null);
  const [showCastingModal, setShowCastingModal] = useState(false);
  
  // Stores the temporary mapping: { "Morgan": "voice_id_123", "Accomplice": "voice_id_456" }
  const [characterMap, setCharacterMap] = useState({});

  // 1. Fetch Voices
  const { data: voices } = useQuery({
    queryKey: ['voices'],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/voices`);
      return res.data.voices;
    }
  });

  // 2. Upload Handler
  const uploadMutation = useMutation({
    mutationFn: uploadExcel,
    onSuccess: (data) => {
      setScriptData(data.data);
      setShowCastingModal(true); // <--- Auto-open modal on upload!
    },
    onError: (err) => alert("Error uploading: " + err.message)
  });

  // 3. Detect Unique Characters
  const uniqueCharacters = useMemo(() => {
    if (!scriptData) return [];
    const chars = new Set();
    scriptData.forEach(line => {
        if (line.characters && line.characters.length > 0) {
            chars.add(line.characters[0]); 
        }
    });
    return Array.from(chars).sort();
  }, [scriptData]);

  // 4. Apply Voices to the Table
  const applyVoicesToScript = () => {
    if (!scriptData) return;
    
    // Loop through all lines and update voice_id if character matches the map
    const updatedScript = scriptData.map(line => {
        const charName = line.characters[0];
        if (charName && characterMap[charName]) {
            return { ...line, voice_id: characterMap[charName] };
        }
        return line;
    });
    
    setScriptData(updatedScript);
    setShowCastingModal(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center sticky top-0 z-10 shadow-sm">
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

        {/* The Casting Button */}
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
        {!scriptData ? (
          <div className="max-w-2xl mx-auto mt-20">
             <UploadZone 
               onFileSelect={(file) => uploadMutation.mutate(file)} 
               isUploading={uploadMutation.isPending}
             />
          </div>
        ) : (
          /* Pass data AND voices to the table */
          <DirectorTable 
            data={scriptData} 
            availableVoices={voices || []} 
          />
        )}
      </div>

      {/* --- CASTING MODAL --- */}
      {showCastingModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
                
                {/* Modal Header */}
                <div className="p-6 border-b border-slate-100 bg-slate-50">
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <Users className="w-5 h-5 text-indigo-600"/> 
                        Cast Your Characters
                    </h2>
                    <p className="text-slate-500 text-sm mt-1">
                        We found <strong>{uniqueCharacters.length}</strong> unique characters. Assign voices globally here.
                    </p>
                </div>
                
                {/* Modal Body (Scrollable) */}
                <div className="p-6 overflow-y-auto flex-1 space-y-3">
                    {uniqueCharacters.length === 0 && <p className="text-center text-slate-400 italic">No characters detected.</p>}
                    
                    {uniqueCharacters.map(char => (
                        <div key={char} className="flex items-center justify-between bg-white p-3 rounded-lg border border-slate-200 shadow-sm hover:border-indigo-300 transition-colors">
                            <div className="flex items-center gap-3">
                                {/* Character Avatar */}
                                <div className="w-10 h-10 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full flex items-center justify-center text-indigo-700 font-bold text-lg border border-indigo-50">
                                    {char.charAt(0)}
                                </div>
                                <div>
                                    <span className="font-bold text-slate-800 block">{char}</span>
                                    <span className="text-xs text-slate-400">Character</span>
                                </div>
                            </div>
                            
                            {/* Voice Dropdown */}
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

                {/* Modal Footer */}
                <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                    <button 
                        onClick={() => setShowCastingModal(false)}
                        className="px-5 py-2.5 text-slate-600 hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-200 rounded-lg font-medium transition-all"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={applyVoicesToScript}
                        className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium shadow-md hover:shadow-lg flex items-center gap-2 transition-all transform active:scale-95"
                    >
                        <CheckCircle2 className="w-4 h-4" />
                        Apply Voices
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}