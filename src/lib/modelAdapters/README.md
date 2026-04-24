ModelAdapters
================

Purpose
-------
Small collection of ModelAdapter stubs to make it easy to add new model backends
(Claude CLI, OpenAI HTTP, Ollama, etc.) without changing the rest of the pipeline.

Integration
-----------
- Implement the ModelAdapter interface in a new file and export a factory that
  returns an adapter instance for the requested provider.
- Update `pipeline/runner.ts` to call the adapter factory instead of calling
  the `claude` CLI directly (a warning hook was added already).

Notes
-----
- These are stubs: they intentionally do not perform network installs or run
  processes that contact external services. Use them as a starting point and
  implement concrete adapters as needed.
