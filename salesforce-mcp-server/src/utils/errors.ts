export class SalesforceAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SalesforceAuthError";
  }
}

export class SalesforceQueryError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "SalesforceQueryError";
  }
}

export function toMcpError(err: unknown): string {
  if (err instanceof SalesforceAuthError || err instanceof SalesforceQueryError) {
    return err.message;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
}
