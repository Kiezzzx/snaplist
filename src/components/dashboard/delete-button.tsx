'use client';

import { useTransition, type MouseEvent } from 'react';
import { deleteListing } from '@/lib/actions/listings';

export function DashboardDeleteButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();

  function handleClick(e: MouseEvent<HTMLButtonElement>) {
    // The button is nested inside the row's <Link>. Without preventDefault the
    // ancestor <a> would navigate to the detail page on click; without
    // stopPropagation the same click could fire a Link-level handler before
    // ours. Both are needed to keep Delete from leaving the dashboard.
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm('Delete this listing? This cannot be undone.')) return;
    startTransition(async () => {
      await deleteListing(id);
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      aria-label={isPending ? 'Deleting listing' : 'Delete listing'}
      className={`
        inline-flex min-h-11 min-w-11 items-center justify-center px-3
        font-mono text-[10px] uppercase tracking-widest transition-colors
        focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E8421A]
        ${
          isPending
            ? 'cursor-not-allowed text-gray-300'
            : 'cursor-pointer text-gray-400 hover:text-[#E8421A]'
        }
      `}
    >
      {isPending ? 'Deleting…' : 'Delete'}
    </button>
  );
}
