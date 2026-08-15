export function formatErrors(errors) {
  return errors.map((error) => `- ${error}`).join("\n");
}

function checkState(passed) {
  if (passed == null) return { text: "Skip", json: "skip" };
  if (passed) return { text: "Pass", json: "pass" };
  return { text: "Fail", json: "fail" };
}

export function summariseChecks(checks) {
  return Object.entries(checks)
    .map(([name, passed]) => `${name}: ${checkState(passed).text}`)
    .join("\n");
}

export function toPublicResult(result) {
  return {
    ok: Boolean(result.ok),
    checks: Object.fromEntries(
      Object.entries(result.checks ?? {}).map(([name, passed]) => [name, checkState(passed).json]),
    ),
    errors: [...(result.errors ?? [])],
  };
}
