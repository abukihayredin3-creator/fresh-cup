import { Injectable } from "@nestjs/common";
import { hashDataset } from "../training/dataset-hash.util";
import { DOMAIN_SYSTEM_PROMPTS, type AiDomain } from "../prompts/system-prompts";

export interface PromptRecord {
  domain: AiDomain;
  prompt: string;
  fingerprint: string;
}

/**
 * AI Governance's prompt history (Phase 11 Part 3) — this platform's
 * system prompts are static TypeScript (`prompts/system-prompts.ts`), not
 * rows in an editable prompt CMS, so "prompt history" here means "what is
 * every domain's prompt right now, and a fingerprint that changes the
 * moment the code does" rather than a live version-diff UI backed by a
 * database this platform doesn't have a schema for. `fingerprint` is the
 * same FNV-1a hash Part 2's dataset lineage uses — deterministic,
 * dependency-free, and enough to notice a prompt changed between two
 * deploys without storing full prompt text twice.
 */
@Injectable()
export class PromptRegistryService {
  list(): PromptRecord[] {
    return (Object.keys(DOMAIN_SYSTEM_PROMPTS) as AiDomain[]).map((domain) => {
      const prompt = DOMAIN_SYSTEM_PROMPTS[domain];
      return { domain, prompt, fingerprint: hashDataset(prompt) };
    });
  }
}
