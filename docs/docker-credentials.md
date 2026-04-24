Docker agent image, credentials, and examples
===========================================

This document explains how to run the pipeline agent in Docker while allowing it to reach remote model providers like AWS Bedrock and LM Studio (OpenAI-compatible servers).

1) Use a Docker agent image that contains the CLI binaries you need
---------------------------------------------------------------

- There is a default agent image `dev-squad-agent:latest` (see `pipeline/Dockerfile.agent`).
- If you need `occ` or `openclaude` inside the container, build the `pipeline/Dockerfile.agent.occ` variant and set:

```bash
docker build -t dev-squad-agent:occ -f pipeline/Dockerfile.agent.occ pipeline/
export PIPELINE_DOCKER_AGENT_IMAGE=dev-squad-agent:occ
```

2) Passing credentials into the container
----------------------------------------

- Claude/Anthropic (host credential file): If you have a host `~/.claude/.credentials.json`, the runner will mount it into the container automatically when available.
- macOS Keychain: The runner can bootstrap macOS keychain contents into a temp `.claude/.credentials.json` and mount that into the container when present.
- AWS Bedrock: pass your AWS credentials into the container one of these ways:
  - Mount the credentials file: `-v ~/.aws:/root/.aws:ro`
  - Pass environment variables: `-e AWS_ACCESS_KEY_ID -e AWS_SECRET_ACCESS_KEY -e AWS_SESSION_TOKEN`
  - Use Docker secrets for production deploys.

Example running docker with AWS creds mounted:

```bash
docker run --rm -v /Users/you/.aws:/root/.aws:ro -v $PWD:/workspace -w /workspace dev-squad-agent:occ /usr/local/share/npm-global/bin/occ -p "hello"
```

3) LM Studio / OpenAI-compatible endpoints
------------------------------------------

- If LM Studio is running on the host (HTTP server), make it reachable to the agent container:
  - On macOS / Windows: use `host.docker.internal` as the host in `LM_STUDIO_BASE_URL` or `OPENAI_BASE_URL`.
  - On Linux: use `--network host` or expose the port and use the host's IP.

Set environment variables for the runner (examplar):

```bash
export LM_STUDIO_BASE_URL="http://host.docker.internal:8000"
export OPENAI_API_KEY="your-key-if-required"
export PIPELINE_DOCKER_AGENT_IMAGE=dev-squad-agent:occ
```

4) Example script: build image + run orchestrator in Docker
----------------------------------------------------------

```bash
# Build agent with occ/openclaude
docker build -t dev-squad-agent:occ -f pipeline/Dockerfile.agent.occ pipeline/

# Run pipeline orchestrator using the built image (example only)
export PIPELINE_DOCKER_AGENT_IMAGE=dev-squad-agent:occ
export LM_STUDIO_BASE_URL="http://host.docker.internal:8000"
docker run --rm -v $PWD:/workspace -w /workspace -e LM_STUDIO_BASE_URL -e OPENAI_API_KEY dev-squad-agent:occ /bin/sh -c "npx tsx pipeline/orchestrator.ts --project-dir /workspace/some-project"
```

Notes and troubleshooting
-------------------------

- If a provider discovery call (e.g. `occ --list-models`) returns empty, ensure credentials are available inside the environment where discovery runs. CLI tools will not enumerate remote provider models without credentials.
- For LM Studio or other OpenAI-compatible servers, ensure the base URL is the container-visible URL.
- If you see authentication errors inside the container, check `logs/server-errors.log` and the container stderr.
