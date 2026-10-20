export type Student = Record<string, unknown>;

export type UserProfile = {
  id: number;
  name: string;
  email: string;
  email_verified_at: string | null;
};

type ApiOptions = {
  method?: "GET" | "POST";
  body?: unknown;
  authenticated?: boolean;
};

export class ApiError extends Error {
  readonly fieldErrors: Record<string, string[]>;
  readonly status: number;

  constructor(message: string, status: number, fieldErrors: Record<string, string[]>) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

const TOKEN_KEY = "sis_api_token";

export function getToken(): string | null {
  return typeof window === "undefined" ? null : window.sessionStorage.getItem(TOKEN_KEY);
}

export function saveToken(token: string): void {
  window.sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  if (typeof window !== "undefined") {
    window.sessionStorage.removeItem(TOKEN_KEY);
  }
}

function getApiBaseUrl(): string {
  const baseUrl = process.env.NEXT_PUBLIC_LARAVEL_API_URL?.trim().replace(/\/+$/, "");

  if (!baseUrl) {
    throw new ApiError("The API address has not been configured.", 0, {});
  }

  return baseUrl;
}

function validationErrors(value: unknown): Record<string, string[]> {
  if (!value || typeof value !== "object" || !("errors" in value)) {
    return {};
  }

  const errors = value.errors;
  if (!errors || typeof errors !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(errors).flatMap(([field, messages]) =>
      Array.isArray(messages)
        ? [[field, messages.filter((message): message is string => typeof message === "string")]]
        : [],
    ),
  );
}

function errorMessage(status: number): string {
  if (status === 0) {
    return "The API address has not been configured.";
  }
  if (status === 401) {
    return "Your session has expired. Please sign in again.";
  }
  if (status === 422) {
    return "Please check the information you entered.";
  }
  if (status === 429) {
    return "Too many attempts. Please wait a moment and try again.";
  }
  if (status >= 500) {
    return "The service is temporarily unavailable. Please try again.";
  }

  return "The request could not be completed. Please try again.";
}

export async function apiRequest<T>(
  path: string,
  options: ApiOptions = {},
): Promise<T> {
  const authenticated = options.authenticated ?? false;
  const headers = new Headers({ Accept: "application/json" });
  const token = authenticated ? getToken() : null;

  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const url = `${getApiBaseUrl()}/api${path}`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method ?? "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      credentials: "omit",
      cache: "no-store",
    });
  } catch {
    throw new ApiError("Could not connect to the service. Check that the backend is running.", 0, {});
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    if (authenticated && response.status === 401) {
      clearToken();
      window.dispatchEvent(new Event("sis:unauthorized"));
    }

    throw new ApiError(
      errorMessage(response.status),
      response.status,
      validationErrors(payload),
    );
  }

  return payload as T;
}

export function formatStudentValue(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "—";
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}
