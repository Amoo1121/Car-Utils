import { describe, expect, it, vi } from "vitest";
import { AuthApiError, AuthRepository } from "../authRepository";

const user = {
  id: "auth_1",
  email: "owner@example.com",
  displayName: "Owner",
  role: "admin",
  status: "active",
  createdAt: 1,
  updatedAt: 1,
};

describe("AuthRepository", () => {
  it("sends password login with browser credentials enabled", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ user }), { status: 200 }));
    const repository = new AuthRepository("http://localhost:3001", fetcher as typeof fetch);

    const result = await repository.login({ email: "owner@example.com", password: "StrongPass123" });

    expect(result).toEqual(user);
    expect(fetcher).toHaveBeenCalledWith(
      "http://localhost:3001/api/auth/login",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ email: "owner@example.com", password: "StrongPass123" }),
      }),
    );
  });

  it("treats an unauthenticated session as signed out", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ error: "AUTH_REQUIRED" }), { status: 401 }));
    const repository = new AuthRepository("", fetcher as typeof fetch);

    await expect(repository.getSession()).resolves.toBeNull();
  });

  it("surfaces backend authentication messages", async () => {
    const fetcher = vi.fn(async () =>
      new Response(JSON.stringify({ error: "INVALID_CREDENTIALS", message: "邮箱或密码不正确。" }), { status: 401 }),
    );
    const repository = new AuthRepository("", fetcher as typeof fetch);

    await expect(repository.login({ email: "owner@example.com", password: "wrongpass" })).rejects.toEqual(
      expect.objectContaining<AuthApiError>({
        name: "AuthApiError",
        message: "邮箱或密码不正确。",
        status: 401,
        code: "INVALID_CREDENTIALS",
      }),
    );
  });
});
