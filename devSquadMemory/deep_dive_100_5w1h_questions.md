# 100 deep-dive 5W1H question sets (provider + pipeline architecture)

Generated: 2026-04-24

Each item includes Where / What / Why / When / How to force architecture-quality review.

## 1. Manual provider selection state in usePipelineState — Normal execution path

- **Where** is the authoritative implementation for **manual provider selection state in usepipelinestate** in the **normal execution path**, and where can it diverge from UI state?
- **What** exact inputs/outputs, side effects, and invariants are expected for **manual provider selection state in usepipelinestate** during the **normal execution path**?
- **Why** was this behavior chosen instead of alternate designs, and why is it safe/unsafe for provider portability in the **normal execution path**?
- **When** does this path execute, retry, short-circuit, or fail for **manual provider selection state in usepipelinestate**, and when should fallback happen in the **normal execution path**?
- **How** is this path verified today (tests/logs/telemetry), and how will regressions be detected for **manual provider selection state in usepipelinestate** in the **normal execution path**?

## 2. Manual provider selection state in usePipelineState — Session resume path

- **Where** is the authoritative implementation for **manual provider selection state in usepipelinestate** in the **session resume path**, and where can it diverge from UI state?
- **What** exact inputs/outputs, side effects, and invariants are expected for **manual provider selection state in usepipelinestate** during the **session resume path**?
- **Why** was this behavior chosen instead of alternate designs, and why is it safe/unsafe for provider portability in the **session resume path**?
- **When** does this path execute, retry, short-circuit, or fail for **manual provider selection state in usepipelinestate**, and when should fallback happen in the **session resume path**?
- **How** is this path verified today (tests/logs/telemetry), and how will regressions be detected for **manual provider selection state in usepipelinestate** in the **session resume path**?

## 3. Manual provider selection state in usePipelineState — Discovery empty/fallback path

- **Where** is the authoritative implementation for **manual provider selection state in usepipelinestate** in the **discovery empty/fallback path**, and where can it diverge from UI state?
- **What** exact inputs/outputs, side effects, and invariants are expected for **manual provider selection state in usepipelinestate** during the **discovery empty/fallback path**?
- **Why** was this behavior chosen instead of alternate designs, and why is it safe/unsafe for provider portability in the **discovery empty/fallback path**?
- **When** does this path execute, retry, short-circuit, or fail for **manual provider selection state in usepipelinestate**, and when should fallback happen in the **discovery empty/fallback path**?
- **How** is this path verified today (tests/logs/telemetry), and how will regressions be detected for **manual provider selection state in usepipelinestate** in the **discovery empty/fallback path**?

## 4. Manual provider selection state in usePipelineState — Provider error path

- **Where** is the authoritative implementation for **manual provider selection state in usepipelinestate** in the **provider error path**, and where can it diverge from UI state?
- **What** exact inputs/outputs, side effects, and invariants are expected for **manual provider selection state in usepipelinestate** during the **provider error path**?
- **Why** was this behavior chosen instead of alternate designs, and why is it safe/unsafe for provider portability in the **provider error path**?
- **When** does this path execute, retry, short-circuit, or fail for **manual provider selection state in usepipelinestate**, and when should fallback happen in the **provider error path**?
- **How** is this path verified today (tests/logs/telemetry), and how will regressions be detected for **manual provider selection state in usepipelinestate** in the **provider error path**?

## 5. Manual provider selection state in usePipelineState — Observability and diagnostics path

- **Where** is the authoritative implementation for **manual provider selection state in usepipelinestate** in the **observability and diagnostics path**, and where can it diverge from UI state?
- **What** exact inputs/outputs, side effects, and invariants are expected for **manual provider selection state in usepipelinestate** during the **observability and diagnostics path**?
- **Why** was this behavior chosen instead of alternate designs, and why is it safe/unsafe for provider portability in the **observability and diagnostics path**?
- **When** does this path execute, retry, short-circuit, or fail for **manual provider selection state in usepipelinestate**, and when should fallback happen in the **observability and diagnostics path**?
- **How** is this path verified today (tests/logs/telemetry), and how will regressions be detected for **manual provider selection state in usepipelinestate** in the **observability and diagnostics path**?

## 6. Manual model selection state in the page components — Normal execution path

- **Where** is the authoritative implementation for **manual model selection state in the page components** in the **normal execution path**, and where can it diverge from UI state?
- **What** exact inputs/outputs, side effects, and invariants are expected for **manual model selection state in the page components** during the **normal execution path**?
- **Why** was this behavior chosen instead of alternate designs, and why is it safe/unsafe for provider portability in the **normal execution path**?
- **When** does this path execute, retry, short-circuit, or fail for **manual model selection state in the page components**, and when should fallback happen in the **normal execution path**?
- **How** is this path verified today (tests/logs/telemetry), and how will regressions be detected for **manual model selection state in the page components** in the **normal execution path**?

## 7. Manual model selection state in the page components — Session resume path

- **Where** is the authoritative implementation for **manual model selection state in the page components** in the **session resume path**, and where can it diverge from UI state?
- **What** exact inputs/outputs, side effects, and invariants are expected for **manual model selection state in the page components** during the **session resume path**?
- **Why** was this behavior chosen instead of alternate designs, and why is it safe/unsafe for provider portability in the **session resume path**?
- **When** does this path execute, retry, short-circuit, or fail for **manual model selection state in the page components**, and when should fallback happen in the **session resume path**?
- **How** is this path verified today (tests/logs/telemetry), and how will regressions be detected for **manual model selection state in the page components** in the **session resume path**?

## 8. Manual model selection state in the page components — Discovery empty/fallback path

- **Where** is the authoritative implementation for **manual model selection state in the page components** in the **discovery empty/fallback path**, and where can it diverge from UI state?
- **What** exact inputs/outputs, side effects, and invariants are expected for **manual model selection state in the page components** during the **discovery empty/fallback path**?
- **Why** was this behavior chosen instead of alternate designs, and why is it safe/unsafe for provider portability in the **discovery empty/fallback path**?
- **When** does this path execute, retry, short-circuit, or fail for **manual model selection state in the page components**, and when should fallback happen in the **discovery empty/fallback path**?
- **How** is this path verified today (tests/logs/telemetry), and how will regressions be detected for **manual model selection state in the page components** in the **discovery empty/fallback path**?

## 9. Manual model selection state in the page components — Provider error path

- **Where** is the authoritative implementation for **manual model selection state in the page components** in the **provider error path**, and where can it diverge from UI state?
- **What** exact inputs/outputs, side effects, and invariants are expected for **manual model selection state in the page components** during the **provider error path**?
- **Why** was this behavior chosen instead of alternate designs, and why is it safe/unsafe for provider portability in the **provider error path**?
- **When** does this path execute, retry, short-circuit, or fail for **manual model selection state in the page components**, and when should fallback happen in the **provider error path**?
- **How** is this path verified today (tests/logs/telemetry), and how will regressions be detected for **manual model selection state in the page components** in the **provider error path**?

## 10. Manual model selection state in the page components — Observability and diagnostics path

- **Where** is the authoritative implementation for **manual model selection state in the page components** in the **observability and diagnostics path**, and where can it diverge from UI state?
- **What** exact inputs/outputs, side effects, and invariants are expected for **manual model selection state in the page components** during the **observability and diagnostics path**?
- **Why** was this behavior chosen instead of alternate designs, and why is it safe/unsafe for provider portability in the **observability and diagnostics path**?
- **When** does this path execute, retry, short-circuit, or fail for **manual model selection state in the page components**, and when should fallback happen in the **observability and diagnostics path**?
- **How** is this path verified today (tests/logs/telemetry), and how will regressions be detected for **manual model selection state in the page components** in the **observability and diagnostics path**?

## 11. sendChat request payload composition — Normal execution path

- **Where** is the authoritative implementation for **sendchat request payload composition** in the **normal execution path**, and where can it diverge from UI state?
- **What** exact inputs/outputs, side effects, and invariants are expected for **sendchat request payload composition** during the **normal execution path**?
- **Why** was this behavior chosen instead of alternate designs, and why is it safe/unsafe for provider portability in the **normal execution path**?
- **When** does this path execute, retry, short-circuit, or fail for **sendchat request payload composition**, and when should fallback happen in the **normal execution path**?
- **How** is this path verified today (tests/logs/telemetry), and how will regressions be detected for **sendchat request payload composition** in the **normal execution path**?

## 12. sendChat request payload composition — Session resume path

- **Where** is the authoritative implementation for **sendchat request payload composition** in the **session resume path**, and where can it diverge from UI state?
- **What** exact inputs/outputs, side effects, and invariants are expected for **sendchat request payload composition** during the **session resume path**?
- **Why** was this behavior chosen instead of alternate designs, and why is it safe/unsafe for provider portability in the **session resume path**?
- **When** does this path execute, retry, short-circuit, or fail for **sendchat request payload composition**, and when should fallback happen in the **session resume path**?
- **How** is this path verified today (tests/logs/telemetry), and how will regressions be detected for **sendchat request payload composition** in the **session resume path**?

## 13. sendChat request payload composition — Discovery empty/fallback path

