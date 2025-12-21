import React, { useCallback, useState } from 'react';
import { Upload, FileType, AlertCircle } from 'lucide-react';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFileSelect }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const validateAndPassFile = (file: File) => {
    if (!file.type.includes('gif') && !file.type.includes('image')) {
      setError("Please upload a GIF or image file.");
      return;
    }
    setError(null);
    onFileSelect(file);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndPassFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndPassFile(e.target.files[0]);
    }
  };

  return (
    <div 
      className={`w-full max-w-xl mx-auto p-12 border-2 border-dashed rounded-2xl transition-all duration-300 flex flex-col items-center justify-center text-center cursor-pointer group
        ${isDragging 
          ? 'border-indigo-500 bg-indigo-500/10 scale-[1.02]' 
          : 'border-zinc-700 hover:border-zinc-500 bg-zinc-900/50'
        }
      `}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => document.getElementById('fileInput')?.click()}
    >
      <input 
        type="file" 
        id="fileInput" 
        className="hidden" 
        accept="image/gif, image/jpeg, image/png, image/webp" 
        onChange={handleInputChange} 
      />
      
      <div className={`p-4 rounded-full mb-4 transition-colors ${isDragging ? 'bg-indigo-500 text-white' : 'bg-zinc-800 text-zinc-400 group-hover:text-zinc-200'}`}>
        <Upload size={32} />
      </div>
      
      <h3 className="text-xl font-bold text-zinc-100 mb-2">Upload a GIF</h3>
      <p className="text-zinc-400 text-sm mb-6">Drag and drop or click to select</p>
      
      {error && (
        <div className="flex items-center gap-2 text-red-400 text-sm bg-red-400/10 px-4 py-2 rounded-lg">
          <AlertCircle size={16} />
          {error}
        </div>
      )}
      
    </div>
  );
};

export default FileUpload;
