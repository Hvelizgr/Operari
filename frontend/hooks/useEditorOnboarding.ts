import type { WorkflowNode } from '@operari/shared';
import { useCallback, useEffect, useState } from 'react';

import { ONBOARDING_STEPS_EN, ONBOARDING_STEPS_ES } from '../components/Common';
import { storageRead, storageWrite } from '../lib/storage-compat';

const STORAGE_KEY = 'operari-onboarding-seen';

/**
 * First-run onboarding flow for the editor.
 *
 * Shows the step-through overlay when the user lands on a workflow
 * that has nodes AND the `operari-onboarding-seen` localStorage flag
 * is not set. Once the user finishes, skips, or closes the overlay,
 * the flag is set so the flow never triggers again on this device.
 *
 * Lives outside `useEditorCanvas` because none of its state leaks into
 * the canvas's drag/selection/pan arbitration — the flow is a pure
 * overlay. Keeping it here also makes it the single place to change
 * the trigger heuristic if we ever want to show it conditionally
 * (e.g. only on a user's first runbook, not on every new canvas).
 */
export function useEditorOnboarding(nodes: WorkflowNode[], lang: 'en' | 'es') {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);

  // Fires once per mount when the first node appears. Guarding on
  // `nodes.length > 0` avoids the flash on an empty canvas where
  // the user clearly knows to drag a node in.
  useEffect(() => {
    const hasSeenOnboarding = storageRead(STORAGE_KEY);
    if (!hasSeenOnboarding && nodes.length > 0) {
      setShowOnboarding(true);
    }
  }, [nodes.length]);

  const dismiss = useCallback(() => {
    setShowOnboarding(false);
    try {
      storageWrite(STORAGE_KEY, 'true');
    } catch {
      /* noop — localStorage blocked */
    }
  }, []);

  const handleOnboardingNext = useCallback(() => {
    const steps = lang === 'es' ? ONBOARDING_STEPS_ES : ONBOARDING_STEPS_EN;
    if (onboardingStep < steps.length - 1) {
      setOnboardingStep(prev => prev + 1);
    } else {
      dismiss();
    }
  }, [onboardingStep, lang, dismiss]);

  return {
    showOnboarding,
    onboardingStep,
    handleOnboardingNext,
    handleOnboardingSkip: dismiss,
    handleOnboardingClose: dismiss,
  };
}