- **Where** is the authoritative implementation for **sendchat request payload composition** in the **discovery empty/fallback path**, and where can it diverge from UI state?
- **What** exact inputs/outputs, side effects, and invariants are expected for **sendchat request payload composition** during the **discovery empty/fallback path**?
- **Why** was this behavior chosen instead of alternate designs, and why is it safe/unsafe for provider portability in the **discovery empty/fallback path**?
- **When** does this path execute, retry, short-circuit, or fail for **sendchat request payload composition**, and when should fallback happen in the **discovery empty/fallback path**?
- **How** is this path verified today (tests/logs/telemetry), and how will regressions be detected for **sendchat request payload composition** in the **discovery empty/fallback path**?

## 14. sendChat request payload composition — Provider error path

- **Where** is the authoritative implementation for **sendchat request payload composition** in the **provider error path**, and where can it diverge from UI state?
- **What** exact inputs/outputs, side effects, and invariants are expected for **sendchat request payload composition** during the **provider error path**?
- **Why** was this behavior chosen instead of alternate designs, and why is it safe/unsafe for provider portability in the **provider error path**?
- **When** does this path execute, retry, short-circuit, or fail for **sendchat request payload composition**, and when should fallback happen in the **provider error path**?
- **How** is this path verified today (tests/logs/telemetry), and how will regressions be detected for **sendchat request payload composition** in the **provider error path**?

## 15. sendChat request payload composition — Observability and diagnostics path

- **Where** is the authoritative implementation for **sendchat request payload composition** in the **observability and diagnostics path**, and where can it diverge from UI state?
- **What** exact inputs/outputs, side effects, and invariants are expected for **sendchat request payload composition** during the **observability and diagnostics path**?
- **Why** was this behavior chosen instead of alternate designs, and why is it safe/unsafe for provider portability in the **observability and diagnostics path**?
- **When** does this path execute, retry, short-circuit, or fail for **sendchat request payload composition**, and when should fallback happen in the **observability and diagnostics path**?
- **How** is this path verified today (tests/logs/telemetry), and how will regressions be detected for **sendchat request payload composition** in the **observability and diagnostics path**?

## 16. /api/chat request parsing and guardrails — Normal execution path

- **Where** is the authoritative implementation for **/api/chat request parsing and guardrails** in the **normal execution path**, and where can it diverge from UI state?
- **What** exact inputs/outputs, side effects, and invariants are expected for **/api/chat request parsing and guardrails** during the **normal execution path**?
- **Why** was this behavior chosen instead of alternate designs, and why is it safe/unsafe for provider portability in the **normal execution path**?
- **When** does this path execute, retry, short-circuit, or fail for **/api/chat request parsing and guardrails**, and when should fallback happen in the **normal execution path**?
- **How** is this path verified today (tests/logs/telemetry), and how will regressions be detected for **/api/chat request parsing and guardrails** in the **normal execution path**?

## 17. /api/chat request parsing and guardrails — Session resume path

- **Where** is the authoritative implementation for **/api/chat request parsing and guardrails** in the **session resume path**, and where can it diverge from UI state?
- **What** exact inputs/outputs, side effects, and invariants are expected for **/api/chat request parsing and guardrails** during the **session resume path**?
- **Why** was this behavior chosen instead of alternate designs, and why is it safe/unsafe for provider portability in the **session resume path**?
- **When** does this path execute, retry, short-circuit, or fail for **/api/chat request parsing and guardrails**, and when should fallback happen in the **session resume path**?
- **How** is this path verified today (tests/logs/telemetry), and how will regressions be detected for **/api/chat request parsing and guardrails** in the **session resume path**?

## 18. /api/chat request parsing and guardrails — Discovery empty/fallback path

- **Where** is the authoritative implementation for **/api/chat request parsing and guardrails** in the **discovery empty/fallback path**, and where can it diverge from UI state?
- **What** exact inputs/outputs, side effects, and invariants are expected for **/api/chat request parsing and guardrails** during the **discovery empty/fallback path**?
- **Why** was this behavior chosen instead of alternate designs, and why is it safe/unsafe for provider portability in the **discovery empty/fallback path**?
- **When** does this path execute, retry, short-circuit, or fail for **/api/chat request parsing and guardrails**, and when should fallback happen in the **discovery empty/fallback path**?
- **How** is this path verified today (tests/logs/telemetry), and how will regressions be detected for **/api/chat request parsing and guardrails** in the **discovery empty/fallback path**?

## 19. /api/chat request parsing and guardrails — Provider error path

- **Where** is the authoritative implementation for **/api/chat request parsing and guardrails** in the **provider error path**, and where can it diverge from UI state?
- **What** exact inputs/outputs, side effects, and invariants are expected for **/api/chat request parsing and guardrails** during the **provider error path**?
- **Why** was this behavior chosen instead of alternate designs, and why is it safe/unsafe for provider portability in the **provider error path**?
- **When** does this path execute, retry, short-circuit, or fail for **/api/chat request parsing and guardrails**, and when should fallback happen in the **provider error path**?
- **How** is this path verified today (tests/logs/telemetry), and how will regressions be detected for **/api/chat request parsing and guardrails** in the **provider error path**?

## 20. /api/chat request parsing and guardrails — Observability and diagnostics path

- **Where** is the authoritative implementation for **/api/chat request parsing and guardrails** in the **observability and diagnostics path**, and where can it diverge from UI state?
- **What** exact inputs/outputs, side effects, and invariants are expected for **/api/chat request parsing and guardrails** during the **observability and diagnostics path**?
- **Why** was this behavior chosen instead of alternate designs, and why is it safe/unsafe for provider portability in the **observability and diagnostics path**?
- **When** does this path execute, retry, short-circuit, or fail for **/api/chat request parsing and guardrails**, and when should fallback happen in the **observability and diagnostics path**?
- **How** is this path verified today (tests/logs/telemetry), and how will regressions be detected for **/api/chat request parsing and guardrails** in the **observability and diagnostics path**?

## 21. streamClaude runner invocation contract — Normal execution path

- **Where** is the authoritative implementation for **streamclaude runner invocation contract** in the **normal execution path**, and where can it diverge from UI state?
- **What** exact inputs/outputs, side effects, and invariants are expected for **streamclaude runner invocation contract** during the **normal execution path**?
- **Why** was this behavior chosen instead of alternate designs, and why is it safe/unsafe for provider portability in the **normal execution path**?
- **When** does this path execute, retry, short-circuit, or fail for **streamclaude runner invocation contract**, and when should fallback happen in the **normal execution path**?
- **How** is this path verified today (tests/logs/telemetry), and how will regressions be detected for **streamclaude runner invocation contract** in the **normal execution path**?

## 22. streamClaude runner invocation contract — Session resume path

- **Where** is the authoritative implementation for **streamclaude runner invocation contract** in the **session resume path**, and where can it diverge from UI state?
- **What** exact inputs/outputs, side effects, and invariants are expected for **streamclaude runner invocation contract** during the **session resume path**?
- **Why** was this behavior chosen instead of alternate designs, and why is it safe/unsafe for provider portability in the **session resume path**?
- **When** does this path execute, retry, short-circuit, or fail for **streamclaude runner invocation contract**, and when should fallback happen in the **session resume path**?
- **How** is this path verified today (tests/logs/telemetry), and how will regressions be detected for **streamclaude runner invocation contract** in the **session resume path**?

## 23. streamClaude runner invocation contract — Discovery empty/fallback path

- **Where** is the authoritative implementation for **streamclaude runner invocation contract** in the **discovery empty/fallback path**, and where can it diverge from UI state?
- **What** exact inputs/outputs, side effects, and invariants are expected for **streamclaude runner invocation contract** during the **discovery empty/fallback path**?
- **Why** was this behavior chosen instead of alternate designs, and why is it safe/unsafe for provider portability in the **discovery empty/fallback path**?
- **When** does this path execute, retry, short-circuit, or fail for **streamclaude runner invocation contract**, and when should fallback happen in the **discovery empty/fallback path**?
- **How** is this path verified today (tests/logs/telemetry), and how will regressions be detected for **streamclaude runner invocation contract** in the **discovery empty/fallback path**?

## 24. streamClaude runner invocation contract — Provider error path

- **Where** is the authoritative implementation for **streamclaude runner invocation contract** in the **provider error path**, and where can it diverge from UI state?
- **What** exact inputs/outputs, side effects, and invariants are expected for **streamclaude runner invocation contract** during the **provider error path**?
- **Why** was this behavior chosen instead of alternate designs, and why is it safe/unsafe for provider portability in the **provider error path**?
- **When** does this path execute, retry, short-circuit, or fail for **streamclaude runner invocation contract**, and when should fallback happen in the **provider error path**?
- **How** is this path verified today (tests/logs/telemetry), and how will regressions be detected for **streamclaude runner invocation contract** in the **provider error path**?

## 25. streamClaude runner invocation contract — Observability and diagnostics path

- **Where** is the authoritative implementation for **streamclaude runner invocation contract** in the **observability and diagnostics path**, and where can it diverge from UI state?
- **What** exact inputs/outputs, side effects, and invariants are expected for **streamclaude runner invocation contract** during the **observability and diagnostics path**?
- **Why** was this behavior chosen instead of alternate designs, and why is it safe/unsafe for provider portability in the **observability and diagnostics path**?
- **When** does this path execute, retry, short-circuit, or fail for **streamclaude runner invocation contract**, and when should fallback happen in the **observability and diagnostics path**?
- **How** is this path verified today (tests/logs/telemetry), and how will regressions be detected for **streamclaude runner invocation contract** in the **observability and diagnostics path**?

