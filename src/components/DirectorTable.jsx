import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Loader2, Users, Volume2, CheckSquare, Download, Archive, Play, Filter } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import JSZip from 'jszip'; 
import { saveAs } from 'file-saver';
import { DirectorTableRow } from './DirectorTableRow';

const API_URL = "http://127.0.0.1:8000";

export function DirectorTable({ data, availableVoices, episodeId, seriesId, episodeNumber = 1 }) {
  
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
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [audioMap, setAudioMap] = useState({});
  const [playingId, setPlayingId] = useState(null);
  const audioRef = useRef(new Audio());
  const [isZipping, setIsZipping] = useState(false);

  // Range State
  const minPanel = useMemo(() => scriptLines.length ? Math.min(...scriptLines.map(d => d.panel_number)) : 0, [scriptLines]);
  const maxPanel = useMemo(() => scriptLines.length ? Math.max(...scriptLines.map(d => d.panel_number)) : 0, [scriptLines]);
  const [startPanel, setStartPanel] = useState(minPanel || 1);
  const [endPanel, setEndPanel] = useState(maxPanel || 1);

  useEffect(() => { setScriptLines(cleanData); }, [cleanData]);
  useEffect(() => { if (minPanel > 0) { setStartPanel(minPanel); setEndPanel(maxPanel); } }, [minPanel, maxPanel]);

  // --- PERSISTENCE MUTATION (Auto-Save) ---
  const persistLineMutation = useMutation({
    mutationFn: async ({ lineId, payload }) => {
        // ✅ NOW THIS WILL WORK because seriesId is defined
        return axios.patch(`${API_URL}/series/${seriesId}/episodes/${episodeId}/script/${lineId}`, payload);
    },
    onError: (err) => console.error("Failed to auto-save:", err)
  });

  // --- API MUTATIONS ---
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
            if (emotionMap[line.id]) {
                const newEmotion = emotionMap[line.id];
                // AUTO-SAVE EMOTION
                persistLineMutation.mutate({ lineId: line.id, payload: { suggested_emotion: newEmotion } });
                return { ...line, suggested_emotion: newEmotion };
            }
            return line;
        }));
    },
    onError: (err) => alert("AI Error: " + err.message)
  });

  const audioMutation = useMutation({
    mutationFn: async ({ lineId, text, voiceId }) => {
        const response = await axios.post(`${API_URL}/generate_audio`, { text, voice_id: voiceId }, { responseType: 'blob' });
        return { lineId, blob: response.data };
    },
    onSuccess: ({ lineId, blob }) => {
        const url = URL.createObjectURL(blob);
        setAudioMap(prev => ({ ...prev, [lineId]: url }));
    },
    onError: (err) => alert("Audio Gen Error: " + err.message)
  });

  // --- HANDLERS ---

  // 1. Single Line Retry Handlers
  const handleRetryEmotion = (line) => {
    analyzeMutation.mutate([line]);
  };

  const handleVoiceChange = (id, newVoiceId) => {
    setScriptLines(prev => prev.map(line => line.id === id ? { ...line, voice_id: newVoiceId } : line));
    // AUTO-SAVE VOICE
    persistLineMutation.mutate({ lineId: id, payload: { voice_id: newVoiceId } });
  };

  const handleDownloadZip = async () => {
    const linesWithAudio = scriptLines.filter(line => audioMap[line.id]);
    if (linesWithAudio.length === 0) return alert("No audio generated yet! Generate some lines first.");

    setIsZipping(true);
    const zip = new JSZip();

    try {
        const promises = linesWithAudio.map(async (line) => {
            const blobUrl = audioMap[line.id];
            const response = await fetch(blobUrl);
            const blob = await response.blob();
            
            const [panelNo, dialogNo] = line.id.split('_');
            const filename = `ep_${episodeNumber}_p_${panelNo}_d_${dialogNo}.mp3`;
            
            zip.file(filename, blob);
        });

        await Promise.all(promises);
        const content = await zip.generateAsync({ type: "blob" });
        saveAs(content, `Episode_${episodeNumber}_Audio_Export.zip`);
    } catch (err) {
        alert("Error creating zip: " + err.message);
    } finally {
        setIsZipping(false);
    }
  };

  const toggleSelection = (id) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
    setSelectedIds(newSet);
  };

  const toggleSelectAllInRange = () => {
    const linesInRange = scriptLines.filter(l => l.panel_number >= startPanel && l.panel_number <= endPanel);
    const allSelected = linesInRange.every(l => selectedIds.has(l.id));
    const newSet = new Set(selectedIds);
    linesInRange.forEach(l => {
        if (allSelected) newSet.delete(l.id); else newSet.add(l.id);
    });
    setSelectedIds(newSet);
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

  const handleGenerateEmotions = () => {
    const linesToProcess = scriptLines.filter(l => selectedIds.has(l.id));
    if (linesToProcess.length === 0) return alert("Select lines first.");
    analyzeMutation.mutate(linesToProcess);
  };

  const handleGenerateAudio = (specificLine = null) => {
    let linesToProcess = specificLine ? [specificLine] : scriptLines.filter(l => selectedIds.has(l.id));
    if (linesToProcess.length === 0) return alert("Select lines first.");

    const invalidLines = linesToProcess.filter(l => !l.voice_id || !l.suggested_emotion);
    if (invalidLines.length > 0) return alert(`Cannot generate audio for ${invalidLines.length} lines. Missing Voice ID or Emotion Tag.`);

    linesToProcess.forEach(line => {
        const tag = line.suggested_emotion ? line.suggested_emotion.replace(/[\[\]]/g, '') : "Neutral";
        const text = `[${tag}] ${line.dialogue}`;
        audioMutation.mutate({ lineId: line.id, text, voiceId: line.voice_id });
    });
  };

  if (!data || data.length === 0) return <div className="text-center p-10 text-slate-400">No script data loaded.</div>;

  return (
    <div className="space-y-4">
      {/* CONTROL BAR */}
      <div className="flex flex-wrap justify-between items-center bg-white p-4 rounded-lg shadow-sm border border-slate-200 gap-4 sticky top-0 z-20">
        <div className="flex items-center gap-4">
            <div className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-md text-sm font-medium">{selectedIds.size} selected</div>
            <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-lg border border-slate-200">
                <span className="text-xs font-bold text-slate-500 uppercase px-2">Filter View:</span>
                <input type="number" value={startPanel} onChange={(e) => setStartPanel(Number(e.target.value))} className="w-12 p-1 text-center border rounded text-sm"/>
                <span className="text-slate-300">→</span>
                <input type="number" value={endPanel} onChange={(e) => setEndPanel(Number(e.target.value))} className="w-12 p-1 text-center border rounded text-sm"/>
            </div>
        </div>
        <div className="flex gap-3">
          <button onClick={handleDownloadZip} disabled={isZipping} className="flex items-center gap-2 bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-md hover:bg-slate-50 shadow-sm disabled:opacity-50 text-sm font-medium transition-colors">
            {isZipping ? <Loader2 className="w-4 h-4 animate-spin"/> : <Archive className="w-4 h-4 text-orange-600"/>} Download All (.zip)
          </button>

          <button onClick={handleGenerateEmotions} disabled={analyzeMutation.isPending || selectedIds.size === 0} className="flex items-center gap-2 bg-indigo-100 text-indigo-700 px-4 py-2 rounded-md hover:bg-indigo-200 shadow-sm disabled:opacity-50 text-sm font-medium transition-colors">
            {analyzeMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin"/> : <Users className="w-4 h-4"/>} Generate Emotion Tags
          </button>
          
          <button onClick={() => handleGenerateAudio()} disabled={audioMutation.isPending || selectedIds.size === 0} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 shadow-sm disabled:opacity-50 text-sm font-medium transition-colors">
            {audioMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin"/> : <Volume2 className="w-4 h-4"/>} Generate Audios ({selectedIds.size})
          </button>
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-lg shadow border border-slate-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-xs font-semibold sticky top-0 z-10">
            <tr>
              <th className="p-4 w-10 text-center cursor-pointer hover:bg-slate-100" onClick={toggleSelectAllInRange}>
                  <CheckSquare className="w-4 h-4 mx-auto text-slate-400"/>
              </th>
              <th className="p-4 w-16">Panel</th>
              <th className="p-4 w-32">Character</th>
              <th className="p-4 w-48 bg-indigo-50/50 text-indigo-700">Voice Actor <span className="text-red-500">*</span></th>
              <th className="p-4">Context & Dialogue</th>
              <th className="p-4 w-32 text-center">Audio</th>
              <th className="p-4 w-32 text-center">Emotion <span className="text-red-500">*</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {scriptLines.map((line) => {
              if (line.panel_number < startPanel || line.panel_number > endPanel) return null;
              
              const isAnalyzing = analyzeMutation.isPending && analyzeMutation.variables?.lines?.some(l => l.id === line.id);
              const isGenerating = audioMutation.isPending && audioMutation.variables?.lineId === line.id;

              return (
                <DirectorTableRow
                    key={line.id}
                    line={line}
                    isSelected={selectedIds.has(line.id)}
                    hasAudio={!!audioMap[line.id]}
                    isGenerating={isGenerating}
                    isAnalyzing={isAnalyzing}
                    playingId={playingId}
                    audioUrl={audioMap[line.id]}
                    availableVoices={availableVoices}
                    onToggleSelection={toggleSelection}
                    onVoiceChange={handleVoiceChange}
                    onGenerateAudio={handleGenerateAudio}
                    onRetryEmotion={handleRetryEmotion}
                    onTogglePlay={togglePlay}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}