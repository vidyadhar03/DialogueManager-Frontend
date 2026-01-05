import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { UploadZone } from '../components/UploadZone';
import { DirectorTable } from '../components/DirectorTable';
import { uploadExcel } from '../api';

// Note: I removed QueryClientProvider since it's now in App.jsx
export function EpisodeDirector() {
  const [scriptData, setScriptData] = useState(null);

  const uploadMutation = useMutation({
    mutationFn: uploadExcel,
    onSuccess: (data) => {
      setScriptData(data.data);
    },
    onError: (err) => {
      alert("Error uploading file: " + err.message);
    }
  });

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <header className="flex items-center gap-3 mb-8">
          <div className="bg-indigo-600 p-2 rounded-lg">
            <span className="text-2xl">🎬</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">MotionX Director</h1>
            <p className="text-slate-500 text-sm">AI-Powered Audio Context Engine</p>
          </div>
        </header>

        {/* Content */}
        {!scriptData ? (
          <div className="max-w-2xl mx-auto mt-20">
             <UploadZone 
               onFileSelect={(file) => uploadMutation.mutate(file)} 
               isUploading={uploadMutation.isPending}
             />
          </div>
        ) : (
          <DirectorTable data={scriptData} />
        )}
      </div>
    </div>
  );
}