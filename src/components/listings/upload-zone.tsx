'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import Image from 'next/image';
import { Camera } from 'lucide-react';
import { compressAndConvertToBase64 } from '@/lib/utils/compress-image';

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

  // Cleanup blob URL to prevent memory leaks
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith('image/')) {
        setError('INVALID FILE FORMAT');
        return;
      }

      setPreviewUrl(URL.createObjectURL(file));
      setIsCompressing(true);
      setError(null);

      try {
        const base64 = await compressAndConvertToBase64(file);
        onImageProcessed(base64);
      } catch {
        setError('COMPRESSION FAILED // RETRY');
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
        className={`
          relative flex min-h-[240px] cursor-pointer flex-col items-center
          justify-center bg-[#E8E7E3] transition-all border border-[#D0CFC9]
          ${isDragOver ? 'border-2 border-[#E8421A] bg-[#E8421A]/5' : ''}
          ${isDisabled ? 'cursor-not-allowed opacity-60' : 'hover:bg-[#E5E5E5] hover:border-[#E8421A]'}
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic"
          disabled={isDisabled}
          onChange={handleInputChange}
          className="hidden"
        />

        {!previewUrl ? (
          <div className="flex flex-col items-center text-center">
            <Camera className="w-8 h-8 text-gray-400 mb-3" />
            <p className="text-sm font-medium text-gray-600 tracking-wide">
              Upload Item Photo
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Drag & drop or click to browse
            </p>
            <p className="text-[10px] tracking-widest text-gray-300 uppercase mt-3">
              JPG · PNG · WEBP · HEIC
            </p>
            <button
              type="button"
              className="mt-4 px-6 py-2 border border-[#D0CFC9] text-xs uppercase tracking-widest text-gray-500 hover:border-black hover:text-black transition-colors"
            >
              Select Photo
            </button>
          </div>
        ) : (
          <div className="relative h-full w-full p-4">
            <Image
              src={previewUrl}
              alt="Preview"
              width={200}
              height={200}
              className="mx-auto max-h-[200px] w-auto object-contain"
              unoptimized
            />

            {(isCompressing || isExtracting) && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80">
                {/* Animated loading indicator */}
                <div className="mb-4 flex gap-1">
                  <div className="h-2 w-2 bg-[#E8421A] motion-safe:animate-pulse" style={{ animationDelay: '0ms' }} />
                  <div className="h-2 w-2 bg-[#E8421A] motion-safe:animate-pulse" style={{ animationDelay: '150ms' }} />
                  <div className="h-2 w-2 bg-[#E8421A] motion-safe:animate-pulse" style={{ animationDelay: '300ms' }} />
                </div>
                <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-white">
                  {isCompressing ? 'COMPRESSING...' : 'EXTRACTING DATA...'}
                </p>
                <p className="mt-1 font-mono text-[8px] uppercase tracking-[0.2em] text-white/50">
                  PLEASE WAIT
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {error && (
        <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.15em] text-[#E8421A]">
          ERROR // {error}
        </p>
      )}
    </div>
  );
}