## 26. Runner option validation logic — Normal execution path

- **Where** is the authoritative implementation for **runner option validation logic** in the **normal execution path**, and where can it diverge from UI state?
- **What** exact inputs/outputs, side effects, and invariants are expected for **runner option validation logic** during the **normal execution path**?
- **Why** was this behavior chosen instead of alternate designs, and why is it safe/unsafe for provider portability in the **normal execution path**?
- **When** does this path execute, retry, short-circuit, or fail for **runner option validation logic**, and when should fallback happen in the **normal execution path**?
- **How** is this path verified today (tests/logs/telemetry), and how will regressions be detected for **runner option validation logic** in the **normal execution path**?

## 27. Runner option validation logic — Session resume path

- **Where** is the authoritative implementation for **runner option validation logic** in the **session resume path**, and where can it diverge from UI state?
- **What** exact inputs/outputs, side effects, and invariants are expected for **runner option validation logic** during the **session resume path**?
- **Why** was this behavior chosen instead of alternate designs, and why is it safe/unsafe for provider portability in the **session resume path**?
- **When** does this path execute, retry, short-circuit, or fail for **runner option validation logic**, and when should fallback happen in the **session resume path**?
- **How** is this path verified today (tests/logs/telemetry), and how will regressions be detected for **runner option validation logic** in the **session resume path**?

## 28. Runner option validation logic — Discovery empty/fallback path

- **Where** is the authoritative implementation for **runner option validation logic** in the **discovery empty/fallback path**, and where can it diverge from UI state?
- **What** exact inputs/outputs, side effects, and invariants are expected for **runner option validation logic** during the **discovery empty/fallback path**?
- **Why** was this behavior chosen instead of alternate designs, and why is it safe/unsafe for provider portability in the **discovery empty/fallback path**?
- **When** does this path execute, retry, short-circuit, or fail for **runner option validation logic**, and when should fallback happen in the **discovery empty/fallback path**?
- **How** is this path verified today (tests/logs/telemetry), and how will regressions be detected for **runner option validation logic** in the **discovery empty/fallback path**?

## 29. Runner option validation logic — Provider error path

- **Where** is the authoritative implementation for **runner option validation logic** in the **provider error path**, and where can it diverge from UI state?
- **What** exact inputs/outputs, side effects, and invariants are expected for **runner option validation logic** during the **provider error path**?
- **Why** was this behavior chosen instead of alternate designs, and why is it safe/unsafe for provider portability in the **provider error path**?
- **When** does this path execute, retry, short-circuit, or fail for **runner option validation logic**, and when should fallback happen in the **provider error path**?
- **How** is this path verified today (tests/logs/telemetry), and how will regressions be detected for **runner option validation logic** in the **provider error path**?

## 30. Runner option validation logic — Observability and diagnostics path

- **Where** is the authoritative implementation for **runner option validation logic** in the **observability and diagnostics path**, and where can it diverge from UI state?
- **What** exact inputs/outputs, side effects, and invariants are expected for **runner option validation logic** during the **observability and diagnostics path**?
- **Why** was this behavior chosen instead of alternate designs, and why is it safe/unsafe for provider portability in the **observability and diagnostics path**?
- **When** does this path execute, retry, short-circuit, or fail for **runner option validation logic**, and when should fallback happen in the **observability and diagnostics path**?
- **How** is this path verified today (tests/logs/telemetry), and how will regressions be detected for **runner option validation logic** in the **observability and diagnostics path**?

## 31. Model adapter factory resolution — Normal execution path

- **Where** is the authoritative implementation for **model adapter factory resolution** in the **normal execution path**, and where can it diverge from UI state?
- **What** exact inputs/outputs, side effects, and invariants are expected for **model adapter factory resolution** during the **normal execution path**?
- **Why** was this behavior chosen instead of alternate designs, and why is it safe/unsafe for provider portability in the **normal execution path**?
- **When** does this path execute, retry, short-circuit, or fail for **model adapter factory resolution**, and when should fallback happen in the **normal execution path**?
- **How** is this path verified today (tests/logs/telemetry), and how will regressions be detected for **model adapter factory resolution** in the **normal execution path**?

## 32. Model adapter factory resolution — Session resume path

- **Where** is the authoritative implementation for **model adapter factory resolution** in the **session resume path**, and where can it diverge from UI state?
- **What** exact inputs/outputs, side effects, and invariants are expected for **model adapter factory resolution** during the **session resume path**?
- **Why** was this behavior chosen instead of alternate designs, and why is it safe/unsafe for provider portability in the **session resume path**?
- **When** does this path execute, retry, short-circuit, or fail for **model adapter factory resolution**, and when should fallback happen in the **session resume path**?
- **How** is this path verified today (tests/logs/telemetry), and how will regressions be detected for **model adapter factory resolution** in the **session resume path**?

## 33. Model adapter factory resolution — Discovery empty/fallback path

- **Where** is the authoritative implementation for **model adapter factory resolution** in the **discovery empty/fallback path**, and where can it diverge from UI state?
- **What** exact inputs/outputs, side effects, and invariants are expected for **model adapter factory resolution** during the **discovery empty/fallback path**?
- **Why** was this behavior chosen instead of alternate designs, and why is it safe/unsafe for provider portability in the **discovery empty/fallback path**?
- **When** does this path execute, retry, short-circuit, or fail for **model adapter factory resolution**, and when should fallback happen in the **discovery empty/fallback path**?
- **How** is this path verified today (tests/logs/telemetry), and how will regressions be detected for **model adapter factory resolution** in the **discovery empty/fallback path**?

## 34. Model adapter factory resolution — Provider error path

- **Where** is the authoritative implementation for **model adapter factory resolution** in the **provider error path**, and where can it diverge from UI state?
- **What** exact inputs/outputs, side effects, and invariants are expected for **model adapter factory resolution** during the **provider error path**?
- **Why** was this behavior chosen instead of alternate designs, and why is it safe/unsafe for provider portability in the **provider error path**?
- **When** does this path execute, retry, short-circuit, or fail for **model adapter factory resolution**, and when should fallback happen in the **provider error path**?
- **How** is this path verified today (tests/logs/telemetry), and how will regressions be detected for **model adapter factory resolution** in the **provider error path**?

## 35. Model adapter factory resolution — Observability and diagnostics path

- **Where** is the authoritative implementation for **model adapter factory resolution** in the **observability and diagnostics path**, and where can it diverge from UI state?
- **What** exact inputs/outputs, side effects, and invariants are expected for **model adapter factory resolution** during the **observability and diagnostics path**?
- **Why** was this behavior chosen instead of alternate designs, and why is it safe/unsafe for provider portability in the **observability and diagnostics path**?
- **When** does this path execute, retry, short-circuit, or fail for **model adapter factory resolution**, and when should fallback happen in the **observability and diagnostics path**?
- **How** is this path verified today (tests/logs/telemetry), and how will regressions be detected for **model adapter factory resolution** in the **observability and diagnostics path**?

## 36. Claude CLI adapter invocation — Normal execution path

- **Where** is the authoritative implementation for **claude cli adapter invocation** in the **normal execution path**, and where can it diverge from UI state?
- **What** exact inputs/outputs, side effects, and invariants are expected for **claude cli adapter invocation** during the **normal execution path**?
- **Why** was this behavior chosen instead of alternate designs, and why is it safe/unsafe for provider portability in the **normal execution path**?
- **When** does this path execute, retry, short-circuit, or fail for **claude cli adapter invocation**, and when should fallback happen in the **normal execution path**?
- **How** is this path verified today (tests/logs/telemetry), and how will regressions be detected for **claude cli adapter invocation** in the **normal execution path**?

## 37. Claude CLI adapter invocation — Session resume path

- **Where** is the authoritative implementation for **claude cli adapter invocation** in the **session resume path**, and where can it diverge from UI state?
- **What** exact inputs/outputs, side effects, and invariants are expected for **claude cli adapter invocation** during the **session resume path**?
- **Why** was this behavior chosen instead of alternate designs, and why is it safe/unsafe for provider portability in the **session resume path**?
- **When** does this path execute, retry, short-circuit, or fail for **claude cli adapter invocation**, and when should fallback happen in the **session resume path**?
- **How** is this path verified today (tests/logs/telemetry), and how will regressions be detected for **claude cli adapter invocation** in the **session resume path**?

## 38. Claude CLI adapter invocation — Discovery empty/fallback path

- **Where** is the authoritative implementation for **claude cli adapter invocation** in the **discovery empty/fallback path**, and where can it diverge from UI state?
- **What** exact inputs/outputs, side effects, and invariants are expected for **claude cli adapter invocation** during the **discovery empty/fallback path**?
- **Why** was this behavior chosen instead of alternate designs, and why is it safe/unsafe for provider portability in the **discovery empty/fallback path**?
- **When** does this path execute, retry, short-circuit, or fail for **claude cli adapter invocation**, and when should fallback happen in the **discovery empty/fallback path**?
- **How** is this path verified today (tests/logs/telemetry), and how will regressions be detected for **claude cli adapter invocation** in the **discovery empty/fallback path**?

