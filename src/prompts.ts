import * as p from "@clack/prompts";

/** Cancel the current command in NEPTR style. */
export function bail(): never {
  p.cancel("NEPTR powers down... I'll be here when you need another pie.");
  process.exit(0);
}

/** Unwrap a clack prompt result, bailing out if the user cancelled. */
export function ensure<T>(value: T | symbol): T {
  if (p.isCancel(value)) bail();
  return value as T;
}
