"use client";

import type { AiAssistantResponse } from "@fresh-cup/types";
import { Badge, Button, Card, Textarea } from "@fresh-cup/ui";
import { useState } from "react";
import { useAskAssistant } from "@/lib/use-intelligence";

interface Turn {
  question: string;
  response: AiAssistantResponse;
}

const SAMPLE_QUESTIONS = [
  "How were sales yesterday?",
  "Which products are underperforming?",
  "What should we reorder?",
  "Show my busiest hours.",
  "Which customers are at risk of churn?",
];

const OUTCOME_TONE: Record<AiAssistantResponse["outcome"], "green" | "orange" | "error"> = {
  ANSWERED: "green",
  FALLBACK: "orange",
  ERROR: "error",
};

export default function AiAssistantPage() {
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const ask = useAskAssistant();

  async function submit(q: string) {
    const trimmed = q.trim();
    if (!trimmed || ask.isPending) return;
    const response = await ask.mutateAsync({ question: trimmed });
    setTurns((prev) => [...prev, { question: trimmed, response }]);
    setQuestion("");
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <p className="mb-3 text-body-sm text-fg-muted">
          Ask about sales, inventory, customers, or forecasts. Every answer is grounded in a tool
          call against real data — expand &quot;Data used&quot; below an answer to see exactly what
          was queried.
        </p>
        <div className="mb-4 flex flex-wrap gap-2">
          {SAMPLE_QUESTIONS.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => void submit(q)}
              disabled={ask.isPending}
              className="rounded-pill border border-border px-3 py-1 text-caption text-fg hover:bg-surface-alt disabled:opacity-50"
            >
              {q}
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit(question);
          }}
          className="flex flex-col gap-3"
        >
          <Textarea
            label="Ask the assistant"
            hideLabel
            placeholder="e.g. How were sales yesterday?"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={2}
          />
          <div>
            <Button type="submit" loading={ask.isPending} disabled={!question.trim()}>
              Ask
            </Button>
          </div>
        </form>
      </Card>

      <div className="flex flex-col gap-4">
        {turns
          .slice()
          .reverse()
          .map((turn, index) => (
            <Card key={turns.length - index}>
              <p className="mb-2 font-medium text-fg">{turn.question}</p>
              <div className="mb-2 flex items-center gap-2">
                <Badge tone={OUTCOME_TONE[turn.response.outcome]}>{turn.response.outcome}</Badge>
              </div>
              <p className="whitespace-pre-wrap text-body-sm text-fg">{turn.response.answer}</p>
              {turn.response.toolCalls.length > 0 ? (
                <details className="mt-3">
                  <summary className="cursor-pointer text-caption text-fg-muted">
                    Data used ({turn.response.toolCalls.length} tool call
                    {turn.response.toolCalls.length === 1 ? "" : "s"})
                  </summary>
                  <div className="mt-2 flex flex-col gap-2">
                    {turn.response.toolCalls.map((call, callIndex) => (
                      <pre
                        key={callIndex}
                        className="overflow-x-auto rounded bg-surface-alt p-3 text-caption text-fg"
                      >
                        {call.tool}
                        {"\n"}
                        {JSON.stringify(call.result, null, 2)}
                      </pre>
                    ))}
                  </div>
                </details>
              ) : null}
            </Card>
          ))}
      </div>
    </div>
  );
}