## 39. Claude CLI adapter invocation — Provider error path

- **Where** is the authoritative implementation for **claude cli adapter invocation** in the **provider error path**, and where can it diverge from UI state?
- **What** exact inputs/outputs, side effects, and invariants are expected for **claude cli adapter invocation** during the **provider error path**?
- **Why** was this behavior chosen instead of alternate designs, and why is it safe/unsafe for provider portability in the **provider error path**?
- **When** does this path execute, retry, short-circuit, or fail for **claude cli adapter invocation**, and when should fallback happen in the **provider error path**?
- **How** is this path verified today (tests/logs/telemetry), and how will regressions be detected for **claude cli adapter invocation** in the **provider error path**?

## 40. Claude CLI adapter invocation — Observability and diagnostics path

- **Where** is the authoritative implementation for **claude cli adapter invocation** in the **observability and diagnostics path**, and where can it diverge from UI state?
- **What** exact inputs/outputs, side effects, and invariants are expected for **claude cli adapter invocation** during the **observability and diagnostics path**?
- **Why** was this behavior chosen instead of alternate designs, and why is it safe/unsafe for provider portability in the **observability and diagnostics path**?
- **When** does this path execute, retry, short-circuit, or fail for **claude cli adapter invocation**, and when should fallback happen in the **observability and diagnostics path**?
- **How** is this path verified today (tests/logs/telemetry), and how will regressions be detected for **claude cli adapter invocation** in the **observability and diagnostics path**?

## 41. Claude Code Router (ccr) adapter invocation — Normal execution path

- **Where** is the authoritative implementation for **claude code router (ccr) adapter invocation** in the **normal execution path**, and where can it diverge from UI state?
- **What** exact inputs/outputs, side effects, and invariants are expected for **claude code router (ccr) adapter invocation** during the **normal execution path**?
- **Why** was this behavior chosen instead of alternate designs, and why is it safe/unsafe for provider portability in the **normal execution path**?
- **When** does this path execute, retry, short-circuit, or fail for **claude code router (ccr) adapter invocation**, and when should fallback happen in the **normal execution path**?
- **How** is this path verified today (tests/logs/telemetry), and how will regressions be detected for **claude code router (ccr) adapter invocation** in the **normal execution path**?

## 42. Claude Code Router (ccr) adapter invocation — Session resume path

- **Where** is the authoritative implementation for **claude code router (ccr) adapter invocation** in the **session resume path**, and where can it diverge from UI state?
- **What** exact inputs/outputs, side effects, and invariants are expected for **claude code router (ccr) adapter invocation** during the **session resume path**?
- **Why** was this behavior chosen instead of alternate designs, and why is it safe/unsafe for provider portability in the **session resume path**?
- **When** does this path execute, retry, short-circuit, or fail for **claude code router (ccr) adapter invocation**, and when should fallback happen in the **session resume path**?
- **How** is this path verified today (tests/logs/telemetry), and how will regressions be detected for **claude code router (ccr) adapter invocation** in the **session resume path**?

## 43. Claude Code Router (ccr) adapter invocation — Discovery empty/fallback path

- **Where** is the authoritative implementation for **claude code router (ccr) adapter invocation** in the **discovery empty/fallback path**, and where can it diverge from UI state?
- **What** exact inputs/outputs, side effects, and invariants are expected for **claude code router (ccr) adapter invocation** during the **discovery empty/fallback path**?
- **Why** was this behavior chosen instead of alternate designs, and why is it safe/unsafe for provider portability in the **discovery empty/fallback path**?
- **When** does this path execute, retry, short-circuit, or fail for **claude code router (ccr) adapter invocation**, and when should fallback happen in the **discovery empty/fallback path**?
- **How** is this path verified today (tests/logs/telemetry), and how will regressions be detected for **claude code router (ccr) adapter invocation** in the **discovery empty/fallback path**?

## 44. Claude Code Router (ccr) adapter invocation — Provider error path

- **Where** is the authoritative implementation for **claude code router (ccr) adapter invocation** in the **provider error path**, and where can it diverge from UI state?
- **What** exact inputs/outputs, side effects, and invariants are expected for **claude code router (ccr) adapter invocation** during the **provider error path**?
- **Why** was this behavior chosen instead of alternate designs, and why is it safe/unsafe for provider portability in the **provider error path**?
- **When** does this path execute, retry, short-circuit, or fail for **claude code router (ccr) adapter invocation**, and when should fallback happen in the **provider error path**?
- **How** is this path verified today (tests/logs/telemetry), and how will regressions be detected for **claude code router (ccr) adapter invocation** in the **provider error path**?

## 45. Claude Code Router (ccr) adapter invocation — Observability and diagnostics path

- **Where** is the authoritative implementation for **claude code router (ccr) adapter invocation** in the **observability and diagnostics path**, and where can it diverge from UI state?
- **What** exact inputs/outputs, side effects, and invariants are expected for **claude code router (ccr) adapter invocation** during the **observability and diagnostics path**?
- **Why** was this behavior chosen instead of alternate designs, and why is it safe/unsafe for provider portability in the **observability and diagnostics path**?
- **When** does this path execute, retry, short-circuit, or fail for **claude code router (ccr) adapter invocation**, and when should fallback happen in the **observability and diagnostics path**?
- **How** is this path verified today (tests/logs/telemetry), and how will regressions be detected for **claude code router (ccr) adapter invocation** in the **observability and diagnostics path**?

## 46. Open Claude Code (occ) adapter invocation — Normal execution path

- **Where** is the authoritative implementation for **open claude code (occ) adapter invocation** in the **normal execution path**, and where can it diverge from UI state?
- **What** exact inputs/outputs, side effects, and invariants are expected for **open claude code (occ) adapter invocation** during the **normal execution path**?
- **Why** was this behavior chosen instead of alternate designs, and why is it safe/unsafe for provider portability in the **normal execution path**?
- **When** does this path execute, retry, short-circuit, or fail for **open claude code (occ) adapter invocation**, and when should fallback happen in the **normal execution path**?
- **How** is this path verified today (tests/logs/telemetry), and how will regressions be detected for **open claude code (occ) adapter invocation** in the **normal execution path**?

## 47. Open Claude Code (occ) adapter invocation — Session resume path

- **Where** is the authoritative implementation for **open claude code (occ) adapter invocation** in the **session resume path**, and where can it diverge from UI state?
- **What** exact inputs/outputs, side effects, and invariants are expected for **open claude code (occ) adapter invocation** during the **session resume path**?
- **Why** was this behavior chosen instead of alternate designs, and why is it safe/unsafe for provider portability in the **session resume path**?
- **When** does this path execute, retry, short-circuit, or fail for **open claude code (occ) adapter invocation**, and when should fallback happen in the **session resume path**?
- **How** is this path verified today (tests/logs/telemetry), and how will regressions be detected for **open claude code (occ) adapter invocation** in the **session resume path**?

## 48. Open Claude Code (occ) adapter invocation — Discovery empty/fallback path

- **Where** is the authoritative implementation for **open claude code (occ) adapter invocation** in the **discovery empty/fallback path**, and where can it diverge from UI state?
- **What** exact inputs/outputs, side effects, and invariants are expected for **open claude code (occ) adapter invocation** during the **discovery empty/fallback path**?
- **Why** was this behavior chosen instead of alternate designs, and why is it safe/unsafe for provider portability in the **discovery empty/fallback path**?
- **When** does this path execute, retry, short-circuit, or fail for **open claude code (occ) adapter invocation**, and when should fallback happen in the **discovery empty/fallback path**?
- **How** is this path verified today (tests/logs/telemetry), and how will regressions be detected for **open claude code (occ) adapter invocation** in the **discovery empty/fallback path**?

## 49. Open Claude Code (occ) adapter invocation — Provider error path

- **Where** is the authoritative implementation for **open claude code (occ) adapter invocation** in the **provider error path**, and where can it diverge from UI state?
- **What** exact inputs/outputs, side effects, and invariants are expected for **open claude code (occ) adapter invocation** during the **provider error path**?
- **Why** was this behavior chosen instead of alternate designs, and why is it safe/unsafe for provider portability in the **provider error path**?
- **When** does this path execute, retry, short-circuit, or fail for **open claude code (occ) adapter invocation**, and when should fallback happen in the **provider error path**?
- **How** is this path verified today (tests/logs/telemetry), and how will regressions be detected for **open claude code (occ) adapter invocation** in the **provider error path**?

## 50. Open Claude Code (occ) adapter invocation — Observability and diagnostics path

- **Where** is the authoritative implementation for **open claude code (occ) adapter invocation** in the **observability and diagnostics path**, and where can it diverge from UI state?
- **What** exact inputs/outputs, side effects, and invariants are expected for **open claude code (occ) adapter invocation** during the **observability and diagnostics path**?
- **Why** was this behavior chosen instead of alternate designs, and why is it safe/unsafe for provider portability in the **observability and diagnostics path**?
- **When** does this path execute, retry, short-circuit, or fail for **open claude code (occ) adapter invocation**, and when should fallback happen in the **observability and diagnostics path**?
- **How** is this path verified today (tests/logs/telemetry), and how will regressions be detected for **open claude code (occ) adapter invocation** in the **observability and diagnostics path**?

