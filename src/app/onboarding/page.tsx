import { hasGoogle } from "@/lib/env";
import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";

export const dynamic = "force-dynamic";

export default function OnboardingPage() {
  return (
    <main className="min-h-screen bg-white text-neutral-900">
      <OnboardingFlow calendarConfigured={hasGoogle()} />
    </main>
  );
}
