'use client';

import { useState, useRef, useEffect } from 'react';
import { UploadZone } from '@/components/upload-zone';
import { MetadataForm } from '@/components/metadata-form';
import { ListingEditor } from '@/components/listing-editor';
import type { ProductMetadata, Platform } from '@/lib/types';

const platformNumbers: Record<Platform, string> = {
  Rednote: '01',
  Facebook: '02',
  eBay: '03',
};

export default function Home() {
  const [aiData, setAiData] = useState<Partial<ProductMetadata> | null>(null);
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
        setExtractError('AI service is busy. Please wait a moment and try again.');
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

      const json = (await res.json()) as { success: boolean; data?: Partial<ProductMetadata>; error?: string };
      if (json.success) {
        setAiData(json.data ?? null);
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
    setGenerateTriggerId(Date.now());
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
          <span className="hidden text-[9px] uppercase tracking-widest text-gray-300 md:inline">©2025</span>
        </div>
      </header>

      {/* Main content */}
      <main className="px-4 py-6 md:p-8 lg:p-12">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 md:gap-16 lg:grid-cols-[45%_55%]">
          {/* Left column - Input Area */}
          <div className="space-y-10">
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
          <div className="min-h-screen space-y-6">
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
            <div className="flex items-end gap-6 border-b border-[#D0CFC9] overflow-x-auto scrollbar-none -mx-4 px-4 md:mx-0 md:px-0">
              {selectedPlatforms.map((platform) => {
                const isActive = activeTab === platform;
                const status = platformStatuses[platform];
                return (
                  <button
                    key={platform}
                    onClick={() => setActiveTab(platform)}
                    className={`
                      whitespace-nowrap px-4 py-3 text-xs uppercase tracking-widest transition-colors
                      ${
                        isActive
                          ? 'border-b-2 border-black text-black font-semibold'
                          : 'border-b-2 border-transparent text-gray-400 hover:text-gray-600'
                      }
                    `}
                  >
                    <span className="mr-2 font-bold">{platformNumbers[platform]}</span>
                    {platform}
                    {/* Per-tab status so users see ALL platform results, not just the active one. */}
                    {status === 'loading' ? (
                      <span
                        className="inline-block w-1.5 h-1.5 rounded-full bg-gray-400 ml-1.5 align-middle animate-pulse"
                        title="Generating…"
                      />
                    ) : status === 'error' ? (
                      <span
                        className="ml-1.5 align-middle font-bold text-[#E8421A]"
                        title="Generation failed"
                      >
                        !
                      </span>
                    ) : status === 'success' ? (
                      <span
                        className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 ml-1.5 align-middle"
                        title="Generated"
                      />
                    ) : isActive ? (
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#E8421A] ml-1.5 align-middle" />
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
                triggerId={selectedPlatforms.includes('Rednote') ? generateTriggerId : 0}
                onStatusChange={handleStatusChange}
              />
            </div>
            <div className={activeTab === 'Facebook' ? 'block' : 'hidden'}>
              <ListingEditor
                platform="Facebook"
                metadata={targetMetadata}
                triggerId={selectedPlatforms.includes('Facebook') ? generateTriggerId : 0}
                onStatusChange={handleStatusChange}
              />
            </div>
            <div className={activeTab === 'eBay' ? 'block' : 'hidden'}>
              <ListingEditor
                platform="eBay"
                metadata={targetMetadata}
                triggerId={selectedPlatforms.includes('eBay') ? generateTriggerId : 0}
                onStatusChange={handleStatusChange}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
