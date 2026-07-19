"use client";

import { Badge, Button, Card, DataTable, Input, Textarea, useToast } from "@fresh-cup/ui";
import type { AiKnowledgeDocument } from "@fresh-cup/types";
import { useState } from "react";
import {
  useCreateKnowledgeDocument,
  useDeleteKnowledgeDocument,
  useKnowledgeDocuments,
  useSearchKnowledgeBase,
} from "@/lib/use-ai-studio";

export default function AiStudioKnowledgePage() {
  const [query, setQuery] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [content, setContent] = useState("");

  const { data: documents, isLoading } = useKnowledgeDocuments();
  const { data: searchResults } = useSearchKnowledgeBase(query);
  const createDoc = useCreateKnowledgeDocument();
  const deleteDoc = useDeleteKnowledgeDocument();
  const { show: showToast } = useToast();

  const rows = query.length > 0 ? (searchResults ?? []) : (documents ?? []);

  async function handleCreate() {
    if (!title || !category || !content) return;
    try {
      await createDoc.mutateAsync({ title, category, content, sourceFormat: "MARKDOWN" });
      setTitle("");
      setCategory("");
      setContent("");
      showToast({ title: "Knowledge document indexed", tone: "success" });
    } catch {
      showToast({ title: "Could not create document", tone: "error" });
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteDoc.mutateAsync(id);
      showToast({ title: "Document deleted", tone: "success" });
    } catch {
      showToast({ title: "Could not delete document", tone: "error" });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <h2 className="mb-3 font-display text-h5 text-fg">Add a knowledge document</h2>
        <p className="mb-3 text-caption text-fg-muted">
          Policies, recipes, training manuals, food safety, HR, supplier agreements, marketing/
          architecture/API docs — plain text or Markdown. PDF/DOCX/image sources need their text
          extracted before pasting here; this platform doesn&apos;t parse binary formats itself.
        </p>
        <div className="flex flex-col gap-3">
          <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Input
            label="Category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            hint="e.g. food-safety, hr-policy, recipe, architecture"
          />
          <Textarea
            label="Content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={6}
          />
          <Button onClick={handleCreate} loading={createDoc.isPending} className="self-start">
            Add & index
          </Button>
        </div>
      </Card>

      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-h5 text-fg">Knowledge base</h2>
          <Input
            label="Search"
            hideLabel
            placeholder="Hybrid search…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-64"
          />
        </div>
        <DataTable<AiKnowledgeDocument>
          loading={isLoading}
          rows={rows}
          rowKey={(row) => row.id}
          emptyTitle="No knowledge documents yet"
          columns={[
            { key: "title", header: "Title", render: (row) => row.title },
            {
              key: "category",
              header: "Category",
              render: (row) => <Badge>{row.category}</Badge>,
            },
            { key: "format", header: "Source", render: (row) => row.sourceFormat },
            {
              key: "updated",
              header: "Updated",
              render: (row) => new Date(row.updatedAt).toLocaleDateString(),
            },
            {
              key: "actions",
              header: "",
              render: (row) => (
                <Button variant="ghost" onClick={() => handleDelete(row.id)}>
                  Delete
                </Button>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
