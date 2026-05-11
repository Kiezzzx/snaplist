'use client';

import { useState, useRef, useCallback } from 'react';
import { compressAndConvertToBase64 } from '@/lib/compress-image';

interface UploadZoneProps {
  onImageProcessed: (base64: string) => void;
  isExtracting: boolean;
}

export function UploadZone({ onImageProcessed, isExtracting }: UploadZoneProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith('image/')) {
        setError('Please upload an image file');
        return;
      }

      setPreviewUrl(URL.createObjectURL(file));
      setIsCompressing(true);
      setError(null);

      try {
        const base64 = await compressAndConvertToBase64(file);
        onImageProcessed(base64);
      } catch {
        setError('Compression failed. Please try again.');
      } finally {
        setIsCompressing(false);
      }
    },
    [onImageProcessed]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) {
        handleFile(file);
      }
    },
    [handleFile]
  );

  const handleClick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFile(file);
      }
    },
    [handleFile]
  );

  const isDisabled = isExtracting || isCompressing;

  return (
    <div className="w-full">
      <div
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          backgroundImage: `linear-gradient(to right, rgba(208, 207, 201, 0.3) 1px, transparent 1px),
                           linear-gradient(to bottom, rgba(208, 207, 201, 0.3) 1px, transparent 1px)`,
          backgroundSize: '20px 20px',
        }}
        className={`
          relative flex min-h-[280px] cursor-pointer flex-col items-center
          justify-center border transition-colors
          ${isDragOver ? 'border-[#E8421A]' : 'border-[#D0CFC9]'}
          ${isDisabled ? 'cursor-not-allowed opacity-60' : 'hover:border-[#E8421A]'}
        `}
      >
        {/* Inner dashed border */}
        <div className="pointer-events-none absolute inset-4 border border-dashed border-[#D0CFC9]" />

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic"
          disabled={isDisabled}
          onChange={handleInputChange}
          className="hidden"
        />

        {!previewUrl ? (
          <div className="relative z-10 flex flex-col items-center text-center">
            <span className="text-8xl font-thin text-gray-200">+</span>
            <p className="mt-4 text-[10px] uppercase tracking-[0.3em] text-gray-400">
              DRAG & DROP
            </p>
            <p className="mt-2 text-[9px] uppercase tracking-[0.2em] text-gray-300">
              JPG · PNG · WEBP · HEIC
            </p>
          </div>
        ) : (
          <div className="relative h-full w-full p-6">
            <img
              src={previewUrl}
              alt="Preview"
              className="mx-auto max-h-[240px] object-cover"
            />

            {(isCompressing || isExtracting) && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60">
                <div className="h-6 w-6 animate-spin border-2 border-white border-t-transparent" />
                <p className="mt-3 text-[10px] uppercase tracking-[0.3em] text-white">
                  {isCompressing ? 'COMPRESSING...' : 'EXTRACTING AI DATA...'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {error && (
        <p className="mt-3 text-[10px] uppercase tracking-[0.2em] text-[#E8421A]">{error}</p>
      )}
    </div>
  );
}
