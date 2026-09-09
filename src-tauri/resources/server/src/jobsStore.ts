import { randomUUID } from "node:crypto";
import type { Product } from "@scrapelium/core";

export type JobStatus = "pending" | "running" | "done" | "error";

export interface ScrapeJob {
  id: string;
  status: JobStatus;
  source?: "sitemap" | "crawl";
  pagesVisited?: number;
  products?: Product[];
  error?: string;
}

const jobs = new Map<string, ScrapeJob>();

export function createJob(): ScrapeJob {
  const job: ScrapeJob = { id: randomUUID(), status: "pending" };
  jobs.set(job.id, job);
  return job;
}

export function getJob(id: string): ScrapeJob | undefined {
  return jobs.get(id);
}

export function updateJob(id: string, patch: Partial<ScrapeJob>): void {
  const job = jobs.get(id);
  if (job) Object.assign(job, patch);
}
