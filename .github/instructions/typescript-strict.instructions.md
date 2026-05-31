---
description: "Use when writing or editing TypeScript or TSX code. Enforces strict-mode compatible patterns to prevent type errors that only appear during production builds (next build / tsc --noEmit)."
applyTo: ["**/*.ts", "**/*.tsx"]
---
# TypeScript Strict Mode Rules

This project uses `"strict": true` in all `tsconfig.json` files.
`next build` runs a full type-check before deploying — type errors that pass locally **will** break the Render build.

## Hard Rules

### 1. Array index access is `T | undefined`
```ts
// ❌ BAD — steps[0] is T | undefined under noUncheckedIndexedAccess
const step = steps[0];
step.id; // Type error: possibly undefined

// ✅ GOOD
const step = steps[0];
if (!step) throw new Error("No steps found");
step.id; // safe
```

### 2. `Array.find()` returns `T | undefined`
```ts
// ❌ BAD
const item = list.find(x => x.id === id);
doSomething(item.value); // Type error

// ✅ GOOD — guard or nullish fallback
const item = list.find(x => x.id === id);
if (!item) { console.error("not found"); process.exit(1); }
doSomething(item.value);
```

### 3. JSON cast / unknown data — use optional fields
When casting `unknown` or `JSON.parse` results, mark all fields that may be absent as optional:
```ts
// ❌ BAD — runtime JSON may not have script
const snap = data as { steps?: Array<{ id: string; script: string }> };

// ✅ GOOD
const snap = data as { steps?: Array<{ id: string; script?: string }> };
```

### 4. Never use non-null assertion (`!`) on data from DB / API
```ts
// ❌ BAD
const name = row.name!;

// ✅ GOOD
const name = row.name ?? "Unknown";
```

### 5. Process-exit scripts must guard all potentially-undefined values
Scripts under `apps/web/scripts/` are type-checked by `next build`.
Always add explicit `if (!x) { process.exit(1); }` guards before using any value
from `Array.find`, `Array[index]`, or `.single()` Supabase results.

## Quick Checklist Before Committing
- [ ] No raw `array[i]` access without `if (!item)` guard
- [ ] No `.find()` result used without null check
- [ ] All `as { ... }` casts use `?` for optional fields
- [ ] No `!` non-null assertions on DB/API data
- [ ] Run `pnpm.cmd exec tsc -p apps/web/tsconfig.json --noEmit` locally to verify
