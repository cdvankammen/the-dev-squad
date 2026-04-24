<todos title="Add model discovery, UI model fetch, and Docker agent support" rule="Review steps frequently throughout the conversation and DO NOT stop between steps unless they explicitly require it.">
- [-] implement-adapter-model-discovery: Implement adapter-level model discovery and wire /api/models to use it 🔴
  _Add discoverModels() optional method to ModelAdapter interface; implement in occ/openclaude/claude adapters by invoking CLI flags or reading env/config; update /api/models to prefer adapter discovery._
- [ ] ui-model-dropdown-fetch: Fetch /api/models in the UI when provider changes and populate model dropdown dynamically 🟡
  _Add effect in src/app/page.tsx and src/app/squad/page.tsx to call GET /api/models?provider= and update the model select options; persist selection in localStorage._
- [ ] docker-agent-image-with-occ-openclaude: Create Docker agent image variant with occ/openclaude and wire DockerRunner option to use it 🟡
  _Add ARG in pipeline/Dockerfile.agent to optionally install occ/openclaude or provide a separate Dockerfile.agent.occ; update pipeline/runner.ts to accept DOCKER_AGENT_IMAGE env override._
</todos>

<!-- Auto-generated todo section -->
<!-- Add your custom Copilot instructions below -->
