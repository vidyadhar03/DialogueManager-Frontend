import React, { useState, useMemo, useEffect } from 'react';
import { Play, Loader2, Filter, Users } from 'lucide-react';
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

  // Sync state when parent data changes
  useEffect(() => {
      setScriptLines(cleanData);
  }, [cleanData]);

  // 2. Range Logic
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

  // 3. AI Analysis Mutation (THE MISSING PIECE)
  const analyzeMutation = useMutation({
    mutationFn: async (linesToAnalyze) => {
        // Only send necessary fields to save tokens
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
        return res.data; // Returns { "1_0": "[Angry]", "1_1": "[Sad]" }
    },
    onSuccess: (emotionMap) => {
        // Merge the AI results back into the table
        setScriptLines(prev => prev.map(line => {
            if (emotionMap[line.id]) {
                return { ...line, suggested_emotion: emotionMap[line.id] };
            }
            return line;
        }));
    },
    onError: (err) => alert("AI Error: " + err.message)
  });

  // 4. Handler for the Button
  const handleRunDirector = () => {
    // Filter lines currently in view/range
    const linesInRange = scriptLines.filter(
        l => l.panel_number >= startPanel && l.panel_number <= endPanel
    );
    
    if (linesInRange.length === 0) {
        alert("No lines found in the selected range.");
        return;
    }
    
    analyzeMutation.mutate(linesInRange);
  };

  const handleVoiceChange = (id, newVoiceId) => {
    setScriptLines(prev => prev.map(line => 
        line.id === id ? { ...line, voice_id: newVoiceId } : line
    ));
  };

  const getEmotionColor = (tag) => {
    if (!tag) return "bg-slate-100 text-slate-500";
    const t = tag.toLowerCase();
    if (t.includes('angry') || t.includes('shout') || t.includes('aggressive')) return "bg-red-100 text-red-700 border-red-200";
    if (t.includes('sad') || t.includes('weep')) return "bg-blue-100 text-blue-700 border-blue-200";
    if (t.includes('whisper')) return "bg-purple-100 text-purple-700 border-purple-200";
    return "bg-green-100 text-green-700 border-green-200";
  };

  if (!data || data.length === 0) {
      return <div className="text-center p-10 text-slate-400">No script data loaded yet.</div>;
  }

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

        {/* Range Inputs */}
        <div className="flex items-center gap-4 bg-slate-50 p-2 rounded-lg border border-slate-200">
            <span className="text-sm font-medium text-slate-600 flex items-center gap-2">
                <Filter className="w-4 h-4"/> Range:
            </span>
            <input 
                type="number" value={startPanel} onChange={(e) => setStartPanel(Number(e.target.value))}
                className="w-16 p-1 text-center border rounded text-sm font-semibold text-indigo-600"
            />
            <span className="text-slate-300">→</span>
            <input 
                type="number" value={endPanel} onChange={(e) => setEndPanel(Number(e.target.value))}
                className="w-16 p-1 text-center border rounded text-sm font-semibold text-indigo-600"
            />
        </div>

        <div className="flex gap-3">
          <button 
            onClick={handleRunDirector} // <--- CONNECTED NOW
            disabled={analyzeMutation.isPending}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 shadow-sm disabled:opacity-50"
          >
            {analyzeMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin"/> : <Play className="w-4 h-4"/>}
            Run AI Director
          </button>
        </div>
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
              <th className="p-4 w-40">Emotion</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {scriptLines.map((line) => {
              if (line.panel_number < startPanel || line.panel_number > endPanel) return null;

              return (
              <tr key={line.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="p-4 text-slate-400 font-mono text-sm align-top">{line.panel_number}</td>
                
                <td className="p-4 font-medium text-slate-700 align-top">
                    <div className="flex items-center gap-2">
                        <Users className="w-3 h-3 text-slate-300"/>
                        {line.characters[0] || "Unknown"}
                    </div>
                </td>

                <td className="p-4 align-top">
                    <VoiceSelector 
                        voices={availableVoices}
                        value={line.voice_id}
                        onChange={(newId) => handleVoiceChange(line.id, newId)}
                    />
                </td>

                <td className="p-4 text-slate-800 leading-relaxed max-w-lg align-top">
                  <div className="text-xs text-orange-600 font-bold mb-1 bg-orange-50 inline-block px-1 rounded">{line.action}</div>
                  <div className="text-xs text-slate-400 mb-2 italic">{line.sfx}</div>
                  <p>"{line.dialogue}"</p>
                </td>

                <td className="p-4 align-top">
                   <div className={`px-3 py-1.5 rounded-md text-sm border text-center ${getEmotionColor(line.suggested_emotion)}`}>
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