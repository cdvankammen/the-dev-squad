<todos title="Verify model providers, discovery, logging, and LM Studio/OpenAI integration" rule="Review steps frequently throughout the conversation and DO NOT stop between steps unless they explicitly require it.">
- [-] verify-typescript-compile: Run TypeScript type-check (npx tsc --noEmit -p tsconfig.json) 🔴
- [ ] run-model-discovery-tests: Run scripts/test-models.mjs for providers: occ, openclaude, openai-http 🔴
- [ ] run-chat-logging-test: Run scripts/test-chat-logging.mjs to validate error logging and defensive responses 🔴
- [ ] inspect-server-logs: Inspect logs/server-errors.log for recent errors 🟡
- [ ] verify-api-endpoints: Verify /api/providers and /api/models endpoints (use scripts/test-models or curl) 🔴
- [ ] document-lm-studio-openai-setup: Document how to configure LM Studio or any OpenAI-compatible endpoint and troubleshooting/repair steps 🟡
- [ ] implement-lm-studio-adapter: (Future) Implement a dedicated LM Studio adapter if needed (copy openaiHttpAdapter and adapt) 🟢
</todos>

<!-- Auto-generated todo section -->
<!-- Add your custom Copilot instructions below -->
