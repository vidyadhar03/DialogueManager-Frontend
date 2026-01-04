import React, { useCallback } from 'react';
import { UploadCloud } from 'lucide-react';

export function UploadZone({ onFileSelect, isUploading }) {
  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      onFileSelect(e.target.files[0]);
    }
  };

  return (
    <div 
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      className="border-2 border-dashed border-slate-300 rounded-xl p-12 text-center hover:bg-slate-50 transition-colors cursor-pointer"
    >
      <input 
        type="file" 
        id="file-upload" 
        className="hidden" 
        onChange={handleChange} 
        accept=".xlsx" 
      />
      <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center">
        <div className="bg-blue-100 p-4 rounded-full mb-4">
          <UploadCloud className="w-8 h-8 text-blue-600" />
        </div>
        <h3 className="text-lg font-semibold text-slate-700">
          {isUploading ? "Uploading..." : "Click or Drag Final Excel Here"}
        </h3>
        <p className="text-slate-500 mt-2 text-sm">
          Supports .xlsx (Final Merged Task File)
        </p>
      </label>
    </div>
  );
}