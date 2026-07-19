import { useState, useRef, useEffect, useCallback } from 'react';
import { markListingAsGenerated, updateListingMetadata } from '@/lib/actions/listings';
import type { ProductMetadata } from '@/lib/types';
import { PLATFORMS, type Platform } from '@/lib/platforms';

// Parent-level generation orchestration, extracted from app/page.tsx.
//
// STATE ISOLATION (ECL hard constraint #7): per-platform SSE state — the live
// `content` and `isLoading` of each stream — stays locked inside its own
// <ListingEditor>. This hook never touches stream content; it only coordinates
// across editors: it owns the triggerId that tells editors to (re)start, the
// aggregate status map, the all-done detection, and the single row-lifecycle
// write. Editors report up via onStatusChange; nothing streams down.

function idleStatuses(): Record<Platform, string> {
  return Object.fromEntries(PLATFORMS.map((p) => [p, 'idle'])) as Record<Platform, string>;
}

export interface UseListingGenerationResult {
  /** Bumped on each generate; passed to each editor to (re)start its stream. */
  triggerId: number;
  /** Aggregate per-platform lifecycle: 'idle' | 'loading' | 'success' | 'error'. */
  platformStatuses: Record<Platform, string>;
  /** Platforms chosen for the current run (drives tabs + which editors fire). */
  selectedPlatforms: Platform[];
  /** Metadata snapshot the editors generate from for the current run. */
  targetMetadata: ProductMetadata | null;
  isGenerating: boolean;
  hasGenerated: boolean;
  /** Every selected platform has settled (success or error). */
  allComplete: boolean;
  /** Persist reviewed metadata, then bump triggerId to start all editors. */
  startGeneration: (metadata: ProductMetadata, platforms: Platform[]) => void;
  /** Callback each editor invokes as its stream transitions state. */
  handleStatusChange: (platform: Platform, status: string) => void;
}

export function useListingGeneration(dbId: string | null): UseListingGenerationResult {
  const [triggerId, setTriggerId] = useState(0);
  const [platformStatuses, setPlatformStatuses] =
    useState<Record<Platform, string>>(idleStatuses);
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>([...PLATFORMS]);
  const [targetMetadata, setTargetMetadata] = useState<ProductMetadata | null>(null);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

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
    generateTriggerIdRef.current = triggerId;
  }, [triggerId]);

  const startGeneration = useCallback(
    (metadata: ProductMetadata, platforms: Platform[]) => {
      setTargetMetadata(metadata);
      setSelectedPlatforms(platforms);
      // Persist the reviewed metadata onto the row so the dashboard reflects the
      // user's edits (e.g. corrected condition), not the AI's extraction-time
      // values. Fire-and-forget: it writes only the metadata column, so it can't
      // race the generate path's generatedCopies/status writes.
      const id = dbIdRef.current;
      if (id) {
        updateListingMetadata(id, metadata).catch((err) => {
          console.error('Failed to persist edited metadata:', err);
        });
      }
      // Bumping triggerId is the abort signal: each editor's triggerId effect
      // calls stop() on the previous stream before starting the new one.
      setTriggerId(Date.now());
      // Reset the mark-once guard so the new run can fire markListingAsGenerated.
      markedTriggerRef.current = 0;
      setHasGenerated(true);
      setIsGenerating(true);
      // Selected platforms -> loading; unselected -> idle so all-done check
      // can't be blocked by a stale 'loading' from a previous generation.
      setPlatformStatuses(() => {
        const next = idleStatuses();
        for (const p of platforms) {
          next[p] = 'loading';
        }
        return next;
      });
    },
    [],
  );

  const handleStatusChange = useCallback((platform: Platform, status: string) => {
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
  }, []);

  const allComplete =
    hasGenerated &&
    selectedPlatforms.every(
      (p) => platformStatuses[p] === 'success' || platformStatuses[p] === 'error'
    );

  return {
    triggerId,
    platformStatuses,
    selectedPlatforms,
    targetMetadata,
    isGenerating,
    hasGenerated,
    allComplete,
    startGeneration,
    handleStatusChange,
  };
}
