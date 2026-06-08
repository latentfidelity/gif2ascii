import React, { useCallback, useRef, useState } from 'react';
import { Upload } from 'lucide-react';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
}

const SUPPORTED_IMAGE_TYPES = new Set([
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
]);
const SUPPORTED_IMAGE_EXTENSIONS = ['.gif', '.jpg', '.jpeg', '.png', '.webp'];

const isSupportedImageFile = (file: File): boolean => {
  const type = file.type.toLowerCase();
  if (SUPPORTED_IMAGE_TYPES.has(type)) return true;

  const name = file.name.toLowerCase();
  return type === '' && SUPPORTED_IMAGE_EXTENSIONS.some(ext => name.endsWith(ext));
};

const FileUpload: React.FC<FileUploadProps> = ({ onFileSelect }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const validateAndPassFile = useCallback((file: File) => {
    if (!isSupportedImageFile(file)) {
      setError("Please upload a GIF, PNG, JPEG, or WebP file.");
      return;
    }
    setError(null);
    onFileSelect(file);
  }, [onFileSelect]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndPassFile(e.dataTransfer.files[0]);
    }
  }, [validateAndPassFile]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndPassFile(e.target.files[0]);
    }
  }, [validateAndPassFile]);

  return (
    <div 
      className={`upload-zone ${isDragging ? 'upload-zone--dragging' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input 
        ref={inputRef}
        type="file" 
        id="fileInput" 
        className="file-input-hidden"
        accept="image/gif, image/jpeg, image/png, image/webp" 
        onChange={handleInputChange} 
      />
      
      <button
        type="button"
        className="upload-zone__button"
        onClick={() => inputRef.current?.click()}
      >
        <div className="upload-zone__icon">
          <Upload size={28} strokeWidth={1.5} />
        </div>
        
        <h3 className="upload-zone__title">Upload Image</h3>
        <p className="upload-zone__subtitle">Drag and drop or click to select</p>
      </button>
      
      {error && (
        <p className="upload-zone__error">[ERROR] {error}</p>
      )}

    </div>
  );
};

export default FileUpload;
