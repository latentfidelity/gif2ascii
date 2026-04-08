import React, { useCallback, useState } from 'react';
import { Upload } from 'lucide-react';

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
      className={`upload-zone ${isDragging ? 'upload-zone--dragging' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input 
        type="file" 
        id="fileInput" 
        className="sr-only" 
        accept="image/gif, image/jpeg, image/png, image/webp" 
        onChange={handleInputChange} 
      />
      
      <label htmlFor="fileInput" style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', cursor: 'pointer' }}>
        <div className="upload-zone__icon">
          <Upload size={28} strokeWidth={1.5} />
        </div>
        
        <h3 className="upload-zone__title">Upload Image</h3>
        <p className="upload-zone__subtitle">Drag and drop or click to select</p>
      </label>
      
      {error && (
        <p className="upload-zone__error">[ERROR] {error}</p>
      )}

    </div>
  );
};

export default FileUpload;