## 51. OpenClaude adapter invocation — Normal execution path

- **Where** is the authoritative implementation for **openclaude adapter invocation** in the **normal execution path**, and where can it diverge from UI state?
- **What** exact inputs/outputs, side effects, and invariants are expected for **openclaude adapter invocation** during the **normal execution path**?
- **Why** was this behavior chosen instead of alternate designs, and why is it safe/unsafe for provider portability in the **normal execution path**?
- **When** does this path execute, retry, short-circuit, or fail for **openclaude adapter invocation**, and when should fallback happen in the **normal execution path**?
- **How** is this path verified today (tests/logs/telemetry), and how will regressions be detected for **openclaude adapter invocation** in the **normal execution path**?

## 52. OpenClaude adapter invocation — Session resume path

- **Where** is the authoritative implementation for **openclaude adapter invocation** in the **session resume path**, and where can it diverge from UI state?
- **What** exact inputs/outputs, side effects, and invariants are expected for **openclaude adapter invocation** during the **session resume path**?
- **Why** was this behavior chosen instead of alternate designs, and why is it safe/unsafe for provider portability in the **session resume path**?
- **When** does this path execute, retry, short-circuit, or fail for **openclaude adapter invocation**, and when should fallback happen in the **session resume path**?
- **How** is this path verified today (tests/logs/telemetry), and how will regressions be detected for **openclaude adapter invocation** in the **session resume path**?

## 53. OpenClaude adapter invocation — Discovery empty/fallback path

- **Where** is the authoritative implementation for **openclaude adapter invocation** in the **discovery empty/fallback path**, and where can it diverge from UI state?
- **What** exact inputs/outputs, side effects, and invariants are expected for **openclaude adapter invocation** during the **discovery empty/fallback path**?
- **Why** was this behavior chosen instead of alternate designs, and why is it safe/unsafe for provider portability in the **discovery empty/fallback path**?
- **When** does this path execute, retry, short-circuit, or fail for **openclaude adapter invocation**, and when should fallback happen in the **discovery empty/fallback path**?
- **How** is this path verified today (tests/logs/telemetry), and how will regressions be detected for **openclaude adapter invocation** in the **discovery empty/fallback path**?

## 54. OpenClaude adapter invocation — Provider error path

- **Where** is the authoritative implementation for **openclaude adapter invocation** in the **provider error path**, and where can it diverge from UI state?
- **What** exact inputs/outputs, side effects, and invariants are expected for **openclaude adapter invocation** during the **provider error path**?
- **Why** was this behavior chosen instead of alternate designs, and why is it safe/unsafe for provider portability in the **provider error path**?
- **When** does this path execute, retry, short-circuit, or fail for **openclaude adapter invocation**, and when should fallback happen in the **provider error path**?
- **How** is this path verified today (tests/logs/telemetry), and how will regressions be detected for **openclaude adapter invocation** in the **provider error path**?

## 55. OpenClaude adapter invocation — Observability and diagnostics path

- **Where** is the authoritative implementation for **openclaude adapter invocation** in the **observability and diagnostics path**, and where can it diverge from UI state?
- **What** exact inputs/outputs, side effects, and invariants are expected for **openclaude adapter invocation** during the **observability and diagnostics path**?
- **Why** was this behavior chosen instead of alternate designs, and why is it safe/unsafe for provider portability in the **observability and diagnostics path**?
- **When** does this path execute, retry, short-circuit, or fail for **openclaude adapter invocation**, and when should fallback happen in the **observability and diagnostics path**?
- **How** is this path verified today (tests/logs/telemetry), and how will regressions be detected for **openclaude adapter invocation** in the **observability and diagnostics path**?

## 56. OpenAI HTTP adapter execution shim — Normal execution path

- **Where** is the authoritative implementation for **openai http adapter execution shim** in the **normal execution path**, and where can it diverge from UI state?
- **What** exact inputs/outputs, side effects, and invariants are expected for **openai http adapter execution shim** during the **normal execution path**?
- **Why** was this behavior chosen instead of alternate designs, and why is it safe/unsafe for provider portability in the **normal execution path**?
- **When** does this path execute, retry, short-circuit, or fail for **openai http adapter execution shim**, and when should fallback happen in the **normal execution path**?
- **How** is this path verified today (tests/logs/telemetry), and how will regressions be detected for **openai http adapter execution shim** in the **normal execution path**?

## 57. OpenAI HTTP adapter execution shim — Session resume path

- **Where** is the authoritative implementation for **openai http adapter execution shim** in the **session resume path**, and where can it diverge from UI state?
- **What** exact inputs/outputs, side effects, and invariants are expected for **openai http adapter execution shim** during the **session resume path**?
- **Why** was this behavior chosen instead of alternate designs, and why is it safe/unsafe for provider portability in the **session resume path**?
- **When** does this path execute, retry, short-circuit, or fail for **openai http adapter execution shim**, and when should fallback happen in the **session resume path**?
- **How** is this path verified today (tests/logs/telemetry), and how will regressions be detected for **openai http adapter execution shim** in the **session resume path**?

## 58. OpenAI HTTP adapter execution shim — Discovery empty/fallback path

- **Where** is the authoritative implementation for **openai http adapter execution shim** in the **discovery empty/fallback path**, and where can it diverge from UI state?
- **What** exact inputs/outputs, side effects, and invariants are expected for **openai http adapter execution shim** during the **discovery empty/fallback path**?
- **Why** was this behavior chosen instead of alternate designs, and why is it safe/unsafe for provider portability in the **discovery empty/fallback path**?
- **When** does this path execute, retry, short-circuit, or fail for **openai http adapter execution shim**, and when should fallback happen in the **discovery empty/fallback path**?
- **How** is this path verified today (tests/logs/telemetry), and how will regressions be detected for **openai http adapter execution shim** in the **discovery empty/fallback path**?

## 59. OpenAI HTTP adapter execution shim — Provider error path

- **Where** is the authoritative implementation for **openai http adapter execution shim** in the **provider error path**, and where can it diverge from UI state?
- **What** exact inputs/outputs, side effects, and invariants are expected for **openai http adapter execution shim** during the **provider error path**?
- **Why** was this behavior chosen instead of alternate designs, and why is it safe/unsafe for provider portability in the **provider error path**?
- **When** does this path execute, retry, short-circuit, or fail for **openai http adapter execution shim**, and when should fallback happen in the **provider error path**?
- **How** is this path verified today (tests/logs/telemetry), and how will regressions be detected for **openai http adapter execution shim** in the **provider error path**?

## 60. OpenAI HTTP adapter execution shim — Observability and diagnostics path

- **Where** is the authoritative implementation for **openai http adapter execution shim** in the **observability and diagnostics path**, and where can it diverge from UI state?
- **What** exact inputs/outputs, side effects, and invariants are expected for **openai http adapter execution shim** during the **observability and diagnostics path**?
- **Why** was this behavior chosen instead of alternate designs, and why is it safe/unsafe for provider portability in the **observability and diagnostics path**?
- **When** does this path execute, retry, short-circuit, or fail for **openai http adapter execution shim**, and when should fallback happen in the **observability and diagnostics path**?
- **How** is this path verified today (tests/logs/telemetry), and how will regressions be detected for **openai http adapter execution shim** in the **observability and diagnostics path**?

## 61. LM Studio adapter execution shim — Normal execution path

- **Where** is the authoritative implementation for **lm studio adapter execution shim** in the **normal execution path**, and where can it diverge from UI state?
- **What** exact inputs/outputs, side effects, and invariants are expected for **lm studio adapter execution shim** during the **normal execution path**?
- **Why** was this behavior chosen instead of alternate designs, and why is it safe/unsafe for provider portability in the **normal execution path**?
- **When** does this path execute, retry, short-circuit, or fail for **lm studio adapter execution shim**, and when should fallback happen in the **normal execution path**?
- **How** is this path verified today (tests/logs/telemetry), and how will regressions be detected for **lm studio adapter execution shim** in the **normal execution path**?

## 62. LM Studio adapter execution shim — Session resume path

- **Where** is the authoritative implementation for **lm studio adapter execution shim** in the **session resume path**, and where can it diverge from UI state?
- **What** exact inputs/outputs, side effects, and invariants are expected for **lm studio adapter execution shim** during the **session resume path**?
- **Why** was this behavior chosen instead of alternate designs, and why is it safe/unsafe for provider portability in the **session resume path**?
- **When** does this path execute, retry, short-circuit, or fail for **lm studio adapter execution shim**, and when should fallback happen in the **session resume path**?
- **How** is this path verified today (tests/logs/telemetry), and how will regressions be detected for **lm studio adapter execution shim** in the **session resume path**?

## 63. LM Studio adapter execution shim — Discovery empty/fallback path

- **Where** is the authoritative implementation for **lm studio adapter execution shim** in the **discovery empty/fallback path**, and where can it diverge from UI state?
- **What** exact inputs/outputs, side effects, and invariants are expected for **lm studio adapter execution shim** during the **discovery empty/fallback path**?
- **Why** was this behavior chosen instead of alternate designs, and why is it safe/unsafe for provider portability in the **discovery empty/fallback path**?
- **When** does this path execute, retry, short-circuit, or fail for **lm studio adapter execution shim**, and when should fallback happen in the **discovery empty/fallback path**?
- **How** is this path verified today (tests/logs/telemetry), and how will regressions be detected for **lm studio adapter execution shim** in the **discovery empty/fallback path**?

