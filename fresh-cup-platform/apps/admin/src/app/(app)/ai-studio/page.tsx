"use client";

import { Badge, Button, Card, Select, Textarea, useToast } from "@fresh-cup/ui";
import type { AgentAnswer, CopilotResponse, CoordinatorResult } from "@fresh-cup/types";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useAdminBranches } from "@/lib/use-dashboard";
import { api } from "@/lib/api-client";
import { useAskAgents, useAskCopilot } from "@/lib/use-ai-studio";

function downloadTextFile(filename: string, mimeType: string, content: string): void {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8;` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function confidenceTone(confidence: number): "green" | "orange" | "error" {
  if (confidence >= 0.66) return "green";
  if (confidence >= 0.33) return "orange";
  return "error";
}

function AgentAnswerCard({ answer }: { answer: AgentAnswer }) {
  return (
    <Card className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-display text-h6 text-fg">{answer.agentName}</h3>
        <Badge tone={confidenceTone(answer.confidence)}>
          {Math.round(answer.confidence * 100)}%
        </Badge>
      </div>
      <p className="text-body-sm text-fg-muted">{answer.summary}</p>
      {answer.insights.length > 0 ? (
        <ul className="flex flex-col gap-1 text-caption text-fg-muted">
          {answer.insights.slice(0, 3).map((insight) => (
            <li key={insight.title}>
              <span className="font-medium text-fg">{insight.title}:</span> {insight.explanation}
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}

function CoordinatorResultView({ result }: { result: CoordinatorResult }) {
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="text-body-sm font-medium text-fg">Routed to:</span>
          {result.routedAgents.map((key) => (
            <Badge key={key}>{key}</Badge>
          ))}
          <Badge tone={confidenceTone(result.confidence)}>
            {Math.round(result.confidence * 100)}% overall confidence
          </Badge>
        </div>
        <pre className="whitespace-pre-wrap text-body-sm text-fg">{result.synthesis}</pre>
      </Card>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {result.answers.map((answer) => (
          <AgentAnswerCard key={answer.agentKey} answer={answer} />
        ))}
      </div>
    </div>
  );
}

function CopilotResultView({
  response,
  question,
  branchId,
}: {
  response: CopilotResponse;
  question: string;
  branchId?: string;
}) {
  const { show: showToast } = useToast();

  async function handleExport(kind: "csv" | "briefing" | "slides") {
    try {
      if (kind === "slides") {
        const slides = await api.admin.aiStudio.exportCopilotSlides(question, branchId);
        downloadTextFile(
          `copilot-slides-${response.generatedAt.slice(0, 10)}.json`,
          "application/json",
          JSON.stringify(slides, null, 2),
        );
        return;
      }
      const file =
        kind === "csv"
          ? await api.admin.aiStudio.exportCopilotCsv(question, branchId)
          : await api.admin.aiStudio.exportCopilotBriefing(question, branchId);
      downloadTextFile(file.filename, file.mimeType, file.content);
    } catch {
      showToast({ title: "Export failed", tone: "error" });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display text-h6 text-fg">Reasoning trace</h3>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => handleExport("csv")}>
              Export CSV
            </Button>
            <Button variant="ghost" onClick={() => handleExport("briefing")}>
              Export briefing
            </Button>
            <Button variant="ghost" onClick={() => handleExport("slides")}>
              Export slides
            </Button>
          </div>
        </div>
        <ol className="flex flex-col gap-1.5 text-body-sm text-fg">
          {response.steps.map((step, i) => (
            <li key={step.step}>
              <span className="text-fg-muted">{i + 1}.</span>{" "}
              <span className="font-medium">{step.label}</span> ({step.tookMs}ms) — {step.summary}
            </li>
          ))}
        </ol>
      </Card>

      <Card>
        <h3 className="mb-2 font-display text-h6 text-fg">Explanation</h3>
        <p className="text-body-sm text-fg">{response.explanation}</p>
      </Card>

      {response.decisionReport ? (
        <Card>
          <h3 className="mb-2 font-display text-h6 text-fg">{response.decisionReport.issue}</h3>
          <p className="mb-2 text-body-sm text-fg-muted">
            {response.decisionReport.metric} changed {response.decisionReport.changePercent}%
          </p>
          <ul className="flex flex-col gap-1 text-caption text-fg-muted">
            {response.decisionReport.reasons.map((reason) => (
              <li key={reason.factor}>
                <span className="font-medium text-fg">{reason.factor}:</span> {reason.evidence}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card>
        <h3 className="mb-2 font-display text-h6 text-fg">Recommendations</h3>
        <ul className="flex flex-col gap-2 text-body-sm text-fg">
          {response.recommendations.map((rec) => (
            <li key={rec.action} className="flex items-center justify-between gap-2">
              <span>{rec.action}</span>
              <Badge tone={confidenceTone(rec.confidence)}>
                {rec.expectedImpactEtb
                  ? `+${rec.expectedImpactEtb} ETB`
                  : `${Math.round(rec.confidence * 100)}%`}
              </Badge>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

export default function AiStudioAgentsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const { data: branches } = useAdminBranches(isAdmin);
  const [branchId, setBranchId] = useState<string | undefined>(undefined);
  const [question, setQuestion] = useState("How was this week?");
  const [askedQuestion, setAskedQuestion] = useState<string | null>(null);

  const askAgents = useAskAgents();
  const askCopilot = useAskCopilot();

  function handleAskAgents() {
    setAskedQuestion(question);
    askAgents.mutate({ question, branchId });
  }

  function handleAskCopilot() {
    setAskedQuestion(question);
    askCopilot.mutate({ question, branchId });
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <div className="flex flex-col gap-3">
          {isAdmin && branches && branches.length > 0 ? (
            <Select
              label="Branch"
              value={branchId ?? ""}
              onChange={(e) => setBranchId(e.target.value || undefined)}
              options={branches.map((b) => ({ value: b.id, label: b.name }))}
              placeholder="All branches"
              className="w-56"
            />
          ) : null}
          <Textarea
            label="Ask a question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={2}
          />
          <div className="flex gap-2">
            <Button onClick={handleAskAgents} loading={askAgents.isPending}>
              Ask specialized agents
            </Button>
            <Button variant="secondary" onClick={handleAskCopilot} loading={askCopilot.isPending}>
              Ask Executive Copilot
            </Button>
          </div>
        </div>
      </Card>

      {askAgents.data ? <CoordinatorResultView result={askAgents.data} /> : null}
      {askCopilot.data ? (
        <CopilotResultView
          response={askCopilot.data}
          question={askedQuestion ?? question}
          branchId={branchId}
        />
      ) : null}
    </div>
  );
}
