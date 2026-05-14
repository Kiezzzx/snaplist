'use client';

import { useState, useEffect, useRef } from 'react';
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

// Stagger requests slightly so 3 concurrent calls don't all hit Gemini in the same tick
// (the most common cause of one-platform-succeeds, others-get-429).
const PLATFORM_STAGGER_MS: Record<Platform, number> = {
  Rednote: 0,
  Facebook: 250,
  eBay: 500,
};

function isAbortError(err: unknown): boolean {
  if (!err) return false;
  if (err instanceof Error) {
    if (err.name === 'AbortError') return true;
    if (/abort/i.test(err.message)) return true;
  }
  return false;
}

export function ListingEditor({
  platform,
  metadata,
  triggerId,
  onStatusChange,
}: ListingEditorProps) {
  const [copied, setCopied] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  // Track the currently-active triggerId so stale callbacks (e.g. onError from a stop())
  // can't downgrade status set by a newer request.
  const activeTriggerRef = useRef(0);

  const { completion, complete, stop, isLoading, error, setCompletion } = useCompletion({
    api: '/api/generate',
    body: { platform },
    streamProtocol: 'text',
    onFinish: () => {
      onStatusChange(platform, 'success');
    },
    onError: (err) => {
      // stop() raises an abort error — that's an intentional cancel, not a failure.
      if (isAbortError(err)) return;
      console.error(platform + ': error', err);
      onStatusChange(platform, 'error');
    },
  });

  useEffect(() => {
    if (triggerId <= 0 || !metadata) return;
    if (triggerId === activeTriggerRef.current) return; // dedupe StrictMode double-fires
    activeTriggerRef.current = triggerId;

    console.log(`${platform}: triggering generation`, { triggerId });

    // Reset content + cancel any in-flight request from a previous trigger
    if (completion) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsRegenerating(true);
      setCompletion('');
    }
    stop();
    onStatusChange(platform, 'loading');

    const myTrigger = triggerId;
    const timer = setTimeout(() => {
      if (activeTriggerRef.current !== myTrigger) return;
      complete(JSON.stringify(metadata))
        .catch((err) => {
          if (activeTriggerRef.current !== myTrigger) return;
          if (isAbortError(err)) return;
          console.error(`${platform}: complete() failed`, err);
          onStatusChange(platform, 'error');
        })
        .finally(() => {
          if (activeTriggerRef.current !== myTrigger) return;
          setIsRegenerating(false);
        });
    }, PLATFORM_STAGGER_MS[platform]);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerId]);

  async function handleCopy() {
    await navigator.clipboard.writeText(completion);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="relative min-h-[600px] border-t border-[#D0CFC9] pt-6">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <span className="text-3xl font-black text-gray-200">{platformNumbers[platform]}</span>
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-gray-400">
                Platform
              </p>
              <p className="text-base font-bold uppercase tracking-tight">{platform}</p>
            </div>
          </div>
        </div>
        <button
          onClick={handleCopy}
          disabled={isLoading || !completion}
          className={`
            border px-4 py-2 font-mono text-[10px] uppercase tracking-widest transition-colors
            ${
              isLoading || !completion
                ? 'cursor-not-allowed border-gray-200 text-gray-300'
                : copied
                  ? 'border-[#E8421A] bg-[#E8421A] text-white'
                  : 'border-gray-300 bg-transparent text-gray-600 hover:border-black hover:text-black'
            }
          `}
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>

      {/* Content area */}
      <div className="relative min-h-[500px]">
        {isLoading && !completion ? (
          <div className="flex h-full flex-col items-center justify-center py-24">
            {/* Loading animation */}
            <div className="mb-6 flex gap-2">
              <div className="h-2 w-2 animate-pulse bg-gray-400" style={{ animationDelay: '0ms' }} />
              <div className="h-2 w-2 animate-pulse bg-gray-400" style={{ animationDelay: '150ms' }} />
              <div className="h-2 w-2 animate-pulse bg-gray-400" style={{ animationDelay: '300ms' }} />
            </div>
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-gray-400">
              {isRegenerating ? 'Regenerating copy...' : 'Generating copy...'}
            </p>
          </div>
        ) : error ? (
          <div className="flex h-full flex-col items-center justify-center py-24">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#E8421A] mb-4">
              {(() => {
                const msg = error.message.toLowerCase();
                if (msg.includes('429') || msg.includes('quota') || msg.includes('rate')) {
                  return 'Rate limit reached. Please wait and try again.';
                }
                if (msg.includes('503') || msg.includes('unavailable')) {
                  return 'Service temporarily unavailable. Please retry.';
                }
                return 'Generation failed. Please try again.';
              })()}
            </p>
            <button
              onClick={() => {
                if (!metadata) return;
                onStatusChange(platform, 'loading');
                setCompletion('');
                complete(JSON.stringify(metadata)).catch((err) => {
                  if (isAbortError(err)) return;
                  onStatusChange(platform, 'error');
                });
              }}
              disabled={!metadata}
              className="border border-[#E8421A] px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-[#E8421A] hover:bg-[#E8421A] hover:text-white transition-colors"
            >
              Retry
            </button>
          </div>
        ) : completion ? (
          <div className="relative">
            <p className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-black">
              {completion}
            </p>
            {/* Status indicator */}
            <div className="mt-6 flex items-center gap-2 border-t border-[#D0CFC9] pt-4">
              <div className="h-2 w-2 bg-green-500" />
              <span className="font-mono text-[8px] uppercase tracking-[0.2em] text-gray-400">
                Generation complete — {completion.length} characters
              </span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center px-12">
            <div className="w-16 h-px bg-[#D0CFC9] mb-8" />
            <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-3">
              Awaiting Generation
            </p>
            <p className="text-xs text-gray-300 leading-relaxed max-w-[200px]">
              Upload a photo and fill in item details, then click Generate
            </p>
            <div className="w-16 h-px bg-[#D0CFC9] mt-8" />
          </div>
        )}
      </div>
    </div>
  );
}