## 64. LM Studio adapter execution shim — Provider error path

- **Where** is the authoritative implementation for **lm studio adapter execution shim** in the **provider error path**, and where can it diverge from UI state?
- **What** exact inputs/outputs, side effects, and invariants are expected for **lm studio adapter execution shim** during the **provider error path**?
- **Why** was this behavior chosen instead of alternate designs, and why is it safe/unsafe for provider portability in the **provider error path**?
- **When** does this path execute, retry, short-circuit, or fail for **lm studio adapter execution shim**, and when should fallback happen in the **provider error path**?
- **How** is this path verified today (tests/logs/telemetry), and how will regressions be detected for **lm studio adapter execution shim** in the **provider error path**?

## 65. LM Studio adapter execution shim — Observability and diagnostics path

- **Where** is the authoritative implementation for **lm studio adapter execution shim** in the **observability and diagnostics path**, and where can it diverge from UI state?
- **What** exact inputs/outputs, side effects, and invariants are expected for **lm studio adapter execution shim** during the **observability and diagnostics path**?
- **Why** was this behavior chosen instead of alternate designs, and why is it safe/unsafe for provider portability in the **observability and diagnostics path**?
- **When** does this path execute, retry, short-circuit, or fail for **lm studio adapter execution shim**, and when should fallback happen in the **observability and diagnostics path**?
- **How** is this path verified today (tests/logs/telemetry), and how will regressions be detected for **lm studio adapter execution shim** in the **observability and diagnostics path**?

## 66. /api/providers availability reporting — Normal execution path

- **Where** is the authoritative implementation for **/api/providers availability reporting** in the **normal execution path**, and where can it diverge from UI state?
- **What** exact inputs/outputs, side effects, and invariants are expected for **/api/providers availability reporting** during the **normal execution path**?
- **Why** was this behavior chosen instead of alternate designs, and why is it safe/unsafe for provider portability in the **normal execution path**?
- **When** does this path execute, retry, short-circuit, or fail for **/api/providers availability reporting**, and when should fallback happen in the **normal execution path**?
- **How** is this path verified today (tests/logs/telemetry), and how will regressions be detected for **/api/providers availability reporting** in the **normal execution path**?

## 67. /api/providers availability reporting — Session resume path

- **Where** is the authoritative implementation for **/api/providers availability reporting** in the **session resume path**, and where can it diverge from UI state?
- **What** exact inputs/outputs, side effects, and invariants are expected for **/api/providers availability reporting** during the **session resume path**?
- **Why** was this behavior chosen instead of alternate designs, and why is it safe/unsafe for provider portability in the **session resume path**?
- **When** does this path execute, retry, short-circuit, or fail for **/api/providers availability reporting**, and when should fallback happen in the **session resume path**?
- **How** is this path verified today (tests/logs/telemetry), and how will regressions be detected for **/api/providers availability reporting** in the **session resume path**?

## 68. /api/providers availability reporting — Discovery empty/fallback path

- **Where** is the authoritative implementation for **/api/providers availability reporting** in the **discovery empty/fallback path**, and where can it diverge from UI state?
- **What** exact inputs/outputs, side effects, and invariants are expected for **/api/providers availability reporting** during the **discovery empty/fallback path**?
- **Why** was this behavior chosen instead of alternate designs, and why is it safe/unsafe for provider portability in the **discovery empty/fallback path**?
- **When** does this path execute, retry, short-circuit, or fail for **/api/providers availability reporting**, and when should fallback happen in the **discovery empty/fallback path**?
- **How** is this path verified today (tests/logs/telemetry), and how will regressions be detected for **/api/providers availability reporting** in the **discovery empty/fallback path**?

## 69. /api/providers availability reporting — Provider error path

- **Where** is the authoritative implementation for **/api/providers availability reporting** in the **provider error path**, and where can it diverge from UI state?
- **What** exact inputs/outputs, side effects, and invariants are expected for **/api/providers availability reporting** during the **provider error path**?
- **Why** was this behavior chosen instead of alternate designs, and why is it safe/unsafe for provider portability in the **provider error path**?
- **When** does this path execute, retry, short-circuit, or fail for **/api/providers availability reporting**, and when should fallback happen in the **provider error path**?
- **How** is this path verified today (tests/logs/telemetry), and how will regressions be detected for **/api/providers availability reporting** in the **provider error path**?

## 70. /api/providers availability reporting — Observability and diagnostics path

- **Where** is the authoritative implementation for **/api/providers availability reporting** in the **observability and diagnostics path**, and where can it diverge from UI state?
- **What** exact inputs/outputs, side effects, and invariants are expected for **/api/providers availability reporting** during the **observability and diagnostics path**?
- **Why** was this behavior chosen instead of alternate designs, and why is it safe/unsafe for provider portability in the **observability and diagnostics path**?
- **When** does this path execute, retry, short-circuit, or fail for **/api/providers availability reporting**, and when should fallback happen in the **observability and diagnostics path**?
- **How** is this path verified today (tests/logs/telemetry), and how will regressions be detected for **/api/providers availability reporting** in the **observability and diagnostics path**?

## 71. /api/models discovery + fallback behavior — Normal execution path

- **Where** is the authoritative implementation for **/api/models discovery + fallback behavior** in the **normal execution path**, and where can it diverge from UI state?
- **What** exact inputs/outputs, side effects, and invariants are expected for **/api/models discovery + fallback behavior** during the **normal execution path**?
- **Why** was this behavior chosen instead of alternate designs, and why is it safe/unsafe for provider portability in the **normal execution path**?
- **When** does this path execute, retry, short-circuit, or fail for **/api/models discovery + fallback behavior**, and when should fallback happen in the **normal execution path**?
- **How** is this path verified today (tests/logs/telemetry), and how will regressions be detected for **/api/models discovery + fallback behavior** in the **normal execution path**?

## 72. /api/models discovery + fallback behavior — Session resume path

- **Where** is the authoritative implementation for **/api/models discovery + fallback behavior** in the **session resume path**, and where can it diverge from UI state?
- **What** exact inputs/outputs, side effects, and invariants are expected for **/api/models discovery + fallback behavior** during the **session resume path**?
- **Why** was this behavior chosen instead of alternate designs, and why is it safe/unsafe for provider portability in the **session resume path**?
- **When** does this path execute, retry, short-circuit, or fail for **/api/models discovery + fallback behavior**, and when should fallback happen in the **session resume path**?
- **How** is this path verified today (tests/logs/telemetry), and how will regressions be detected for **/api/models discovery + fallback behavior** in the **session resume path**?

## 73. /api/models discovery + fallback behavior — Discovery empty/fallback path

- **Where** is the authoritative implementation for **/api/models discovery + fallback behavior** in the **discovery empty/fallback path**, and where can it diverge from UI state?
- **What** exact inputs/outputs, side effects, and invariants are expected for **/api/models discovery + fallback behavior** during the **discovery empty/fallback path**?
- **Why** was this behavior chosen instead of alternate designs, and why is it safe/unsafe for provider portability in the **discovery empty/fallback path**?
- **When** does this path execute, retry, short-circuit, or fail for **/api/models discovery + fallback behavior**, and when should fallback happen in the **discovery empty/fallback path**?
- **How** is this path verified today (tests/logs/telemetry), and how will regressions be detected for **/api/models discovery + fallback behavior** in the **discovery empty/fallback path**?

## 74. /api/models discovery + fallback behavior — Provider error path

- **Where** is the authoritative implementation for **/api/models discovery + fallback behavior** in the **provider error path**, and where can it diverge from UI state?
- **What** exact inputs/outputs, side effects, and invariants are expected for **/api/models discovery + fallback behavior** during the **provider error path**?
- **Why** was this behavior chosen instead of alternate designs, and why is it safe/unsafe for provider portability in the **provider error path**?
- **When** does this path execute, retry, short-circuit, or fail for **/api/models discovery + fallback behavior**, and when should fallback happen in the **provider error path**?
- **How** is this path verified today (tests/logs/telemetry), and how will regressions be detected for **/api/models discovery + fallback behavior** in the **provider error path**?

## 75. /api/models discovery + fallback behavior — Observability and diagnostics path

- **Where** is the authoritative implementation for **/api/models discovery + fallback behavior** in the **observability and diagnostics path**, and where can it diverge from UI state?
- **What** exact inputs/outputs, side effects, and invariants are expected for **/api/models discovery + fallback behavior** during the **observability and diagnostics path**?
- **Why** was this behavior chosen instead of alternate designs, and why is it safe/unsafe for provider portability in the **observability and diagnostics path**?
- **When** does this path execute, retry, short-circuit, or fail for **/api/models discovery + fallback behavior**, and when should fallback happen in the **observability and diagnostics path**?
- **How** is this path verified today (tests/logs/telemetry), and how will regressions be detected for **/api/models discovery + fallback behavior** in the **observability and diagnostics path**?

## 76. Pipeline start API payload handling — Normal execution path

