import { AiStudioTabs } from "./AiStudioTabs";

export default function AiStudioLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-h3 text-fg">AI Studio</h1>
        <p className="text-body-sm text-fg-muted">
          The Autonomous Restaurant Intelligence Platform (Phase 11 Part 3) — specialized agents,
          the Executive Copilot, a knowledge base, workflow automation, a scenario simulator, and
          continuous evaluation/governance. Every irreversible action is drafted for approval here,
          never executed automatically.
        </p>
      </div>
      <AiStudioTabs />
      {children}
    </div>
  );
}
