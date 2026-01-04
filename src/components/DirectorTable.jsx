import React, { useState, useMemo, useEffect } from 'react';
import { Play, Loader2, Save, Filter } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { generateTags } from '../api';

export function DirectorTable({ data }) {
  // 1. Sanitize Data on Init: Ensure panel_number is a real Number
  const cleanData = useMemo(() => {
    if (!data) return [];
    return data.map(line => ({
        ...line,
        panel_number: Number(line.panel_number) // Force number type
    })).filter(line => !isNaN(line.panel_number)); // Remove bad rows
  }, [data]);

  const [scriptLines, setScriptLines] = useState(cleanData);

  // 2. Calculate Min/Max Safely
  const minPanel = useMemo(() => {
    if (cleanData.length === 0) return 1;
    return Math.min(...cleanData.map(d => d.panel_number));
  }, [cleanData]);

  const maxPanel = useMemo(() => {
    if (cleanData.length === 0) return 1;
    return Math.max(...cleanData.map(d => d.panel_number));
  }, [cleanData]);

  // 3. Initialize State with safe defaults
  const [startPanel, setStartPanel] = useState(minPanel);
  const [endPanel, setEndPanel] = useState(minPanel);

  // Sync state if data changes (e.g. new upload)
  useEffect(() => {
    if (cleanData.length > 0) {
        setScriptLines(cleanData);
        // Recalculate min to ensure we reset correctly
        const newMin = Math.min(...cleanData.map(d => d.panel_number));
        setStartPanel(newMin);
        setEndPanel(newMin);
    }
  }, [cleanData]);

  // Mutation to call OpenAI
  const aiMutation = useMutation({
    mutationFn: generateTags,
    onSuccess: (newTags) => {
      setScriptLines(prev => prev.map(line => ({
        ...line,
        suggested_emotion: newTags[line.id] || line.suggested_emotion
      })));
      alert("Success! Emotions updated.");
    },
    onError: (err) => {
        alert("AI Error: " + (err.response?.data?.detail || err.message));
    }
  });

  const handleRunAI = () => {
    // Robust Filtering
    const targetLines = scriptLines.filter(
        line => line.panel_number >= startPanel && line.panel_number <= endPanel
    );

    if (targetLines.length === 0) {
        alert(`No dialogues found in range ${startPanel}-${endPanel}. (Available: ${minPanel}-${maxPanel})`);
        return;
    }

    if (confirm(`Send ${targetLines.length} lines (Panel ${startPanel}-${endPanel}) to OpenAI?`)) {
        aiMutation.mutate(targetLines);
    }
  };

  const getEmotionColor = (tag) => {
    if (!tag) return "bg-slate-100 text-slate-500";
    const t = tag.toLowerCase();
    if (t.includes('angry') || t.includes('shout') || t.includes('aggressive')) return "bg-red-100 text-red-700 border-red-200";
    if (t.includes('sad') || t.includes('weep')) return "bg-blue-100 text-blue-700 border-blue-200";
    if (t.includes('whisper')) return "bg-purple-100 text-purple-700 border-purple-200";
    return "bg-green-100 text-green-700 border-green-200";
  };

  return (
    <div className="space-y-4">
      {/* --- CONTROL BAR --- */}
      <div className="flex flex-wrap justify-between items-center bg-white p-4 rounded-lg shadow-sm border border-slate-200 gap-4">
        
        <div>
            <h2 className="text-lg font-bold text-slate-800">Episode Script</h2>
            <div className="flex gap-4 text-xs text-slate-500 mt-1">
                <span>Total lines: {scriptLines.length}</span>
                <span>Range Available: {minPanel} - {maxPanel}</span>
            </div>
        </div>

        {/* Range Selector */}
        <div className="flex items-center gap-4 bg-slate-50 p-2 rounded-lg border border-slate-200">
            <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-400"/>
                <span className="text-sm font-medium text-slate-600">Process Range:</span>
            </div>
            
            <div className="flex items-center gap-2">
                <label className="text-xs text-slate-500">Start</label>
                <input 
                    type="number" 
                    // Removed 'min' attribute to allow free typing
                    value={startPanel}
                    onChange={(e) => setStartPanel(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-20 p-1 text-center border rounded text-sm font-semibold text-indigo-600"
                />
            </div>
            <span className="text-slate-300">→</span>
            <div className="flex items-center gap-2">
                <label className="text-xs text-slate-500">End</label>
                <input 
                    type="number" 
                    // Removed 'max' attribute to allow free typing
                    value={endPanel}
                    onChange={(e) => setEndPanel(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-20 p-1 text-center border rounded text-sm font-semibold text-indigo-600"
                />
            </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button 
            onClick={handleRunAI}
            disabled={aiMutation.isPending}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-sm"
          >
            {aiMutation.isPending ? <Loader2 className="animate-spin w-4 h-4"/> : <Play className="w-4 h-4"/>}
            {aiMutation.isPending ? "Processing..." : "Run AI Director"}
          </button>
          
          <button className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-md hover:bg-emerald-700 transition-all shadow-sm">
            <Save className="w-4 h-4"/>
            Export Excel
          </button>
        </div>
      </div>

      {/* --- TABLE --- */}
      <div className="bg-white rounded-lg shadow border border-slate-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-xs font-semibold">
            <tr>
              <th className="p-4 w-16">Panel</th>
              <th className="p-4 w-32">Character</th>
              <th className="p-4 w-1/4">Context (Action/SFX)</th>
              <th className="p-4">Dialogue</th>
              <th className="p-4 w-48">Emotion Tag</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {scriptLines.map((line) => {
              // Safety check: ensure startPanel/endPanel are numbers
              const s = Number(startPanel) || 0;
              const e = Number(endPanel) || 99999;
              const isSelected = line.panel_number >= s && line.panel_number <= e;
              
              return (
              <tr key={line.id} className={`transition-colors ${isSelected ? 'bg-indigo-50/30' : 'hover:bg-slate-50/50'}`}>
                <td className="p-4 text-slate-400 font-mono text-sm">
                    {line.panel_number}
                    {isSelected && <span className="block w-2 h-2 bg-indigo-500 rounded-full mt-1"></span>}
                </td>
                <td className="p-4 font-medium text-slate-700">{line.characters[0] || "Unknown"}</td>
                <td className="p-4 text-xs text-slate-500">
                  <div className="font-semibold text-slate-600 mb-1">{line.action}</div>
                  {line.sfx && <span className="inline-block bg-orange-50 text-orange-600 px-2 py-0.5 rounded border border-orange-100">{line.sfx}</span>}
                </td>
                <td className="p-4 text-slate-800 leading-relaxed max-w-lg">
                  "{line.dialogue}"
                </td>
                <td className="p-4">
                   <input 
                      type="text" 
                      value={line.suggested_emotion || ""}
                      placeholder="[Neutral]"
                      className={`w-full px-3 py-1.5 rounded-md text-sm border transition-all ${getEmotionColor(line.suggested_emotion)} ${isSelected ? 'ring-2 ring-indigo-200' : ''}`}
                      readOnly
                   />
                </td>
              </tr>
            )})}
          </tbody>
        </table>
      </div>
    </div>
  );
}