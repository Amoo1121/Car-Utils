import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  AuthConflictError,
  AuthValidationError,
  type AuthStatus,
  type AuthUser,
  type SQLiteAuthRepository,
} from "./authRepository.js";

const SESSION_COOKIE = "car_utils_session";
const failedLogins = new Map<string, { count: number; resetAt: number }>();

type AuthBody = { email?: string; displayName?: string; password?: string };
type ProfileBody = { email?: string; displayName?: string; currentPassword?: string };
type PasswordBody = { currentPassword?: string; newPassword?: string };

export function registerAuthRoutes(app: FastifyInstance, repository: SQLiteAuthRepository) {
  app.post<{ Body: AuthBody }>("/api/auth/register", async (request, reply) => {
    try {
      const user = await repository.createUser({
        email: request.body?.email ?? "",
        displayName: request.body?.displayName ?? "",
        password: request.body?.password ?? "",
      });
      const session = repository.createSession(user.id);
      setSessionCookie(reply, session.token, session.expiresAt);
      return reply.code(201).send({ user });
    } catch (error) {
      return sendAuthError(reply, error);
    }
  });

  app.post<{ Body: AuthBody }>("/api/auth/login", async (request, reply) => {
    const key = `${request.ip}:${String(request.body?.email ?? "").trim().toLowerCase()}`;
    if (isRateLimited(key)) {
      return reply.code(429).send({ error: "LOGIN_RATE_LIMITED", message: "登录尝试过多，请 15 分钟后再试。" });
    }

    try {
      const user = await repository.authenticate(request.body?.email ?? "", request.body?.password ?? "");
      if (!user) {
        recordFailedLogin(key);
        return reply.code(401).send({ error: "INVALID_CREDENTIALS", message: "邮箱或密码不正确。" });
      }
      failedLogins.delete(key);
      const session = repository.createSession(user.id);
      setSessionCookie(reply, session.token, session.expiresAt);
      return { user };
    } catch (error) {
      return sendAuthError(reply, error);
    }
  });

  app.get("/api/auth/session", async (request, reply) => {
    const user = getAuthenticatedUser(request, repository);
    if (!user) return reply.code(401).send({ error: "AUTH_REQUIRED" });
    return { user };
  });

  app.post("/api/auth/logout", async (request, reply) => {
    repository.deleteSession(readSessionToken(request));
    clearSessionCookie(reply);
    return reply.code(204).send();
  });

  app.patch<{ Body: ProfileBody }>("/api/auth/profile", async (request, reply) => {
    const user = requireAuthenticatedUser(request, reply, repository);
    if (!user) return;
    try {
      const updatedUser = await repository.updateProfile(user.id, {
        displayName: request.body?.displayName ?? user.displayName,
        email: request.body?.email ?? user.email,
        currentPassword: request.body?.currentPassword,
      });
      return updatedUser ? { user: updatedUser } : reply.code(404).send({ error: "USER_NOT_FOUND" });
    } catch (error) {
      return sendAuthError(reply, error);
    }
  });

  app.put<{ Body: PasswordBody }>("/api/auth/password", async (request, reply) => {
    const user = requireAuthenticatedUser(request, reply, repository);
    if (!user) return;
    try {
      const changed = await repository.changePassword(
        user.id,
        request.body?.currentPassword ?? "",
        request.body?.newPassword ?? "",
      );
      if (!changed) {
        return reply.code(400).send({ error: "INVALID_CURRENT_PASSWORD", message: "当前密码不正确。" });
      }
      clearSessionCookie(reply);
      return reply.code(204).send();
    } catch (error) {
      return sendAuthError(reply, error);
    }
  });

  app.get("/api/admin/users", async (request, reply) => {
    const user = requireAuthenticatedUser(request, reply, repository);
    if (!user) return;
    if (user.role !== "admin") return reply.code(403).send({ error: "ADMIN_REQUIRED" });
    return { users: repository.listUsers() };
  });

  app.patch<{ Params: { userId: string }; Body: { status?: AuthStatus } }>(
    "/api/admin/users/:userId/status",
    async (request, reply) => {
      const user = requireAuthenticatedUser(request, reply, repository);
      if (!user) return;
      if (user.role !== "admin") return reply.code(403).send({ error: "ADMIN_REQUIRED" });
      const status = request.body?.status;
      if (status !== "active" && status !== "disabled") {
        return reply.code(400).send({ error: "INVALID_STATUS" });
      }
      try {
        const updatedUser = repository.setUserStatus(user, request.params.userId, status);
        return updatedUser ? { user: updatedUser } : reply.code(404).send({ error: "USER_NOT_FOUND" });
      } catch (error) {
        return sendAuthError(reply, error);
      }
    },
  );
}

export function getAuthenticatedUser(request: FastifyRequest, repository: SQLiteAuthRepository) {
  return repository.getUserForSession(readSessionToken(request));
}

export function requireAuthenticatedUser(
  request: FastifyRequest,
  reply: FastifyReply,
  repository: SQLiteAuthRepository,
): AuthUser | null {
  const user = getAuthenticatedUser(request, repository);
  if (!user) {
    void reply.code(401).send({ error: "AUTH_REQUIRED" });
    return null;
  }
  return user;
}

function readSessionToken(request: FastifyRequest) {
  const cookie = request.headers.cookie ?? "";
  return cookie
    .split(";")
    .map((part) => part.trim().split("="))
    .find(([name]) => name === SESSION_COOKIE)?.[1];
}

function setSessionCookie(reply: FastifyReply, token: string, expiresAt: number) {
  const maxAge = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
  const secure = process.env.AUTH_COOKIE_SECURE === "true" ? "; Secure" : "";
  reply.header(
    "Set-Cookie",
    `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`,
  );
}

function clearSessionCookie(reply: FastifyReply) {
  reply.header("Set-Cookie", `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

function sendAuthError(reply: FastifyReply, error: unknown) {
  if (error instanceof AuthConflictError) {
    return reply.code(409).send({ error: "AUTH_CONFLICT", message: error.message });
  }
  if (error instanceof AuthValidationError) {
    return reply.code(400).send({ error: "AUTH_VALIDATION", message: error.message });
  }
  return reply.code(500).send({ error: "AUTH_INTERNAL_ERROR", message: "认证服务暂时不可用。" });
}

function isRateLimited(key: string) {
  const current = failedLogins.get(key);
  if (!current) return false;
  if (current.resetAt <= Date.now()) {
    failedLogins.delete(key);
    return false;
  }
  return current.count >= 5;
}

function recordFailedLogin(key: string) {
  const current = failedLogins.get(key);
  failedLogins.set(key, {
    count: (current?.count ?? 0) + 1,
    resetAt: current?.resetAt ?? Date.now() + 15 * 60 * 1000,
  });
}
