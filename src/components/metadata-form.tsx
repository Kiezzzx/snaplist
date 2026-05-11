'use client';

import { useState, useEffect } from 'react';
import type { ProductMetadata, DirtyState, Platform } from '@/lib/types';

interface MetadataFormProps {
  aiData: Partial<ProductMetadata> | null;
  onSubmit: (data: ProductMetadata, platforms: Platform[]) => void;
  isGenerating: boolean;
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

const CONDITIONS = ['Like New', 'Good', 'Fair', 'Poor'];

const ALL_PLATFORMS: Platform[] = ['Rednote', 'Facebook', 'eBay'];

export function MetadataForm({ aiData, onSubmit, isGenerating }: MetadataFormProps) {
  const [form, setForm] = useState<ProductMetadata>(initialForm);
  const [dirty, setDirty] = useState<DirtyState>(initialDirty);
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>([
    'Rednote',
    'Facebook',
    'eBay',
  ]);

  useEffect(() => {
    if (!aiData) return;
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
    onSubmit(form, selectedPlatforms);
  }

  const inputClassName =
    'w-full border-0 border-b border-[#D0CFC9] bg-transparent pb-2 text-sm focus:border-[#0A0A0A] focus:outline-none';
  const labelClassName = 'block text-[10px] uppercase tracking-[0.2em] text-gray-400 mb-2';

  return (
    <form onSubmit={handleSubmit}>
      <p className="mb-6 mt-2 text-[10px] uppercase tracking-[0.2em] text-gray-400">— ITEM DETAILS</p>

      <div className="mb-8">
        <label htmlFor="category" className={labelClassName}>
          Category
        </label>
        <select
          id="category"
          value={form.category}
          onChange={(e) => handleChange('category', e.target.value)}
          className={inputClassName}
        >
          <option value="">Select category</option>
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-8">
        <label htmlFor="brand" className={labelClassName}>
          Brand
        </label>
        <input
          id="brand"
          type="text"
          value={form.brand}
          onChange={(e) => handleChange('brand', e.target.value)}
          className={inputClassName}
          placeholder="e.g., Sony, Apple, IKEA"
        />
      </div>

      <div className="mb-8">
        <label htmlFor="model" className={labelClassName}>
          Model
        </label>
        <input
          id="model"
          type="text"
          value={form.model}
          onChange={(e) => handleChange('model', e.target.value)}
          className={inputClassName}
          placeholder="e.g., WH-1000XM5, iPhone 14"
        />
      </div>

      <div className="mb-8">
        <label htmlFor="condition" className={labelClassName}>
          Condition
        </label>
        <select
          id="condition"
          value={form.condition}
          onChange={(e) => handleChange('condition', e.target.value)}
          className={inputClassName}
        >
          <option value="">Select condition</option>
          {CONDITIONS.map((cond) => (
            <option key={cond} value={cond}>
              {cond}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-8">
        <label htmlFor="price" className={labelClassName}>
          Price (AUD)
        </label>
        <input
          id="price"
          type="number"
          value={form.price}
          onChange={(e) => handleChange('price', e.target.value)}
          className={inputClassName}
          placeholder="Enter your asking price"
          min="0"
        />
        {aiData?.suggestedPrice && (
          <p className="mt-2 border-l-2 border-amber-400 py-1 pl-3 text-[10px] uppercase tracking-[0.15em] text-amber-600">
            AI SUGGESTED: AUD ${aiData.suggestedPrice} — REFERENCE ONLY
          </p>
        )}
      </div>

      <div className="mb-8">
        <label htmlFor="notes" className={labelClassName}>
          Notes
        </label>
        <textarea
          id="notes"
          value={form.notes}
          onChange={(e) => handleChange('notes', e.target.value)}
          className={`${inputClassName} resize-none`}
          rows={3}
          placeholder="Additional details about the item..."
        />
      </div>

      <div className="mb-8 border-t border-[#D0CFC9] pt-8">
        <label className={labelClassName}>Platforms</label>
        <div className="flex gap-2">
          {ALL_PLATFORMS.map((platform) => {
            const isSelected = selectedPlatforms.includes(platform);
            return (
              <button
                key={platform}
                type="button"
                onClick={() => togglePlatform(platform)}
                className={`
                  border px-4 py-2 text-[10px] uppercase tracking-[0.2em] transition-colors
                  ${
                    isSelected
                      ? 'border-[#E8421A] bg-[#E8421A] text-white'
                      : 'border-[#D0CFC9] bg-transparent text-gray-400 hover:border-black hover:text-black'
                  }
                `}
              >
                {platform}
              </button>
            );
          })}
        </div>
      </div>

      <button
        type="submit"
        disabled={isGenerating || selectedPlatforms.length === 0}
        className={`
          w-full bg-[#E8421A] py-5 text-sm font-medium uppercase tracking-[0.2em] text-white transition-colors duration-300
          ${
            isGenerating || selectedPlatforms.length === 0
              ? 'cursor-not-allowed opacity-30'
              : 'hover:bg-black'
          }
        `}
      >
        {isGenerating ? (
          <span className="flex items-center justify-center gap-3">
            <span className="h-4 w-4 animate-spin border-2 border-white border-t-transparent" />
            GENERATING...
          </span>
        ) : (
          'GENERATE LISTINGS'
        )}
      </button>
    </form>
  );
}
