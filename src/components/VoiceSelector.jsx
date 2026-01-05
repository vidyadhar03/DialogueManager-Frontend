import React from 'react';

export function VoiceSelector({ value, voices, onChange, className }) {
  // If voices haven't loaded yet, show a loading state
  if (!voices || voices.length === 0) {
    return <span className="text-xs text-slate-400">Loading voices...</span>;
  }

  return (
    <div className={`relative ${className}`}>
      <select
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none bg-white border border-slate-200 text-slate-700 text-sm rounded-md py-1.5 pl-3 pr-8 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent shadow-sm cursor-pointer"
      >
        <option value="" disabled>Select Voice...</option>
        {voices.map((voice) => (
          <option key={voice.voice_id} value={voice.voice_id}>
            {voice.name} ({voice.category})
          </option>
        ))}
      </select>
      
      {/* Custom arrow icon for better UI */}
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
        <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
          <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
        </svg>
      </div>
    </div>
  );
}