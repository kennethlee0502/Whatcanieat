import { z } from "zod";

export const domainIdentifierSchema = z.string().trim().min(1).max(100);
export const shortTextSchema = z.string().trim().min(1).max(240);
export const evidenceIdsSchema = z.array(domainIdentifierSchema).max(20);
export const confidenceLevelSchema = z.enum(["high", "medium", "low"]);
