export class OperationError extends Error {
  constructor(public code: string, message: string) { super(message); }
}
export function failure(error: unknown) {
  return { ok: false as const, error: { code: error instanceof OperationError ? error.code : 'INTERNAL_ERROR', message: error instanceof OperationError ? error.message : 'Operation failed; inspect server diagnostics.' } };
}
