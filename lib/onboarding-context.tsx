"use client";

import { createContext, useContext, useState, useCallback, useRef, ReactNode } from "react";
import { useRouter } from "next/navigation";

export type OnboardingStep =
  | "welcome"
  | "profile"
  | "create-group"
  | "issue-points"
  | "reclaim-points"
  | "create-quest"
  | "quest-proposals"
  | "invite"
  | "bonus"
  | "analytics"
  | null;

type OnboardingContextType = {
  step: OnboardingStep;
  createdGroupId: string | null;
  start: () => void;          // welcome → profile
  advance: () => void;        // 説明ステップ用
  back: () => void;           // 前のステップへ
  complete: () => Promise<void>;
  skip: () => Promise<void>;
  onGroupCreated: (groupId: string) => void;
  onProfileSaved: () => void;
  onPointsIssued: () => void;
  onQuestCreated: () => void;
  onInviteSent: () => void;
};

const OnboardingContext = createContext<OnboardingContextType | null>(null);

const STEP_ORDER: OnboardingStep[] = [
  "welcome",
  "profile",
  "create-group",
  "issue-points",
  "reclaim-points",
  "create-quest",
  "quest-proposals",
  "invite",
  "bonus",
  "analytics",
  null,
];

export function OnboardingProvider({
  children,
  initialStep,
}: {
  children: ReactNode;
  initialStep: OnboardingStep;
}) {
  const router = useRouter();
  const [step, setStep] = useState<OnboardingStep>(initialStep);
  const [createdGroupId, setCreatedGroupId] = useState<string | null>(null);
  const groupIdRef = useRef<string | null>(null);

  const nextStep = useCallback((current: OnboardingStep): OnboardingStep => {
    const idx = STEP_ORDER.indexOf(current);
    if (idx < 0 || idx >= STEP_ORDER.length - 1) return null;
    return STEP_ORDER[idx + 1];
  }, []);

  const advance = useCallback(() => {
    setStep((cur) => nextStep(cur));
  }, [nextStep]);

  const back = useCallback(() => {
    setStep((cur) => {
      const idx = STEP_ORDER.indexOf(cur);
      if (idx <= 1) return "welcome"; // profile より前には welcome
      return STEP_ORDER[idx - 1];
    });
  }, []);

  const markComplete = useCallback(async () => {
    await fetch("/api/me/onboarding", { method: "POST" });
    setStep(null);
  }, []);

  const start = useCallback(() => {
    setStep("profile");
    router.push("/profile");
  }, [router]);

  const onGroupCreated = useCallback((groupId: string) => {
    groupIdRef.current = groupId;
    setCreatedGroupId(groupId);
    setStep("issue-points");
    router.push(`/groups/${groupId}`);
  }, [router]);

  const onProfileSaved = useCallback(() => {
    setStep("create-group");
  }, []);

  const onPointsIssued = useCallback(() => {
    setStep("reclaim-points");
  }, []);

  const onQuestCreated = useCallback(() => {
    setStep("quest-proposals");
  }, []);

  const onInviteSent = useCallback(() => {
    setStep("bonus");
  }, []);

  return (
    <OnboardingContext.Provider value={{
      step,
      createdGroupId,
      start,
      advance,
      back,
      complete: markComplete,
      skip: markComplete,
      onGroupCreated,
      onProfileSaved,
      onPointsIssued,
      onQuestCreated,
      onInviteSent,
    }}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  return useContext(OnboardingContext);
}
