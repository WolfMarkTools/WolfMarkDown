export function formatErrors(errors) {
  return errors.map((error) => `- ${error}`).join("\n");
}

export function summariseChecks(checks) {
  return Object.entries(checks)
    .map(([name, passed]) => `${name}: ${passed ? "Pass" : "Fail"}`)
    .join("\n");
}

export function toPublicResult(result) {
  return {
    ok: Boolean(result.ok),
    checks: Object.fromEntries(
      Object.entries(result.checks ?? {}).map(([name, passed]) => [name, passed ? "pass" : "fail"]),
    ),
    errors: [...(result.errors ?? [])],
  };
}
