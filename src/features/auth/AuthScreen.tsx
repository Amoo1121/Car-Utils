import { BellRing, Gauge, LockKeyhole, ShieldCheck } from "lucide-react";
import { type FormEvent, useState } from "react";
import type { AuthCredentials } from "../../repositories/authRepository";
import { BrandMark } from "../../ui/BrandMark";
import { Segmented, TextField } from "../../ui/fields";

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
    <main className="auth-screen">
      <section className="auth-showcase" aria-hidden="true">
        <BrandMark size={64} />
        <h1>你的车，一本账就够了</h1>
        <ul>
          <li><Gauge size={18} /> 真实油耗、每公里成本自动算</li>
          <li><BellRing size={18} /> 保养、保险、年检到期提前提醒</li>
          <li><ShieldCheck size={18} /> 数据只存在你自己的电脑上</li>
        </ul>
      </section>
      <section className="auth-panel">
        <div className="auth-brand">
          <BrandMark size={40} />
          <div>
            <strong>Car Utils</strong>
            <span>车务管家</span>
          </div>
        </div>
        <h2>{mode === "login" ? "欢迎回来" : "创建账户"}</h2>
        <Segmented
          label="登录或注册"
          options={[
            { value: "login", label: "登录" },
            { value: "register", label: "注册" },
          ]}
          value={mode}
          onChange={changeMode}
        />
        <form className="editor-form" onSubmit={submit}>
          {mode === "register" && (
            <TextField autoComplete="name" label="昵称" maxLength={60} placeholder="怎么称呼你" required value={displayName} onChange={setDisplayName} />
          )}
          <TextField autoComplete="email" label="邮箱" placeholder="you@example.com" required type="email" value={email} onChange={setEmail} />
          <TextField
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            label="密码"
            minLength={8}
            placeholder="至少 8 个字符"
            required
            type="password"
            value={password}
            onChange={setPassword}
          />
          {mode === "register" && (
            <TextField autoComplete="new-password" label="确认密码" minLength={8} required type="password" value={confirmPassword} onChange={setConfirmPassword} />
          )}
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="button button-primary button-lg" disabled={submitting} type="submit">
            <LockKeyhole size={17} />
            {submitting ? "正在验证…" : mode === "login" ? "登录" : "创建账户"}
          </button>
        </form>
        <p className="auth-note">
          {mode === "register" ? "使用旧版本的相同邮箱注册，会自动认领原来的数据。首个注册的账户为管理员。" : "登录状态保持 30 天。"}
        </p>
      </section>
    </main>
  );
}
