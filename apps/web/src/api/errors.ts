import type { BackendId } from "./backends";

/** A backend answered with a status outside 2xx */
export class ApiError extends Error {
  readonly backend: BackendId;
  readonly status: number;
  /** The parsed JSON body, or the text, or null */
  readonly body: unknown;

  constructor(backend: BackendId, status: number, body: unknown) {
    super(ApiError.messageOf(backend, status, body));
    this.name = "ApiError";
    this.backend = backend;
    this.status = status;
    this.body = body;
  }

  private static messageOf(
    backend: BackendId,
    status: number,
    body: unknown,
  ): string {
    if (
      typeof body === "object" &&
      body !== null &&
      "error" in body &&
      typeof body.error === "string"
    ) {
      return body.error;
    }
    return `${backend} answered ${status}`;
  }
}

/** 401: the backend's session is gone, it needs a sign-in (deploy/SSO.md §3) */
export class SessionExpiredError extends ApiError {
  constructor(backend: BackendId, body: unknown) {
    super(backend, 401, body);
    this.name = "SessionExpiredError";
  }
}
