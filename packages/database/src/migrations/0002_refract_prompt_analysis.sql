-- Migration: Add Refract prompt analysis columns and Google provider support
-- This migration adds columns for prompt categorization, model-fit analysis,
-- and proxy source tracking.

-- Add new columns for prompt analysis
ALTER TABLE "traces" ADD COLUMN IF NOT EXISTS "prompt_category" varchar(50);
ALTER TABLE "traces" ADD COLUMN IF NOT EXISTS "prompt_complexity" varchar(20);
ALTER TABLE "traces" ADD COLUMN IF NOT EXISTS "model_fit" varchar(30);
ALTER TABLE "traces" ADD COLUMN IF NOT EXISTS "model_fit_reason" text;
ALTER TABLE "traces" ADD COLUMN IF NOT EXISTS "suggested_model" varchar(255);
ALTER TABLE "traces" ADD COLUMN IF NOT EXISTS "source" varchar(20) DEFAULT 'sdk';
ALTER TABLE "traces" ADD COLUMN IF NOT EXISTS "prompt_efficiency" double precision;
ALTER TABLE "traces" ADD COLUMN IF NOT EXISTS "analyzed_at" timestamp with time zone;

-- Add indexes for new columns
CREATE INDEX IF NOT EXISTS "idx_prompt_category" ON "traces" ("prompt_category");
CREATE INDEX IF NOT EXISTS "idx_source" ON "traces" ("source");
CREATE INDEX IF NOT EXISTS "idx_model_fit" ON "traces" ("model_fit");

-- Update provider CHECK constraint to include 'google' for Gemini
ALTER TABLE "traces" DROP CONSTRAINT IF EXISTS "traces_provider_check";
ALTER TABLE "traces" ADD CONSTRAINT "traces_provider_check" CHECK ("provider" IN ('openai', 'anthropic', 'google', 'cohere', 'other'));
