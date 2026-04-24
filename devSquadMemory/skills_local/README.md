Local skill mirror
==================

This folder is intended as a safe, local mirror of selected SKILL packages from
your `workgithub/skills-unified` collection. It is NOT authoritative — prefer
to maintain the canonical skill source in your `workgithub` repo and use this
folder for staging and local testing.

To populate this folder from your local skills repo run:

```bash
./devSquadMemory/scripts/copy_local_skills.sh
```

The script will attempt to copy the following skills (if present):

- rag-implementer
- langchain-dependencies
- claude-peers-mcp
- openclaw-control-center

Review SKILL.md contents before installing into OpenClaw or Claude.
