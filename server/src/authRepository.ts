import { createHash, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { DatabaseSync } from "node:sqlite";

const scrypt = promisify(scryptCallback);
const PASSWORD_HASH_BYTES = 64;
const DEFAULT_SESSION_DAYS = 30;

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

type AuthUserRow = {
  id: string;
  email: string;
  display_name: string;
  password_hash: string;
  password_salt: string;
  role: AuthRole;
  status: AuthStatus;
  created_at: number;
  updated_at: number;
};

export class AuthConflictError extends Error {}
export class AuthValidationError extends Error {}

export class SQLiteAuthRepository {
  constructor(
    private readonly database: DatabaseSync,
    private readonly passwordPepper = process.env.AUTH_PASSWORD_PEPPER ?? "",
  ) {}

  async createUser(input: { email: string; displayName: string; password: string }) {
    const email = normalizeAndValidateEmail(input.email);
    const displayName = normalizeDisplayName(input.displayName, email);
    validatePassword(input.password);
    if (this.findUserRowByEmail(email)) throw new AuthConflictError("该邮箱已经注册。");

    const passwordSalt = randomBytes(16).toString("base64url");
    const passwordHash = await this.hashPassword(input.password, passwordSalt);
    const timestamp = Date.now();
    const id = `auth_${randomUUID()}`;
    const role: AuthRole = this.countUsers() === 0 ? "admin" : "user";

    try {
      this.database
        .prepare(
          `INSERT INTO auth_users
            (id, email, display_name, password_hash, password_salt, role, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
        )
        .run(id, email, displayName, passwordHash, passwordSalt, role, timestamp, timestamp);
    } catch (error) {
      if (String(error).includes("UNIQUE")) throw new AuthConflictError("该邮箱已经注册。");
      throw error;
    }

    return this.getUserById(id)!;
  }

  async authenticate(emailValue: string, password: string) {
    const email = normalizeAndValidateEmail(emailValue);
    const row = this.findUserRowByEmail(email);
    if (!row || row.status !== "active") return null;

    const candidateHash = await this.hashPassword(password, row.password_salt);
    const expected = Buffer.from(row.password_hash, "base64url");
    const candidate = Buffer.from(candidateHash, "base64url");
    if (expected.length !== candidate.length || !timingSafeEqual(expected, candidate)) return null;
    return toAuthUser(row);
  }

  createSession(userId: string, sessionDays = readSessionDays()) {
    this.deleteExpiredSessions();
    const token = randomBytes(32).toString("base64url");
    const tokenHash = hashSessionToken(token);
    const createdAt = Date.now();
    const expiresAt = createdAt + sessionDays * 24 * 60 * 60 * 1000;
    this.database
      .prepare("INSERT INTO auth_sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)")
      .run(tokenHash, userId, expiresAt, createdAt);
    return { token, expiresAt };
  }

  getUserForSession(token: string | undefined) {
    if (!token) return null;
    const row = this.database
      .prepare(
        `SELECT u.* FROM auth_sessions s
         JOIN auth_users u ON u.id = s.user_id
         WHERE s.token_hash = ? AND s.expires_at > ? AND u.status = 'active'`,
      )
      .get(hashSessionToken(token), Date.now()) as AuthUserRow | undefined;
    return row ? toAuthUser(row) : null;
  }

  deleteSession(token: string | undefined) {
    if (!token) return;
    this.database.prepare("DELETE FROM auth_sessions WHERE token_hash = ?").run(hashSessionToken(token));
  }

  getUserById(id: string) {
    const row = this.database.prepare("SELECT * FROM auth_users WHERE id = ?").get(id) as AuthUserRow | undefined;
    return row ? toAuthUser(row) : null;
  }

  listUsers() {
    const rows = this.database.prepare("SELECT * FROM auth_users ORDER BY created_at ASC").all() as AuthUserRow[];
    return rows.map(toAuthUser);
  }

  async updateProfile(
    userId: string,
    input: { displayName: string; email: string; currentPassword?: string },
  ) {
    const currentRow = this.getUserRowById(userId);
    if (!currentRow) return null;
    const email = normalizeAndValidateEmail(input.email);
    const displayName = normalizeDisplayName(input.displayName, email);
    if (email !== currentRow.email) {
      if (!input.currentPassword || !(await this.authenticate(currentRow.email, input.currentPassword))) {
        throw new AuthValidationError("修改邮箱前请输入当前密码。");
      }
      const duplicate = this.findUserRowByEmail(email);
      if (duplicate && duplicate.id !== userId) throw new AuthConflictError("该邮箱已经注册。");
    }

    const updatedAt = Date.now();
    this.database
      .prepare("UPDATE auth_users SET email = ?, display_name = ?, updated_at = ? WHERE id = ?")
      .run(email, displayName, updatedAt, userId);
    return this.getUserById(userId);
  }

  async changePassword(userId: string, currentPassword: string, nextPassword: string) {
    const row = this.getUserRowById(userId);
    if (!row || !(await this.authenticate(row.email, currentPassword))) return false;
    validatePassword(nextPassword);
    const salt = randomBytes(16).toString("base64url");
    const hash = await this.hashPassword(nextPassword, salt);
    this.database
      .prepare("UPDATE auth_users SET password_hash = ?, password_salt = ?, updated_at = ? WHERE id = ?")
      .run(hash, salt, Date.now(), userId);
    this.database.prepare("DELETE FROM auth_sessions WHERE user_id = ?").run(userId);
    return true;
  }

  setUserStatus(actor: AuthUser, targetUserId: string, status: AuthStatus) {
    if (actor.role !== "admin") throw new AuthValidationError("需要管理员权限。");
    if (actor.id === targetUserId && status === "disabled") {
      throw new AuthValidationError("不能停用当前管理员账户。");
    }
    const updatedAt = Date.now();
    const result = this.database
      .prepare("UPDATE auth_users SET status = ?, updated_at = ? WHERE id = ?")
      .run(status, updatedAt, targetUserId);
    if (result.changes === 0) return null;
    if (status === "disabled") this.database.prepare("DELETE FROM auth_sessions WHERE user_id = ?").run(targetUserId);
    return this.getUserById(targetUserId);
  }

  private countUsers() {
    const row = this.database.prepare("SELECT COUNT(*) AS count FROM auth_users").get() as { count: number };
    return row.count;
  }

  private getUserRowById(id: string) {
    return this.database.prepare("SELECT * FROM auth_users WHERE id = ?").get(id) as AuthUserRow | undefined;
  }

  private findUserRowByEmail(email: string) {
    return this.database.prepare("SELECT * FROM auth_users WHERE email = ? COLLATE NOCASE").get(email) as
      | AuthUserRow
      | undefined;
  }

  private async hashPassword(password: string, salt: string) {
    const value = await scrypt(`${password}${this.passwordPepper}`, salt, PASSWORD_HASH_BYTES);
    return Buffer.from(value as ArrayBuffer).toString("base64url");
  }

  private deleteExpiredSessions() {
    this.database.prepare("DELETE FROM auth_sessions WHERE expires_at <= ?").run(Date.now());
  }
}

export function validatePassword(password: string) {
  if (password.length < 8 || password.length > 128) {
    throw new AuthValidationError("密码长度需要在 8 到 128 个字符之间。");
  }
}

function normalizeAndValidateEmail(value: string) {
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AuthValidationError("请输入有效邮箱地址。");
  }
  return email;
}

function normalizeDisplayName(value: string, email: string) {
  const displayName = value.trim() || email.split("@")[0] || "车主";
  if (displayName.length > 60) throw new AuthValidationError("用户名不能超过 60 个字符。");
  return displayName;
}

function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("base64url");
}

function readSessionDays() {
  const value = Number(process.env.AUTH_SESSION_DAYS ?? DEFAULT_SESSION_DAYS);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_SESSION_DAYS;
}

function toAuthUser(row: AuthUserRow): AuthUser {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
