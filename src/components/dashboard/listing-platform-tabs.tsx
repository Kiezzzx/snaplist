'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import type { GeneratedCopies } from '@/lib/db/schema';

type Platform = 'Rednote' | 'Facebook' | 'eBay';

const platformOrder: Platform[] = ['Rednote', 'Facebook', 'eBay'];

const platformNumbers: Record<Platform, string> = {
  Rednote: '01',
  Facebook: '02',
  eBay: '03',
};

const platformLabels: Record<Platform, string> = {
  Rednote: 'Rednote',
  Facebook: 'Facebook',
  eBay: 'eBay',
};

interface ListingPlatformTabsProps {
  copies: GeneratedCopies | null;
}

export function ListingPlatformTabs({ copies }: ListingPlatformTabsProps) {
  const [activeTab, setActiveTab] = useState<Platform>('Rednote');
  // Track copied state per platform so toggling tabs doesn't visually reset
  // the "Copied!" confirmation on a tab the user just acted on.
  const [copiedPlatform, setCopiedPlatform] = useState<Platform | null>(null);

  const activeContent = copies?.[activeTab]?.content ?? '';
  const hasContent = activeContent.length > 0;

  async function handleCopy() {
    if (!hasContent) return;
    await navigator.clipboard.writeText(activeContent);
    setCopiedPlatform(activeTab);
    setTimeout(() => {
      setCopiedPlatform((prev) => (prev === activeTab ? null : prev));
    }, 2000);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-[#D0CFC9] pb-2">
        <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-gray-600">
          Output
        </span>
        <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-gray-500">
          Generated Copy
        </span>
      </div>

      <div className="flex items-end gap-2 md:gap-6 border-b border-[#D0CFC9] overflow-x-auto scrollbar-none -mx-4 px-4 md:mx-0 md:px-0">
        {platformOrder.map((platform) => {
          const isActive = activeTab === platform;
          const platformHasContent = (copies?.[platform]?.content ?? '').length > 0;
          return (
            <button
              key={platform}
              type="button"
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
              {platformLabels[platform]}
              {platformHasContent ? (
                <Check
                  className="ml-1.5 inline-block h-3 w-3 align-middle text-green-600"
                  aria-label={`${platform}: generated`}
                />
              ) : (
                <span
                  className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-gray-300 align-middle"
                  aria-label={`${platform}: not generated`}
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="border-t border-[#D0CFC9] pt-6">
        <div className="mb-6 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl font-black text-gray-200">
              {platformNumbers[activeTab]}
            </span>
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-gray-400">
                Platform
              </p>
              <p className="text-base font-bold uppercase tracking-tight">
                {platformLabels[activeTab]}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCopy}
            disabled={!hasContent}
            className={`
              border px-4 py-2 font-mono text-[10px] uppercase tracking-widest transition-colors
              ${
                !hasContent
                  ? 'cursor-not-allowed border-gray-200 text-gray-300'
                  : copiedPlatform === activeTab
                    ? 'border-[#E8421A] bg-[#E8421A] text-white'
                    : 'border-gray-300 bg-transparent text-gray-600 hover:border-black hover:text-black'
              }
            `}
          >
            {copiedPlatform === activeTab ? 'Copied!' : 'Copy'}
          </button>
        </div>

        {hasContent ? (
          <div>
            <p className="whitespace-pre-wrap wrap-break-word font-mono text-sm leading-relaxed text-black">
              {activeContent}
            </p>
            <div className="mt-6 flex items-center gap-2 border-t border-[#D0CFC9] pt-4">
              <div className="h-2 w-2 bg-green-500" />
              <span className="font-mono text-[8px] uppercase tracking-[0.2em] text-gray-400">
                {activeContent.length} characters
              </span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center min-h-60 text-center px-12">
            <div className="w-16 h-px bg-[#D0CFC9] mb-8" />
            <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-3">
              Not Generated
            </p>
            <p className="text-xs text-gray-300 leading-relaxed max-w-50">
              No copy has been generated for this platform yet.
            </p>
            <div className="w-16 h-px bg-[#D0CFC9] mt-8" />
          </div>
        )}
      </div>
    </div>
  );
}
