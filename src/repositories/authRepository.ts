export type AuthRole = "admin" | "user";
export type AuthStatus = "active" | "disabled";

export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  role: AuthRole;
  status: AuthStatus;
  createdAt: number;
  updatedAt: number;
};

export type AuthCredentials = {
  email: string;
  password: string;
  displayName?: string;
};

export class AuthApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "AuthApiError";
  }
}

type FetchLike = typeof fetch;

export class AuthRepository {
  constructor(
    private readonly baseUrl = getDefaultApiBaseUrl(),
    private readonly fetcher: FetchLike = fetch,
  ) {}

  async getSession() {
    const response = await this.request("/api/auth/session", { method: "GET" });
    if (response.status === 401) return null;
    return readUser(response);
  }

  async login(credentials: AuthCredentials) {
    return readUser(
      await this.request("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(credentials),
      }),
    );
  }

  async register(credentials: AuthCredentials) {
    return readUser(
      await this.request("/api/auth/register", {
        method: "POST",
        body: JSON.stringify(credentials),
      }),
    );
  }

  async logout() {
    const response = await this.request("/api/auth/logout", { method: "POST" });
    if (!response.ok && response.status !== 401) await throwAuthError(response);
  }

  async updateProfile(input: { displayName: string; email: string; currentPassword?: string }) {
    return readUser(
      await this.request("/api/auth/profile", {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    );
  }

  async changePassword(input: { currentPassword: string; newPassword: string }) {
    const response = await this.request("/api/auth/password", {
      method: "PUT",
      body: JSON.stringify(input),
    });
    if (!response.ok) await throwAuthError(response);
  }

  async listUsers() {
    const response = await this.request("/api/admin/users", { method: "GET" });
    if (!response.ok) await throwAuthError(response);
    const payload = (await response.json()) as { users: AuthUser[] };
    return payload.users;
  }

  async setUserStatus(userId: string, status: AuthStatus) {
    return readUser(
      await this.request(`/api/admin/users/${encodeURIComponent(userId)}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    );
  }

  private resolveUrl(path: string) {
    const normalizedBaseUrl = this.baseUrl.replace(/\/$/, "");
    return normalizedBaseUrl ? `${normalizedBaseUrl}${path}` : path;
  }

  private request(path: string, init: RequestInit) {
    const fetcher = this.fetcher;
    return fetcher(this.resolveUrl(path), {
      ...init,
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...init.headers,
      },
    });
  }
}

export const authRepository = new AuthRepository();

async function readUser(response: Response) {
  if (!response.ok) await throwAuthError(response);
  const payload = (await response.json()) as { user: AuthUser };
  return payload.user;
}

async function throwAuthError(response: Response): Promise<never> {
  let payload: { error?: string; message?: string } = {};
  try {
    payload = (await response.json()) as typeof payload;
  } catch {
    // The status still provides a useful fallback when the server has no JSON body.
  }
  throw new AuthApiError(payload.message || `认证请求失败：HTTP ${response.status}`, response.status, payload.error);
}

function getDefaultApiBaseUrl() {
  return import.meta.env.VITE_CAR_UTILS_API_BASE_URL ?? "";
}
