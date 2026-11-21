-- Up Migration

-- Cloudflare Workers AI: one credential for t2i (flux-1-schnell) and i2i (flux-2-klein-4b), free plan
-- grants 10,000 neurons a day. The provider CHECK is inline on the column, so Postgres named it
-- model_configs_provider_check; widening it is the only database change the adapter needs.
ALTER TABLE model_configs DROP CONSTRAINT model_configs_provider_check;
ALTER TABLE model_configs ADD CONSTRAINT model_configs_provider_check
  CHECK (provider IN ('mock', 'openai_compat', 'gemini', 'fal', 'cloudflare'));
