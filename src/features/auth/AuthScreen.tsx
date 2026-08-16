import { CarFront, LockKeyhole, ShieldCheck } from "lucide-react";
import { type FormEvent, useState } from "react";
import type { AuthCredentials } from "../../repositories/authRepository";

export type AuthMode = "login" | "register";

export function AuthScreen({
  onAuthenticate,
}: {
  onAuthenticate: (mode: AuthMode, credentials: AuthCredentials) => Promise<void>;
}) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (mode === "register" && password !== confirmPassword) {
      setError("两次输入的密码不一致。");
      return;
    }

    setSubmitting(true);
    try {
      await onAuthenticate(mode, { displayName, email, password });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "认证服务暂时不可用。");
    } finally {
      setSubmitting(false);
    }
  }

  function changeMode(nextMode: AuthMode) {
    setMode(nextMode);
    setError("");
    setPassword("");
    setConfirmPassword("");
  }

  return (
    <main className="login-screen auth-screen">
      <section className="login-panel auth-panel">
        <div className="auth-brand-row">
          <div className="brand-mark">
            <CarFront size={28} />
          </div>
          <div>
            <strong>Car Utils</strong>
            <span>SECURE VEHICLE WORKSPACE</span>
          </div>
        </div>
        <div className="auth-heading">
          <p className="eyebrow">账户认证</p>
          <h1>{mode === "login" ? "登录车辆工作台" : "创建安全账户"}</h1>
          <p>每个账户拥有独立的 SQLite 数据空间，密码和会话令牌不会写入车辆 Store。</p>
        </div>

        <div className="auth-mode-switch" role="tablist" aria-label="认证方式">
          <button className={mode === "login" ? "active" : ""} type="button" onClick={() => changeMode("login")}>
            登录
          </button>
          <button className={mode === "register" ? "active" : ""} type="button" onClick={() => changeMode("register")}>
            注册
          </button>
        </div>

        <form className="stack auth-form" onSubmit={submit}>
          {mode === "register" && (
            <label>
              用户名
              <input
                autoComplete="name"
                maxLength={60}
                required
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="例如 Dylan"
              />
            </label>
          )}
          <label>
            邮箱
            <input
              autoComplete="email"
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
            />
          </label>
          <label>
            密码
            <input
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              minLength={8}
              required
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="至少 8 个字符"
            />
          </label>
          {mode === "register" && (
            <label>
              确认密码
              <input
                autoComplete="new-password"
                minLength={8}
                required
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="再次输入密码"
              />
            </label>
          )}
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="primary-button auth-submit" disabled={submitting} type="submit">
            <LockKeyhole size={17} />
            {submitting ? "正在验证..." : mode === "login" ? "安全登录" : "创建账户"}
          </button>
        </form>

        <div className="auth-security-note">
          <ShieldCheck size={17} />
          <span>
            {mode === "register"
              ? "使用旧版本的相同邮箱可自动认领原数据；首个注册账户会成为管理员。"
              : "登录状态由 HttpOnly Cookie 维护。"}
          </span>
        </div>
      </section>
    </main>
  );
}
