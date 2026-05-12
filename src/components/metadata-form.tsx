'use client';

import { useState, useEffect } from 'react';
import type { ProductMetadata, DirtyState, Platform } from '@/lib/types';

interface MetadataFormProps {
  aiData: Partial<ProductMetadata> | null;
  onSubmit: (data: ProductMetadata, platforms: Platform[]) => void;
  isGenerating: boolean;
  hasGenerated: boolean;
}

const initialForm: ProductMetadata = {
  category: '',
  brand: '',
  model: '',
  condition: '',
  price: '',
  suggestedPrice: '',
  notes: '',
};

const initialDirty: DirtyState = {
  category: false,
  brand: false,
  model: false,
  condition: false,
  price: false,
  suggestedPrice: false,
  notes: false,
};

const CATEGORIES = [
  'Electronics',
  'Furniture',
  'Clothing',
  'Books',
  'Sports',
  'Kitchen',
  'Toys',
  'Other',
];

const CONDITIONS = ['Brand New', 'Like New', 'Good', 'Fair', 'Poor'];

const ALL_PLATFORMS: Platform[] = ['Rednote', 'Facebook', 'eBay'];

export function MetadataForm({ aiData, onSubmit, isGenerating, hasGenerated }: MetadataFormProps) {
  const [form, setForm] = useState<ProductMetadata>(initialForm);
  const [dirty, setDirty] = useState<DirtyState>(initialDirty);
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>([
    'Rednote',
    'Facebook',
    'eBay',
  ]);
  const [showSuggested, setShowSuggested] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Sync AI-extracted data to form fields that user hasn't manually edited
  useEffect(() => {
    if (!aiData) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm((prev) => {
      const next = { ...prev };
      const keys = Object.keys(aiData) as (keyof ProductMetadata)[];
      for (const key of keys) {
        if (!dirty[key] && aiData[key] !== undefined) {
          next[key] = aiData[key] as string;
        }
      }
      return next;
    });
  }, [aiData, dirty]);

  function handleChange(field: keyof ProductMetadata, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setDirty((prev) => ({ ...prev, [field]: true }));
    // Clear validation error when user fixes the field
    if (validationError && (field === 'category' || field === 'condition')) {
      setValidationError(null);
    }
  }

  function togglePlatform(platform: Platform) {
    setSelectedPlatforms((prev) => {
      if (prev.includes(platform)) {
        if (prev.length === 1) return prev;
        return prev.filter((p) => p !== platform);
      }
      return [...prev, platform];
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Validate required fields
    if (!form.category) {
      setValidationError('Please select a category');
      return;
    }
    if (!form.condition) {
      setValidationError('Please select a condition');
      return;
    }

    setValidationError(null);
    onSubmit(form, selectedPlatforms);
  }

  const labelClassName = 'block font-mono text-xs uppercase tracking-widest text-gray-500 mb-2';

  return (
    <form onSubmit={handleSubmit}>
      <div className="space-y-6">
        {/* Category */}
        <div>
          <label htmlFor="category" className={labelClassName}>
            CATEGORY
          </label>
          <select
            id="category"
            value={form.category}
            onChange={(e) => handleChange('category', e.target.value)}
            className="w-full cursor-pointer border-0 border-b-2 border-black bg-transparent pb-2 text-sm focus:border-[#E8421A] focus:outline-none"
          >
            <option value="">Select category</option>
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        {/* Brand */}
        <div>
          <label htmlFor="brand" className={labelClassName}>
            BRAND
          </label>
          <input
            id="brand"
            type="text"
            value={form.brand}
            onChange={(e) => handleChange('brand', e.target.value)}
            placeholder="e.g. Sony, Apple, IKEA"
          />
        </div>

        {/* Model */}
        <div>
          <label htmlFor="model" className={labelClassName}>
            MODEL
          </label>
          <input
            id="model"
            type="text"
            value={form.model}
            onChange={(e) => handleChange('model', e.target.value)}
            placeholder="e.g. WH-1000XM5, iPhone 14"
          />
        </div>

        {/* Condition */}
        <div>
          <label htmlFor="condition" className={labelClassName}>
            CONDITION
          </label>
          <select
            id="condition"
            value={form.condition}
            onChange={(e) => handleChange('condition', e.target.value)}
            className="w-full cursor-pointer border-0 border-b-2 border-black bg-transparent pb-2 text-sm focus:border-[#E8421A] focus:outline-none"
          >
            <option value="">Select condition</option>
            {CONDITIONS.map((cond) => (
              <option key={cond} value={cond}>
                {cond}
              </option>
            ))}
          </select>
        </div>

        {/* Price */}
        <div>
          <label htmlFor="price" className={labelClassName}>
            PRICE (AUD)
          </label>
          <input
            id="price"
            type="number"
            value={form.price}
            onChange={(e) => handleChange('price', e.target.value)}
            onFocus={() => setShowSuggested(true)}
            placeholder="Enter your asking price"
            min="0"
            className="text-base font-medium"
          />
          {aiData?.suggestedPrice && showSuggested && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-[10px] tracking-widest uppercase text-gray-400">
                AI Estimate:
              </span>
              <button
                type="button"
                onClick={() => handleChange('price', aiData.suggestedPrice!)}
                className="text-[10px] tracking-widest uppercase text-[#E8421A] border-b border-[#E8421A] hover:opacity-70 transition-opacity"
              >
                Use AUD ${aiData.suggestedPrice} →
              </button>
              <span className="text-[9px] text-gray-300 tracking-widest uppercase">
                Reference only
              </span>
            </div>
          )}
        </div>

        {/* Notes */}
        <div>
          <label htmlFor="notes" className={labelClassName}>
            NOTES
          </label>
          <textarea
            id="notes"
            value={form.notes}
            onChange={(e) => handleChange('notes', e.target.value)}
            className="min-h-[80px] w-full resize-none border-0 border-b-2 border-black bg-transparent pb-2 text-sm focus:border-[#E8421A] focus:outline-none"
            placeholder="Additional details about the item..."
          />
        </div>

        {/* Platform Selection */}
        <div className="border-t border-[#D0CFC9] pt-8">
          <label className={labelClassName}>OUTPUT PLATFORMS</label>
          <div className="flex flex-wrap gap-2">
            {ALL_PLATFORMS.map((platform) => {
              const isSelected = selectedPlatforms.includes(platform);
              return (
                <button
                  key={platform}
                  type="button"
                  onClick={() => togglePlatform(platform)}
                  className={`
                    border px-5 py-2 text-xs uppercase tracking-widest transition-colors duration-200
                    ${
                      isSelected
                        ? 'border-[#E8421A] bg-[#E8421A] text-white'
                        : 'border-[#D0CFC9] bg-transparent text-gray-500 hover:border-black hover:text-black'
                    }
                  `}
                >
                  {platform}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Sticky Generate Button */}
      <div className="-mx-8 mt-8 sticky bottom-0 border-t border-[#D0CFC9] bg-[#F4F4F4] px-8 py-4">
        {validationError && (
          <p className="text-[10px] text-[#E8421A] tracking-widest uppercase mb-2 text-center">
            {validationError}
          </p>
        )}
        {hasGenerated && !isGenerating && !validationError && (
          <p className="text-[10px] text-gray-400 tracking-widest uppercase mb-2 text-center">
            Edit details above to regenerate
          </p>
        )}
        <button
          type="submit"
          disabled={isGenerating || selectedPlatforms.length === 0}
          className={`
            w-full border-2 border-black bg-black py-5 font-mono text-sm uppercase tracking-widest text-white transition-all
            ${
              isGenerating || selectedPlatforms.length === 0
                ? 'cursor-not-allowed opacity-40'
                : 'hover:bg-[#E8421A] hover:border-[#E8421A]'
            }
          `}
        >
          {isGenerating ? (
            <span className="flex items-center justify-center gap-3">
              <span className="flex gap-1">
                <span className="h-2 w-2 animate-pulse bg-white" />
                <span className="h-2 w-2 animate-pulse bg-white" style={{ animationDelay: '150ms' }} />
                <span className="h-2 w-2 animate-pulse bg-white" style={{ animationDelay: '300ms' }} />
              </span>
              GENERATING...
            </span>
          ) : hasGenerated ? (
            'REGENERATE'
          ) : (
            'GENERATE LISTINGS'
          )}
        </button>
      </div>
    </form>
  );
}
