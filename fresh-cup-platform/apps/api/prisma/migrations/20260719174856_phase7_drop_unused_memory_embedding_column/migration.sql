/*
  Warnings:

  - You are about to drop the column `embedding` on the `ai_memory_entries` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "ai_memory_entries" DROP COLUMN "embedding";