- **Where** is the authoritative implementation for **pipeline start api payload handling** in the **normal execution path**, and where can it diverge from UI state?
- **What** exact inputs/outputs, side effects, and invariants are expected for **pipeline start api payload handling** during the **normal execution path**?
- **Why** was this behavior chosen instead of alternate designs, and why is it safe/unsafe for provider portability in the **normal execution path**?
- **When** does this path execute, retry, short-circuit, or fail for **pipeline start api payload handling**, and when should fallback happen in the **normal execution path**?
- **How** is this path verified today (tests/logs/telemetry), and how will regressions be detected for **pipeline start api payload handling** in the **normal execution path**?

## 77. Pipeline start API payload handling — Session resume path

- **Where** is the authoritative implementation for **pipeline start api payload handling** in the **session resume path**, and where can it diverge from UI state?
- **What** exact inputs/outputs, side effects, and invariants are expected for **pipeline start api payload handling** during the **session resume path**?
- **Why** was this behavior chosen instead of alternate designs, and why is it safe/unsafe for provider portability in the **session resume path**?
- **When** does this path execute, retry, short-circuit, or fail for **pipeline start api payload handling**, and when should fallback happen in the **session resume path**?
- **How** is this path verified today (tests/logs/telemetry), and how will regressions be detected for **pipeline start api payload handling** in the **session resume path**?

## 78. Pipeline start API payload handling — Discovery empty/fallback path

- **Where** is the authoritative implementation for **pipeline start api payload handling** in the **discovery empty/fallback path**, and where can it diverge from UI state?
- **What** exact inputs/outputs, side effects, and invariants are expected for **pipeline start api payload handling** during the **discovery empty/fallback path**?
- **Why** was this behavior chosen instead of alternate designs, and why is it safe/unsafe for provider portability in the **discovery empty/fallback path**?
- **When** does this path execute, retry, short-circuit, or fail for **pipeline start api payload handling**, and when should fallback happen in the **discovery empty/fallback path**?
- **How** is this path verified today (tests/logs/telemetry), and how will regressions be detected for **pipeline start api payload handling** in the **discovery empty/fallback path**?

## 79. Pipeline start API payload handling — Provider error path

- **Where** is the authoritative implementation for **pipeline start api payload handling** in the **provider error path**, and where can it diverge from UI state?
- **What** exact inputs/outputs, side effects, and invariants are expected for **pipeline start api payload handling** during the **provider error path**?
- **Why** was this behavior chosen instead of alternate designs, and why is it safe/unsafe for provider portability in the **provider error path**?
- **When** does this path execute, retry, short-circuit, or fail for **pipeline start api payload handling**, and when should fallback happen in the **provider error path**?
- **How** is this path verified today (tests/logs/telemetry), and how will regressions be detected for **pipeline start api payload handling** in the **provider error path**?

## 80. Pipeline start API payload handling — Observability and diagnostics path

- **Where** is the authoritative implementation for **pipeline start api payload handling** in the **observability and diagnostics path**, and where can it diverge from UI state?
- **What** exact inputs/outputs, side effects, and invariants are expected for **pipeline start api payload handling** during the **observability and diagnostics path**?
- **Why** was this behavior chosen instead of alternate designs, and why is it safe/unsafe for provider portability in the **observability and diagnostics path**?
- **When** does this path execute, retry, short-circuit, or fail for **pipeline start api payload handling**, and when should fallback happen in the **observability and diagnostics path**?
- **How** is this path verified today (tests/logs/telemetry), and how will regressions be detected for **pipeline start api payload handling** in the **observability and diagnostics path**?

## 81. Pipeline state persistence in pipeline-control — Normal execution path

- **Where** is the authoritative implementation for **pipeline state persistence in pipeline-control** in the **normal execution path**, and where can it diverge from UI state?
- **What** exact inputs/outputs, side effects, and invariants are expected for **pipeline state persistence in pipeline-control** during the **normal execution path**?
- **Why** was this behavior chosen instead of alternate designs, and why is it safe/unsafe for provider portability in the **normal execution path**?
- **When** does this path execute, retry, short-circuit, or fail for **pipeline state persistence in pipeline-control**, and when should fallback happen in the **normal execution path**?
- **How** is this path verified today (tests/logs/telemetry), and how will regressions be detected for **pipeline state persistence in pipeline-control** in the **normal execution path**?

## 82. Pipeline state persistence in pipeline-control — Session resume path

- **Where** is the authoritative implementation for **pipeline state persistence in pipeline-control** in the **session resume path**, and where can it diverge from UI state?
- **What** exact inputs/outputs, side effects, and invariants are expected for **pipeline state persistence in pipeline-control** during the **session resume path**?
- **Why** was this behavior chosen instead of alternate designs, and why is it safe/unsafe for provider portability in the **session resume path**?
- **When** does this path execute, retry, short-circuit, or fail for **pipeline state persistence in pipeline-control**, and when should fallback happen in the **session resume path**?
- **How** is this path verified today (tests/logs/telemetry), and how will regressions be detected for **pipeline state persistence in pipeline-control** in the **session resume path**?

## 83. Pipeline state persistence in pipeline-control — Discovery empty/fallback path

- **Where** is the authoritative implementation for **pipeline state persistence in pipeline-control** in the **discovery empty/fallback path**, and where can it diverge from UI state?
- **What** exact inputs/outputs, side effects, and invariants are expected for **pipeline state persistence in pipeline-control** during the **discovery empty/fallback path**?
- **Why** was this behavior chosen instead of alternate designs, and why is it safe/unsafe for provider portability in the **discovery empty/fallback path**?
- **When** does this path execute, retry, short-circuit, or fail for **pipeline state persistence in pipeline-control**, and when should fallback happen in the **discovery empty/fallback path**?
- **How** is this path verified today (tests/logs/telemetry), and how will regressions be detected for **pipeline state persistence in pipeline-control** in the **discovery empty/fallback path**?

## 84. Pipeline state persistence in pipeline-control — Provider error path

- **Where** is the authoritative implementation for **pipeline state persistence in pipeline-control** in the **provider error path**, and where can it diverge from UI state?
- **What** exact inputs/outputs, side effects, and invariants are expected for **pipeline state persistence in pipeline-control** during the **provider error path**?
- **Why** was this behavior chosen instead of alternate designs, and why is it safe/unsafe for provider portability in the **provider error path**?
- **When** does this path execute, retry, short-circuit, or fail for **pipeline state persistence in pipeline-control**, and when should fallback happen in the **provider error path**?
- **How** is this path verified today (tests/logs/telemetry), and how will regressions be detected for **pipeline state persistence in pipeline-control** in the **provider error path**?

## 85. Pipeline state persistence in pipeline-control — Observability and diagnostics path

- **Where** is the authoritative implementation for **pipeline state persistence in pipeline-control** in the **observability and diagnostics path**, and where can it diverge from UI state?
- **What** exact inputs/outputs, side effects, and invariants are expected for **pipeline state persistence in pipeline-control** during the **observability and diagnostics path**?
- **Why** was this behavior chosen instead of alternate designs, and why is it safe/unsafe for provider portability in the **observability and diagnostics path**?
- **When** does this path execute, retry, short-circuit, or fail for **pipeline state persistence in pipeline-control**, and when should fallback happen in the **observability and diagnostics path**?
- **How** is this path verified today (tests/logs/telemetry), and how will regressions be detected for **pipeline state persistence in pipeline-control** in the **observability and diagnostics path**?

## 86. Orchestrator model/provider spawn decisions — Normal execution path

- **Where** is the authoritative implementation for **orchestrator model/provider spawn decisions** in the **normal execution path**, and where can it diverge from UI state?
- **What** exact inputs/outputs, side effects, and invariants are expected for **orchestrator model/provider spawn decisions** during the **normal execution path**?
- **Why** was this behavior chosen instead of alternate designs, and why is it safe/unsafe for provider portability in the **normal execution path**?
- **When** does this path execute, retry, short-circuit, or fail for **orchestrator model/provider spawn decisions**, and when should fallback happen in the **normal execution path**?
- **How** is this path verified today (tests/logs/telemetry), and how will regressions be detected for **orchestrator model/provider spawn decisions** in the **normal execution path**?

## 87. Orchestrator model/provider spawn decisions — Session resume path

- **Where** is the authoritative implementation for **orchestrator model/provider spawn decisions** in the **session resume path**, and where can it diverge from UI state?
- **What** exact inputs/outputs, side effects, and invariants are expected for **orchestrator model/provider spawn decisions** during the **session resume path**?
- **Why** was this behavior chosen instead of alternate designs, and why is it safe/unsafe for provider portability in the **session resume path**?
- **When** does this path execute, retry, short-circuit, or fail for **orchestrator model/provider spawn decisions**, and when should fallback happen in the **session resume path**?
- **How** is this path verified today (tests/logs/telemetry), and how will regressions be detected for **orchestrator model/provider spawn decisions** in the **session resume path**?

## 88. Orchestrator model/provider spawn decisions — Discovery empty/fallback path

- **Where** is the authoritative implementation for **orchestrator model/provider spawn decisions** in the **discovery empty/fallback path**, and where can it diverge from UI state?
- **What** exact inputs/outputs, side effects, and invariants are expected for **orchestrator model/provider spawn decisions** during the **discovery empty/fallback path**?
- **Why** was this behavior chosen instead of alternate designs, and why is it safe/unsafe for provider portability in the **discovery empty/fallback path**?
- **When** does this path execute, retry, short-circuit, or fail for **orchestrator model/provider spawn decisions**, and when should fallback happen in the **discovery empty/fallback path**?
- **How** is this path verified today (tests/logs/telemetry), and how will regressions be detected for **orchestrator model/provider spawn decisions** in the **discovery empty/fallback path**?

