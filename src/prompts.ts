import * as p from "@clack/prompts";

/** Cancel the current command in BMO style. */
export function bail(): never {
  p.cancel("BMO powers down... come back and play soon!");
  process.exit(0);
}

/** Unwrap a clack prompt result, bailing out if the user cancelled. */
export function ensure<T>(value: T | symbol): T {
  if (p.isCancel(value)) bail();
  return value as T;
}
