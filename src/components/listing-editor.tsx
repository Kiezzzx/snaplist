'use client';

import { useState, useEffect } from 'react';
import { useCompletion } from '@ai-sdk/react';
import type { Platform, ProductMetadata } from '@/lib/types';

interface ListingEditorProps {
  platform: Platform;
  metadata: ProductMetadata | null;
  triggerId: number;
  onStatusChange: (platform: Platform, status: string) => void;
}

const platformNumbers: Record<Platform, string> = {
  Rednote: '01',
  Facebook: '02',
  eBay: '03',
};

export function ListingEditor({
  platform,
  metadata,
  triggerId,
  onStatusChange,
}: ListingEditorProps) {
  const [copied, setCopied] = useState(false);

  const { completion, complete, stop, isLoading, error } = useCompletion({
    api: '/api/generate',
    body: { platform },
    onFinish: () => onStatusChange(platform, 'success'),
    onError: () => onStatusChange(platform, 'error'),
  });

  useEffect(() => {
    if (triggerId <= 0 || !metadata) return;
    stop();
    const metadataString = JSON.stringify(metadata);
    complete(metadataString);
    onStatusChange(platform, 'loading');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerId]);

  async function handleCopy() {
    await navigator.clipboard.writeText(completion);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="relative flex h-96 flex-col border-t border-[#D0CFC9]">
      {/* Decorative large number */}
      <span className="pointer-events-none absolute right-0 top-0 text-[120px] font-black leading-none text-gray-100">
        {platformNumbers[platform]}
      </span>

      {/* Header */}
      <div className="flex items-center justify-between py-4">
        <h3 className="text-[10px] uppercase tracking-[0.3em] text-gray-400">
          {platform}
        </h3>
        <button
          onClick={handleCopy}
          disabled={isLoading || !completion}
          className={`
            border px-3 py-1 text-[10px] uppercase tracking-[0.2em] transition-colors
            ${
              isLoading || !completion
                ? 'cursor-not-allowed border-[#D0CFC9] text-gray-300'
                : copied
                  ? 'border-[#0A0A0A] bg-[#0A0A0A] text-white'
                  : 'border-[#0A0A0A] bg-transparent text-[#0A0A0A] hover:bg-[#0A0A0A] hover:text-white'
            }
          `}
        >
          {copied ? 'COPIED' : 'COPY'}
        </button>
      </div>

      {/* Content area */}
      <div className="relative flex-1 overflow-y-auto">
        {isLoading && !completion ? (
          <div className="space-y-3">
            <div className="h-3 w-3/4 animate-pulse bg-gray-200" />
            <div className="h-3 w-full animate-pulse bg-gray-200" />
            <div className="h-3 w-5/6 animate-pulse bg-gray-200" />
            <div className="h-3 w-2/3 animate-pulse bg-gray-200" />
            <p className="mt-6 text-[10px] uppercase tracking-[0.3em] text-gray-400">
              GENERATING...
            </p>
          </div>
        ) : error ? (
          <div className="flex h-full items-center">
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#E8421A]">
              FAILED TO GENERATE. PLEASE TRY AGAIN.
            </p>
          </div>
        ) : completion ? (
          <p className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-[#0A0A0A]">
            {completion}
          </p>
        ) : (
          <div className="flex h-full flex-col items-center justify-center">
            <span className="text-[120px] font-black leading-none text-gray-100">—</span>
            <p className="mt-4 text-[10px] uppercase tracking-[0.3em] text-gray-300">
              AWAITING GENERATION
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
