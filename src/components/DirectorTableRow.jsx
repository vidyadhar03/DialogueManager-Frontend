import React from 'react';
import { PlayCircle, PauseCircle, Volume2, Loader2, Download, Users, CheckSquare, Square, AlertCircle } from 'lucide-react';
import { VoiceSelector } from './VoiceSelector';

export function DirectorTableRow({ 
    line, 
    isSelected, 
    hasAudio, 
    isGenerating, 
    playingId, 
    audioUrl, 
    availableVoices, 
    onToggleSelection, 
    onVoiceChange, 
    onGenerateAudio, 
    onTogglePlay 
}) {

    const getEmotionColor = (tag) => {
        if (!tag) return "bg-slate-100 text-slate-500";
        const t = tag.toLowerCase();
        if (t.includes('angry') || t.includes('shout') || t.includes('aggressive')) return "bg-red-100 text-red-700 border-red-200";
        if (t.includes('sad') || t.includes('weep')) return "bg-blue-100 text-blue-700 border-blue-200";
        return "bg-green-100 text-green-700 border-green-200";
    };

    return (
        <tr className={`transition-colors ${isSelected ? 'bg-indigo-50/30' : 'hover:bg-slate-50/50'}`}>
            {/* CHECKBOX */}
            <td className="p-4 text-center">
                <button onClick={() => onToggleSelection(line.id)} className="text-slate-400 hover:text-indigo-600">
                    {isSelected ? <CheckSquare className="w-5 h-5 text-indigo-600" /> : <Square className="w-5 h-5" />}
                </button>
            </td>

            {/* PANEL INFO */}
            <td className="p-4 text-slate-400 font-mono text-sm align-top">{line.panel_number}</td>
            <td className="p-4 font-medium text-slate-700 align-top">
                <div className="flex items-center gap-2"><Users className="w-3 h-3 text-slate-300" />{line.characters[0] || "Unknown"}</div>
            </td>

            {/* VOICE SELECTOR */}
            <td className="p-4 align-top">
                <VoiceSelector voices={availableVoices} value={line.voice_id} onChange={(newId) => onVoiceChange(line.id, newId)} />
                {!line.voice_id && <div className="text-[10px] text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Required</div>}
            </td>

            {/* DIALOGUE */}
            <td className="p-4 text-slate-800 leading-relaxed max-w-lg align-top">
                <div className="text-xs text-orange-600 font-bold mb-1 bg-orange-50 inline-block px-1 rounded">{line.action}</div>
                <div className="text-xs text-slate-400 mb-2 italic">{line.sfx}</div>
                <p>"{line.dialogue}"</p>
            </td>

            {/* AUDIO CONTROLS */}
            <td className="p-4 align-top text-center">
                {!hasAudio ? (
                    <button
                        onClick={() => onGenerateAudio(line)}
                        disabled={isGenerating}
                        className="text-slate-400 hover:text-indigo-600 transition-colors disabled:opacity-50"
                        title="Generate Audio"
                    >
                        {isGenerating ? <Loader2 className="w-6 h-6 animate-spin text-indigo-600" /> : <Volume2 className="w-6 h-6" />}
                    </button>
                ) : (
                    <div className="flex items-center justify-center gap-2">
                        <button onClick={() => onTogglePlay(line.id, audioUrl)} className="text-indigo-600 hover:text-indigo-800 transition-colors">
                            {playingId === line.id ? <PauseCircle className="w-8 h-8" /> : <PlayCircle className="w-8 h-8" />}
                        </button>
                        <a href={audioUrl} download={`line_${line.id}.mp3`} className="text-slate-400 hover:text-green-600 transition-colors">
                            <Download className="w-5 h-5" />
                        </a>
                    </div>
                )}
            </td>

            {/* EMOTION TAG */}
            <td className="p-4 align-top text-center">
                <div className={`px-2 py-1 rounded-md text-xs border text-center font-medium ${getEmotionColor(line.suggested_emotion)}`}>
                    {line.suggested_emotion || "Neutral"}
                </div>
                {!line.suggested_emotion && <div className="text-[10px] text-red-500 mt-1">Required</div>}
            </td>
        </tr>
    );
}