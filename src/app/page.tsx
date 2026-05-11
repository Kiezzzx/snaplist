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

  async function onImageProcessed(base64: string) {
    setIsExtracting(true);
    setExtractError(null);
    try {
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64 }),
      });
      if (res.status === 413) {
        setExtractError('Image too large. Please try a smaller image.');
        return;
      }
      if (!res.ok) throw new Error('Extract failed');
      const json = (await res.json()) as { success: boolean; data?: Partial<ProductMetadata>; error?: string };
      if (json.success) {
        setAiData(json.data ?? null);
      } else {
        setExtractError(json.error ?? 'Failed to extract data');
      }
    } catch {
      setExtractError('Network error. Please try again.');
    } finally {
      setIsExtracting(false);
    }
  }

  function onSubmit(metadata: ProductMetadata, platforms: Platform[]) {
    setTargetMetadata(metadata);
    setSelectedPlatforms(platforms);
    setGenerateTriggerId(Date.now());
    setActiveTab(platforms[0]);
  }

  function handleStatusChange(platform: Platform, status: string) {
    console.log(`${platform}: ${status}`);
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Decorative floating circles */}
      <div className="pointer-events-none absolute -right-20 -top-20 h-96 w-96 rounded-full bg-gray-200/30" />
      <div className="pointer-events-none absolute bottom-40 left-1/2 h-64 w-64 rounded-full bg-gray-200/20" />
      <div className="pointer-events-none absolute right-1/4 top-1/2 h-48 w-48 rounded-full bg-gray-300/20" />

      {/* Vertical text label */}
      <div className="pointer-events-none fixed right-0 top-1/2 -translate-y-1/2 -rotate-90 whitespace-nowrap pr-2 text-[9px] uppercase tracking-[0.4em] text-gray-300">
        SNAPLIST // AI LISTING GENERATOR ©2025
      </div>

      {/* Navbar */}
      <nav className="border-b border-[#D0CFC9] px-8 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-4xl font-black" style={{ letterSpacing: '-0.05em' }}>snap.</h1>
          <span className="text-[10px] uppercase tracking-[0.3em] text-gray-400">
            AI LISTING GENERATOR
          </span>
        </div>
      </nav>

      {/* Main content */}
      <main className="p-8">
        <div className="grid gap-16 md:grid-cols-[40%_60%]">
          {/* Left column */}
          <div className="space-y-8 border-r border-[#D0CFC9] pr-16">
            <div>
              <p className="mb-4 text-[10px] uppercase tracking-[0.3em] text-gray-400">— 01</p>
              <UploadZone
                onImageProcessed={onImageProcessed}
                isExtracting={isExtracting}
              />
            </div>

            {extractError && (
              <div className="border-l-2 border-[#E8421A] py-2 pl-4">
                <p className="text-[10px] uppercase tracking-[0.2em] text-[#E8421A]">{extractError}</p>
              </div>
            )}

            <div className="border-t border-[#D0CFC9] pt-12">
              <p className="mb-6 mt-2 text-[10px] uppercase tracking-[0.3em] text-gray-400">— 02</p>
              <MetadataForm
                aiData={aiData}
                onSubmit={onSubmit}
                isGenerating={generateTriggerId > 0}
              />
            </div>
          </div>

          {/* Right column */}
          <div className="relative space-y-6">
            <p className="text-[10px] uppercase tracking-[0.3em] text-gray-400">— 03</p>

            {/* Platform tabs */}
            <div className="flex gap-8 border-b border-[#D0CFC9]">
              {selectedPlatforms.map((platform) => (
                <button
                  key={platform}
                  onClick={() => setActiveTab(platform)}
                  className={`
                    pb-3 text-[10px] uppercase tracking-[0.3em] transition-colors
                    ${
                      activeTab === platform
                        ? 'border-b-2 border-black font-medium text-black'
                        : 'text-gray-400 hover:text-gray-600'
                    }
                  `}
                >
                  {platformNumbers[platform]} {platform}
                </button>
              ))}
            </div>

            {/* Generated copy label */}
            <p className="text-[10px] uppercase tracking-[0.3em] text-gray-400">— GENERATED COPY</p>

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
