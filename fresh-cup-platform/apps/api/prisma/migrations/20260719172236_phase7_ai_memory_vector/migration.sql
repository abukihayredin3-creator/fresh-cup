-- CreateEnum
CREATE TYPE "AiMemoryKind" AS ENUM ('CONVERSATION', 'DECISION', 'RECOMMENDATION', 'ACCEPTED_SUGGESTION', 'REJECTED_SUGGESTION', 'EXPLANATION');

-- CreateTable
CREATE TABLE "ai_memory_entries" (
    "id" TEXT NOT NULL,
    "kind" "AiMemoryKind" NOT NULL,
    "domain" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "embedding" DOUBLE PRECISION[],
    "branch_id" TEXT,
    "subject_user_id" TEXT,
    "author_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_memory_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vector_entries" (
    "id" TEXT NOT NULL,
    "namespace" TEXT NOT NULL,
    "content" TEXT,
    "metadata" JSONB,
    "embedding" DOUBLE PRECISION[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vector_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_memory_entries_domain_kind_created_at_idx" ON "ai_memory_entries"("domain", "kind", "created_at");

-- CreateIndex
CREATE INDEX "ai_memory_entries_branch_id_created_at_idx" ON "ai_memory_entries"("branch_id", "created_at");

-- CreateIndex
CREATE INDEX "vector_entries_namespace_idx" ON "vector_entries"("namespace");

-- AddForeignKey
ALTER TABLE "ai_memory_entries" ADD CONSTRAINT "ai_memory_entries_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_memory_entries" ADD CONSTRAINT "ai_memory_entries_subject_user_id_fkey" FOREIGN KEY ("subject_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_memory_entries" ADD CONSTRAINT "ai_memory_entries_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
