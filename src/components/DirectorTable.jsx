import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Play, Loader2, Filter, Users, Download, Volume2, PlayCircle, PauseCircle } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { VoiceSelector } from './VoiceSelector';

const API_URL = "http://127.0.0.1:8000";

export function DirectorTable({ data, availableVoices }) {
  // 1. Sanitize Data
  const cleanData = useMemo(() => {
    if (!data) return [];
    return data.map(line => ({
        ...line,
        panel_number: Number(line.panel_number),
        voice_id: line.voice_id || "" 
    })).filter(line => !isNaN(line.panel_number));
  }, [data]);

  const [scriptLines, setScriptLines] = useState(cleanData);
  
  // Audio State: { "line_id": "blob:http://..." }
  const [audioMap, setAudioMap] = useState({});
  const [playingId, setPlayingId] = useState(null);
  const audioRef = useRef(new Audio());

  // Sync state when parent data changes
  useEffect(() => {
      setScriptLines(cleanData);
  }, [cleanData]);

  // Range Logic
  const minPanel = useMemo(() => scriptLines.length ? Math.min(...scriptLines.map(d => d.panel_number)) : 0, [scriptLines]);
  const maxPanel = useMemo(() => scriptLines.length ? Math.max(...scriptLines.map(d => d.panel_number)) : 0, [scriptLines]);
  const [startPanel, setStartPanel] = useState(minPanel || 1);
  const [endPanel, setEndPanel] = useState(maxPanel || 1);

  useEffect(() => {
    if (minPanel > 0) {
        setStartPanel(minPanel);
        setEndPanel(maxPanel);
    }
  }, [minPanel, maxPanel]);

  // --- MUTATION: AI EMOTIONS ---
  const analyzeMutation = useMutation({
    mutationFn: async (linesToAnalyze) => {
        const payload = {
            lines: linesToAnalyze.map(line => ({
                id: line.id,
                panel_number: line.panel_number,
                dialogue: line.dialogue,
                action: line.action,
                sfx: line.sfx,
                characters: line.characters
            }))
        };
        const res = await axios.post(`${API_URL}/analyze_emotions`, payload);
        return res.data;
    },
    onSuccess: (emotionMap) => {
        setScriptLines(prev => prev.map(line => {
            if (emotionMap[line.id]) return { ...line, suggested_emotion: emotionMap[line.id] };
            return line;
        }));
    },
    onError: (err) => alert("AI Error: " + err.message)
  });

  // --- MUTATION: GENERATE AUDIO ---
  const audioMutation = useMutation({
    mutationFn: async ({ lineId, text, voiceId }) => {
        const response = await axios.post(`${API_URL}/generate_audio`, {
            text: text,
            voice_id: voiceId
        }, { responseType: 'blob' }); // Important: Expect a file (blob)
        return { lineId, blob: response.data };
    },
    onSuccess: ({ lineId, blob }) => {
        const url = URL.createObjectURL(blob);
        setAudioMap(prev => ({ ...prev, [lineId]: url }));
    },
    onError: (err) => alert("Audio Gen Error: " + err.message)
  });

  // --- HANDLERS ---
  const handleRunDirector = () => {
    const linesInRange = scriptLines.filter(l => l.panel_number >= startPanel && l.panel_number <= endPanel);
    if (linesInRange.length === 0) return alert("No lines in range.");
    analyzeMutation.mutate(linesInRange);
  };

  const handleGenerateAudio = (line) => {
    if (!line.voice_id) return alert("Please select a Voice Actor first!");
    audioMutation.mutate({ lineId: line.id, text: line.dialogue, voiceId: line.voice_id });
  };

  const togglePlay = (lineId, url) => {
    if (playingId === lineId) {
        audioRef.current.pause();
        setPlayingId(null);
    } else {
        audioRef.current.src = url;
        audioRef.current.play();
        setPlayingId(lineId);
        audioRef.current.onended = () => setPlayingId(null);
    }
  };

  const handleVoiceChange = (id, newVoiceId) => {
    setScriptLines(prev => prev.map(line => line.id === id ? { ...line, voice_id: newVoiceId } : line));
  };

  const getEmotionColor = (tag) => {
    if (!tag) return "bg-slate-100 text-slate-500";
    const t = tag.toLowerCase();
    if (t.includes('angry') || t.includes('shout') || t.includes('aggressive')) return "bg-red-100 text-red-700 border-red-200";
    if (t.includes('sad') || t.includes('weep')) return "bg-blue-100 text-blue-700 border-blue-200";
    return "bg-green-100 text-green-700 border-green-200";
  };

  if (!data || data.length === 0) return <div className="text-center p-10 text-slate-400">No script data loaded.</div>;

  return (
    <div className="space-y-4">
      {/* Control Bar */}
      <div className="flex flex-wrap justify-between items-center bg-white p-4 rounded-lg shadow-sm border border-slate-200 gap-4">
        <div>
            <h2 className="text-lg font-bold text-slate-800">Episode Script</h2>
            <div className="flex gap-4 text-xs text-slate-500 mt-1">
                <span>Total lines: {scriptLines.length}</span>
                <span>Range: {minPanel} - {maxPanel}</span>
            </div>
        </div>
        <div className="flex items-center gap-4 bg-slate-50 p-2 rounded-lg border border-slate-200">
            <span className="text-sm font-medium text-slate-600 flex items-center gap-2"><Filter className="w-4 h-4"/> Range:</span>
            <input type="number" value={startPanel} onChange={(e) => setStartPanel(Number(e.target.value))} className="w-16 p-1 text-center border rounded text-sm font-semibold text-indigo-600"/>
            <span className="text-slate-300">→</span>
            <input type="number" value={endPanel} onChange={(e) => setEndPanel(Number(e.target.value))} className="w-16 p-1 text-center border rounded text-sm font-semibold text-indigo-600"/>
        </div>
        <button onClick={handleRunDirector} disabled={analyzeMutation.isPending} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 shadow-sm disabled:opacity-50">
            {analyzeMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin"/> : <Play className="w-4 h-4"/>} Run AI Director
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow border border-slate-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-xs font-semibold">
            <tr>
              <th className="p-4 w-16">Panel</th>
              <th className="p-4 w-32">Character</th>
              <th className="p-4 w-48 bg-indigo-50/50 text-indigo-700">Voice Actor</th>
              <th className="p-4">Context & Dialogue</th>
              <th className="p-4 w-32 text-center">Audio</th> {/* NEW COLUMN */}
              <th className="p-4 w-32 text-center">Emotion</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {scriptLines.map((line) => {
              if (line.panel_number < startPanel || line.panel_number > endPanel) return null;
              const hasAudio = !!audioMap[line.id];
              const isGenerating = audioMutation.isPending && audioMutation.variables?.lineId === line.id;

              return (
              <tr key={line.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="p-4 text-slate-400 font-mono text-sm align-top">{line.panel_number}</td>
                <td className="p-4 font-medium text-slate-700 align-top">
                    <div className="flex items-center gap-2"><Users className="w-3 h-3 text-slate-300"/>{line.characters[0] || "Unknown"}</div>
                </td>
                <td className="p-4 align-top"><VoiceSelector voices={availableVoices} value={line.voice_id} onChange={(newId) => handleVoiceChange(line.id, newId)}/></td>
                <td className="p-4 text-slate-800 leading-relaxed max-w-lg align-top">
                  <div className="text-xs text-orange-600 font-bold mb-1 bg-orange-50 inline-block px-1 rounded">{line.action}</div>
                  <div className="text-xs text-slate-400 mb-2 italic">{line.sfx}</div>
                  <p>"{line.dialogue}"</p>
                </td>
                
                {/* AUDIO CONTROLS */}
                <td className="p-4 align-top text-center">
                    {!hasAudio ? (
                        <button 
                            onClick={() => handleGenerateAudio(line)}
                            disabled={isGenerating}
                            className="text-slate-400 hover:text-indigo-600 transition-colors disabled:opacity-50"
                            title="Generate Audio"
                        >
                            {isGenerating ? <Loader2 className="w-6 h-6 animate-spin text-indigo-600"/> : <Volume2 className="w-6 h-6"/>}
                        </button>
                    ) : (
                        <div className="flex items-center justify-center gap-2">
                            <button onClick={() => togglePlay(line.id, audioMap[line.id])} className="text-indigo-600 hover:text-indigo-800 transition-colors">
                                {playingId === line.id ? <PauseCircle className="w-8 h-8"/> : <PlayCircle className="w-8 h-8"/>}
                            </button>
                            <a href={audioMap[line.id]} download={`line_${line.id}.mp3`} className="text-slate-400 hover:text-green-600 transition-colors" title="Download MP3">
                                <Download className="w-5 h-5"/>
                            </a>
                        </div>
                    )}
                </td>

                <td className="p-4 align-top text-center">
                   <div className={`px-2 py-1 rounded-md text-xs border text-center font-medium ${getEmotionColor(line.suggested_emotion)}`}>
                      {line.suggested_emotion || "Neutral"}
                   </div>
                </td>
              </tr>
            )})}
          </tbody>
        </table>
      </div>
    </div>
  );
}