## 89. Orchestrator model/provider spawn decisions — Provider error path

- **Where** is the authoritative implementation for **orchestrator model/provider spawn decisions** in the **provider error path**, and where can it diverge from UI state?
- **What** exact inputs/outputs, side effects, and invariants are expected for **orchestrator model/provider spawn decisions** during the **provider error path**?
- **Why** was this behavior chosen instead of alternate designs, and why is it safe/unsafe for provider portability in the **provider error path**?
- **When** does this path execute, retry, short-circuit, or fail for **orchestrator model/provider spawn decisions**, and when should fallback happen in the **provider error path**?
- **How** is this path verified today (tests/logs/telemetry), and how will regressions be detected for **orchestrator model/provider spawn decisions** in the **provider error path**?

## 90. Orchestrator model/provider spawn decisions — Observability and diagnostics path

- **Where** is the authoritative implementation for **orchestrator model/provider spawn decisions** in the **observability and diagnostics path**, and where can it diverge from UI state?
- **What** exact inputs/outputs, side effects, and invariants are expected for **orchestrator model/provider spawn decisions** during the **observability and diagnostics path**?
- **Why** was this behavior chosen instead of alternate designs, and why is it safe/unsafe for provider portability in the **observability and diagnostics path**?
- **When** does this path execute, retry, short-circuit, or fail for **orchestrator model/provider spawn decisions**, and when should fallback happen in the **observability and diagnostics path**?
- **How** is this path verified today (tests/logs/telemetry), and how will regressions be detected for **orchestrator model/provider spawn decisions** in the **observability and diagnostics path**?

## 91. Supervisor-to-agent event communication — Normal execution path

- **Where** is the authoritative implementation for **supervisor-to-agent event communication** in the **normal execution path**, and where can it diverge from UI state?
- **What** exact inputs/outputs, side effects, and invariants are expected for **supervisor-to-agent event communication** during the **normal execution path**?
- **Why** was this behavior chosen instead of alternate designs, and why is it safe/unsafe for provider portability in the **normal execution path**?
- **When** does this path execute, retry, short-circuit, or fail for **supervisor-to-agent event communication**, and when should fallback happen in the **normal execution path**?
- **How** is this path verified today (tests/logs/telemetry), and how will regressions be detected for **supervisor-to-agent event communication** in the **normal execution path**?

## 92. Supervisor-to-agent event communication — Session resume path

- **Where** is the authoritative implementation for **supervisor-to-agent event communication** in the **session resume path**, and where can it diverge from UI state?
- **What** exact inputs/outputs, side effects, and invariants are expected for **supervisor-to-agent event communication** during the **session resume path**?
- **Why** was this behavior chosen instead of alternate designs, and why is it safe/unsafe for provider portability in the **session resume path**?
- **When** does this path execute, retry, short-circuit, or fail for **supervisor-to-agent event communication**, and when should fallback happen in the **session resume path**?
- **How** is this path verified today (tests/logs/telemetry), and how will regressions be detected for **supervisor-to-agent event communication** in the **session resume path**?

## 93. Supervisor-to-agent event communication — Discovery empty/fallback path

- **Where** is the authoritative implementation for **supervisor-to-agent event communication** in the **discovery empty/fallback path**, and where can it diverge from UI state?
- **What** exact inputs/outputs, side effects, and invariants are expected for **supervisor-to-agent event communication** during the **discovery empty/fallback path**?
- **Why** was this behavior chosen instead of alternate designs, and why is it safe/unsafe for provider portability in the **discovery empty/fallback path**?
- **When** does this path execute, retry, short-circuit, or fail for **supervisor-to-agent event communication**, and when should fallback happen in the **discovery empty/fallback path**?
- **How** is this path verified today (tests/logs/telemetry), and how will regressions be detected for **supervisor-to-agent event communication** in the **discovery empty/fallback path**?

## 94. Supervisor-to-agent event communication — Provider error path

- **Where** is the authoritative implementation for **supervisor-to-agent event communication** in the **provider error path**, and where can it diverge from UI state?
- **What** exact inputs/outputs, side effects, and invariants are expected for **supervisor-to-agent event communication** during the **provider error path**?
- **Why** was this behavior chosen instead of alternate designs, and why is it safe/unsafe for provider portability in the **provider error path**?
- **When** does this path execute, retry, short-circuit, or fail for **supervisor-to-agent event communication**, and when should fallback happen in the **provider error path**?
- **How** is this path verified today (tests/logs/telemetry), and how will regressions be detected for **supervisor-to-agent event communication** in the **provider error path**?

## 95. Supervisor-to-agent event communication — Observability and diagnostics path

- **Where** is the authoritative implementation for **supervisor-to-agent event communication** in the **observability and diagnostics path**, and where can it diverge from UI state?
- **What** exact inputs/outputs, side effects, and invariants are expected for **supervisor-to-agent event communication** during the **observability and diagnostics path**?
- **Why** was this behavior chosen instead of alternate designs, and why is it safe/unsafe for provider portability in the **observability and diagnostics path**?
- **When** does this path execute, retry, short-circuit, or fail for **supervisor-to-agent event communication**, and when should fallback happen in the **observability and diagnostics path**?
- **How** is this path verified today (tests/logs/telemetry), and how will regressions be detected for **supervisor-to-agent event communication** in the **observability and diagnostics path**?

## 96. RAG retrieval injection into prompts — Normal execution path

- **Where** is the authoritative implementation for **rag retrieval injection into prompts** in the **normal execution path**, and where can it diverge from UI state?
- **What** exact inputs/outputs, side effects, and invariants are expected for **rag retrieval injection into prompts** during the **normal execution path**?
- **Why** was this behavior chosen instead of alternate designs, and why is it safe/unsafe for provider portability in the **normal execution path**?
- **When** does this path execute, retry, short-circuit, or fail for **rag retrieval injection into prompts**, and when should fallback happen in the **normal execution path**?
- **How** is this path verified today (tests/logs/telemetry), and how will regressions be detected for **rag retrieval injection into prompts** in the **normal execution path**?

## 97. RAG retrieval injection into prompts — Session resume path

- **Where** is the authoritative implementation for **rag retrieval injection into prompts** in the **session resume path**, and where can it diverge from UI state?
- **What** exact inputs/outputs, side effects, and invariants are expected for **rag retrieval injection into prompts** during the **session resume path**?
- **Why** was this behavior chosen instead of alternate designs, and why is it safe/unsafe for provider portability in the **session resume path**?
- **When** does this path execute, retry, short-circuit, or fail for **rag retrieval injection into prompts**, and when should fallback happen in the **session resume path**?
- **How** is this path verified today (tests/logs/telemetry), and how will regressions be detected for **rag retrieval injection into prompts** in the **session resume path**?

## 98. RAG retrieval injection into prompts — Discovery empty/fallback path

- **Where** is the authoritative implementation for **rag retrieval injection into prompts** in the **discovery empty/fallback path**, and where can it diverge from UI state?
- **What** exact inputs/outputs, side effects, and invariants are expected for **rag retrieval injection into prompts** during the **discovery empty/fallback path**?
- **Why** was this behavior chosen instead of alternate designs, and why is it safe/unsafe for provider portability in the **discovery empty/fallback path**?
- **When** does this path execute, retry, short-circuit, or fail for **rag retrieval injection into prompts**, and when should fallback happen in the **discovery empty/fallback path**?
- **How** is this path verified today (tests/logs/telemetry), and how will regressions be detected for **rag retrieval injection into prompts** in the **discovery empty/fallback path**?

## 99. RAG retrieval injection into prompts — Provider error path

- **Where** is the authoritative implementation for **rag retrieval injection into prompts** in the **provider error path**, and where can it diverge from UI state?
- **What** exact inputs/outputs, side effects, and invariants are expected for **rag retrieval injection into prompts** during the **provider error path**?
- **Why** was this behavior chosen instead of alternate designs, and why is it safe/unsafe for provider portability in the **provider error path**?
- **When** does this path execute, retry, short-circuit, or fail for **rag retrieval injection into prompts**, and when should fallback happen in the **provider error path**?
- **How** is this path verified today (tests/logs/telemetry), and how will regressions be detected for **rag retrieval injection into prompts** in the **provider error path**?

## 100. RAG retrieval injection into prompts — Observability and diagnostics path

- **Where** is the authoritative implementation for **rag retrieval injection into prompts** in the **observability and diagnostics path**, and where can it diverge from UI state?
- **What** exact inputs/outputs, side effects, and invariants are expected for **rag retrieval injection into prompts** during the **observability and diagnostics path**?
- **Why** was this behavior chosen instead of alternate designs, and why is it safe/unsafe for provider portability in the **observability and diagnostics path**?
- **When** does this path execute, retry, short-circuit, or fail for **rag retrieval injection into prompts**, and when should fallback happen in the **observability and diagnostics path**?
- **How** is this path verified today (tests/logs/telemetry), and how will regressions be detected for **rag retrieval injection into prompts** in the **observability and diagnostics path**?
