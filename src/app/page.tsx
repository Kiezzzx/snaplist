'use client';

import { useState } from 'react';
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [platformStatuses, setPlatformStatuses] = useState<Record<Platform, string>>({
    Rednote: 'idle',
    Facebook: 'idle',
    eBay: 'idle',
  });

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
    // Reset statuses to loading for selected platforms
    setPlatformStatuses((prev) => {
      const next = { ...prev };
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
      // Check if all selected platforms are done
      const allDone = selectedPlatforms.every(
        (p) => next[p] === 'success' || next[p] === 'error'
      );
      if (allDone) {
        setIsGenerating(false);
      }
      return next;
    });
  }

  return (
    <div className="bg-grid relative min-h-screen overflow-hidden pb-16">
      {/* Header */}
      <header className="border-b border-[#D0CFC9] px-8 py-5">
        <div className="flex items-end justify-between">
          <div className="flex items-baseline gap-4">
            <h1 className="text-4xl font-black uppercase tracking-tight">SNAP.</h1>
            <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-gray-500">
              AI Listing Generator
            </span>
          </div>
          <span className="text-[9px] uppercase tracking-widest text-gray-300">©2025</span>
        </div>
      </header>

      {/* Main content */}
      <main className="p-8 lg:p-12">
        <div className="grid gap-12 lg:grid-cols-[45%_55%] lg:gap-16">
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
                <span className="text-2xl font-black text-gray-400">01</span>
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
                <span className="text-2xl font-black text-gray-400">02</span>
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
            <div className="flex items-end gap-6 border-b border-[#D0CFC9]">
              {selectedPlatforms.map((platform) => {
                const isActive = activeTab === platform;
                return (
                  <button
                    key={platform}
                    onClick={() => setActiveTab(platform)}
                    className={`
                      px-4 py-3 text-xs uppercase tracking-widest transition-colors
                      ${
                        isActive
                          ? 'border-b-2 border-black text-black font-semibold'
                          : 'border-b-2 border-transparent text-gray-400 hover:text-gray-600'
                      }
                    `}
                  >
                    <span className="mr-2 font-bold">{platformNumbers[platform]}</span>
                    {platform}
                    {isActive && (
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#E8421A] ml-1.5 align-middle" />
                    )}
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
