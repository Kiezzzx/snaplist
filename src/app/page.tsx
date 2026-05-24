'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { UploadZone } from '@/components/listings/upload-zone';
import { MetadataForm } from '@/components/listings/metadata-form';
import { ListingEditor } from '@/components/listings/listing-editor';
import { markListingAsGenerated, updateListingMetadata } from '@/lib/actions/listings';
import type { ProductMetadata, Platform } from '@/lib/types';

const platformNumbers: Record<Platform, string> = {
  Rednote: '01',
  Facebook: '02',
  eBay: '03',
};

export default function Home() {
  const [aiData, setAiData] = useState<Partial<ProductMetadata> | null>(null);
  const [dbId, setDbId] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [targetMetadata, setTargetMetadata] = useState<ProductMetadata | null>(null);
  const [generateTriggerId, setGenerateTriggerId] = useState(0);
  const [activeTab, setActiveTab] = useState<Platform>('Rednote');
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>([
    'Rednote',
    'Facebook',
    'eBay',
  ]);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [platformStatuses, setPlatformStatuses] = useState<Record<Platform, string>>({
    Rednote: 'idle',
    Facebook: 'idle',
    eBay: 'idle',
  });
  // Keep selectedPlatforms in a ref so handleStatusChange (called from child callbacks)
  // never reads a stale snapshot when checking "are all selected platforms done?"
  const selectedPlatformsRef = useRef<Platform[]>(selectedPlatforms);
  useEffect(() => {
    selectedPlatformsRef.current = selectedPlatforms;
  }, [selectedPlatforms]);
  // Same staleness guard for dbId — handleStatusChange fires from child callbacks
  // and needs the latest id at the moment all platforms finish.
  const dbIdRef = useRef<string | null>(dbId);
  useEffect(() => {
    dbIdRef.current = dbId;
  }, [dbId]);
  // Fire markListingAsGenerated at most once per generation run; otherwise each
  // straggler 'success' callback would re-trigger the DB write.
  const markedTriggerRef = useRef<number>(0);
  const generateTriggerIdRef = useRef<number>(0);
  useEffect(() => {
    generateTriggerIdRef.current = generateTriggerId;
  }, [generateTriggerId]);

  async function onImageProcessed(base64: string) {
    setIsExtracting(true);
    setExtractError(null);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

    try {
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64 }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.status === 413) {
        setExtractError('Image too large. Please use a smaller photo.');
        return;
      }
      if (res.status === 429) {
        // Two 429 sources now: our daily rate limit (code RATE_LIMIT) and
        // Gemini's transient quota error (code AI_BUSY). The route sends a
        // tailored message for each — surface it, with a generic fallback.
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setExtractError(body?.error ?? 'Too many requests. Please wait a moment and try again.');
        return;
      }
      if (res.status >= 500) {
        setExtractError('AI service error. Please try again in a moment.');
        return;
      }
      if (!res.ok) {
        setExtractError('Failed to analyze image. Please try again.');
        return;
      }

      const json = (await res.json()) as { success: boolean; dbId?: string; metadata?: Partial<ProductMetadata>; error?: string };
      if (json.success) {
        setAiData(json.metadata ?? null);
        setDbId(json.dbId ?? null);
      } else {
        setExtractError(json.error ?? 'Extraction failed');
      }
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        setExtractError('Request timed out. Please try again.');
      } else {
        setExtractError('Connection failed. Check your internet and try again.');
      }
    } finally {
      setIsExtracting(false);
    }
  }

  function onSubmit(metadata: ProductMetadata, platforms: Platform[]) {
    setTargetMetadata(metadata);
    setSelectedPlatforms(platforms);
    // Persist the reviewed metadata onto the row so the dashboard reflects the
    // user's edits (e.g. corrected condition), not the AI's extraction-time
    // values. Fire-and-forget: it writes only the metadata column, so it can't
    // race the generate path's generatedCopies/status writes.
    if (dbId) {
      updateListingMetadata(dbId, metadata).catch((err) => {
        console.error('Failed to persist edited metadata:', err);
      });
    }
    setGenerateTriggerId(Date.now());
    // Reset the mark-once guard so the new run can fire markListingAsGenerated.
    markedTriggerRef.current = 0;
    setActiveTab(platforms[0]);
    setHasGenerated(true);
    setIsGenerating(true);
    // Selected platforms -> loading; unselected -> idle so all-done check
    // can't be blocked by a stale 'loading' from a previous generation.
    setPlatformStatuses(() => {
      const next: Record<Platform, string> = { Rednote: 'idle', Facebook: 'idle', eBay: 'idle' };
      for (const p of platforms) {
        next[p] = 'loading';
      }
      return next;
    });
  }

  function handleStatusChange(platform: Platform, status: string) {
    console.log(`${platform}: ${status}`);
    setPlatformStatuses((prev) => {
      const next = { ...prev, [platform]: status };
      // Read selectedPlatforms via ref to avoid stale-closure mistakes
      // when this callback is invoked from a child during a render cycle.
      const allDone = selectedPlatformsRef.current.every(
        (p) => next[p] === 'success' || next[p] === 'error'
      );
      if (allDone) {
        setIsGenerating(false);
        const allSuccess = selectedPlatformsRef.current.every(
          (p) => next[p] === 'success'
        );
        const id = dbIdRef.current;
        const trigger = generateTriggerIdRef.current;
        // Only mark the row 'generated' when EVERY selected platform succeeded —
        // a partial run (any 'error') stays in 'draft' so the user can retry.
        // The markedTriggerRef guard prevents duplicate writes if multiple
        // success callbacks somehow flush during the same trigger window.
        if (allSuccess && id && trigger > 0 && markedTriggerRef.current !== trigger) {
          markedTriggerRef.current = trigger;
          markListingAsGenerated(id).catch((err) => {
            console.error('Failed to mark listing as generated:', err);
            // Reset so a retry can re-attempt the transition.
            markedTriggerRef.current = 0;
          });
        }
      }
      return next;
    });
  }

  return (
    <div className="bg-grid relative min-h-screen w-full overflow-x-hidden pb-16">
      {/* Header */}
      <header className="border-b border-[#D0CFC9] px-4 py-4 md:px-8 md:py-5">
        <div className="flex items-end justify-between">
          <div className="flex items-baseline gap-4">
            <h1 className="text-3xl font-black uppercase tracking-tight md:text-4xl">SNAP.</h1>
            <span className="hidden font-mono text-[9px] uppercase tracking-[0.2em] text-gray-500 md:block">
              AI Listing Generator
            </span>
          </div>
          <Link
            href="/dashboard"
            className="-mr-2 inline-flex min-h-11 items-center px-2 font-mono text-[10px] uppercase tracking-[0.2em] text-gray-500 transition-colors hover:text-[#E8421A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E8421A]"
          >
            View History →
          </Link>
        </div>
      </header>

      {/* Main content */}
      <main className="px-4 py-6 md:p-8 lg:p-12">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 md:gap-16 lg:grid-cols-[45fr_55fr]">
          {/* Left column - Input Area */}
          <div className="min-w-0 space-y-10">
            {/* Section header */}
            <div className="flex items-center justify-between border-b border-[#D0CFC9] pb-2">
              <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-gray-600">
                Input
              </span>
              <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-gray-500">
                Step 01/02
              </span>
            </div>

            {/* Upload Zone */}
            <div>
              <div className="mb-3 flex items-center gap-3">
                <span className="text-sm font-black text-gray-400 md:text-base">01</span>
                <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-gray-600">
                  Image Upload
                </span>
              </div>
              <UploadZone
                onImageProcessed={onImageProcessed}
                isExtracting={isExtracting}
              />
            </div>

            {/* Error display */}
            {extractError && (
              <div className="border-l-2 border-[#E8421A] bg-[#E8421A]/5 p-4">
                <p className="font-mono text-[10px] text-[#E8421A]">
                  {extractError}
                </p>
              </div>
            )}

            {/* Metadata Form */}
            <div className="border-t border-[#D0CFC9] pt-10">
              <div className="mb-6 flex items-center gap-3">
                <span className="text-sm font-black text-gray-400 md:text-base">02</span>
                <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-gray-600">
                  Item Details
                </span>
              </div>
              <MetadataForm
                aiData={aiData}
                onSubmit={onSubmit}
                isGenerating={isGenerating}
                hasGenerated={hasGenerated}
              />
            </div>
          </div>

          {/* Right column - Output Area */}
          <div className="min-w-0 space-y-6">
            {/* Section header */}
            <div className="flex items-center justify-between border-b border-[#D0CFC9] pb-2">
              <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-gray-600">
                Output
              </span>
              <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-gray-500">
                Generated Copy
              </span>
            </div>

            {/* Platform tabs */}
            <div className="flex items-end gap-2 md:gap-6 border-b border-[#D0CFC9] overflow-x-auto scrollbar-none -mx-4 px-4 md:mx-0 md:px-0">
              {selectedPlatforms.map((platform) => {
                const isActive = activeTab === platform;
                const status = platformStatuses[platform];
                return (
                  <button
                    key={platform}
                    onClick={() => setActiveTab(platform)}
                    className={`
                      shrink-0 whitespace-nowrap px-2 py-3 text-[10px] tracking-wider md:px-4 md:text-xs md:tracking-widest uppercase transition-colors
                      ${
                        isActive
                          ? 'border-b-2 border-black text-black font-semibold'
                          : 'border-b-2 border-transparent text-gray-400 hover:text-gray-600'
                      }
                    `}
                  >
                    <span className="mr-1 md:mr-2 font-bold">{platformNumbers[platform]}</span>
                    {platform}
                    {/* Per-tab status so users see ALL platform results, not just the active one.
                        Shape AND color differentiate the four states so color-blind users
                        and screen readers can distinguish them. */}
                    {status === 'loading' ? (
                      <span
                        className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-gray-400 align-middle motion-safe:animate-pulse"
                        role="status"
                        aria-label={`${platform}: generating`}
                      />
                    ) : status === 'error' ? (
                      <span
                        className="ml-1.5 align-middle font-bold text-[#E8421A]"
                        role="status"
                        aria-label={`${platform}: generation failed`}
                      >
                        !
                      </span>
                    ) : status === 'success' ? (
                      <Check
                        className="ml-1.5 inline-block h-3 w-3 align-middle text-green-600"
                        role="status"
                        aria-label={`${platform}: generated`}
                      />
                    ) : isActive ? (
                      <span
                        className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-[#E8421A] align-middle"
                        aria-hidden
                      />
                    ) : null}
                  </button>
                );
              })}
            </div>

            {/* Listing editors */}
            <div className={activeTab === 'Rednote' ? 'block' : 'hidden'}>
              <ListingEditor
                platform="Rednote"
                metadata={targetMetadata}
                dbId={dbId}
                triggerId={selectedPlatforms.includes('Rednote') ? generateTriggerId : 0}
                isActive={activeTab === 'Rednote'}
                onStatusChange={handleStatusChange}
              />
            </div>
            <div className={activeTab === 'Facebook' ? 'block' : 'hidden'}>
              <ListingEditor
                platform="Facebook"
                metadata={targetMetadata}
                dbId={dbId}
                triggerId={selectedPlatforms.includes('Facebook') ? generateTriggerId : 0}
                isActive={activeTab === 'Facebook'}
                onStatusChange={handleStatusChange}
              />
            </div>
            <div className={activeTab === 'eBay' ? 'block' : 'hidden'}>
              <ListingEditor
                platform="eBay"
                metadata={targetMetadata}
                dbId={dbId}
                triggerId={selectedPlatforms.includes('eBay') ? generateTriggerId : 0}
                isActive={activeTab === 'eBay'}
                onStatusChange={handleStatusChange}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
