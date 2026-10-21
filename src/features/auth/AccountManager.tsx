import { KeyRound, ShieldCheck, UserRound, UsersRound } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import {
  authRepository,
  type AuthStatus,
  type AuthUser,
} from "../../repositories/authRepository";

export function AccountManager({
  user,
  onPasswordChanged,
  onProfileUpdated,
}: {
  user: AuthUser;
  onPasswordChanged: () => void;
  onProfileUpdated: (user: AuthUser) => void;
}) {
  const [displayName, setDisplayName] = useState(user.displayName);
  const [email, setEmail] = useState(user.email);
  const [profilePassword, setProfilePassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(user.role === "admin");

  useEffect(() => {
    setDisplayName(user.displayName);
    setEmail(user.email);
  }, [user.displayName, user.email]);

  useEffect(() => {
    if (user.role !== "admin") return;
    let mounted = true;
    authRepository
      .listUsers()
      .then((items) => {
        if (mounted) setUsers(items);
      })
      .catch((nextError) => {
        if (mounted) setError(nextError instanceof Error ? nextError.message : "无法加载用户列表。");
      })
      .finally(() => {
        if (mounted) setLoadingUsers(false);
      });
    return () => {
      mounted = false;
    };
  }, [user.role]);

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    setError("");
    setFeedback("");
    try {
      const updatedUser = await authRepository.updateProfile({
        displayName,
        email,
        currentPassword: profilePassword || undefined,
      });
      onProfileUpdated(updatedUser);
      setProfilePassword("");
      setFeedback("账户资料已更新。");
      setUsers((items) => items.map((item) => (item.id === updatedUser.id ? updatedUser : item)));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "无法更新账户资料。");
    }
  }

  async function savePassword(event: FormEvent) {
    event.preventDefault();
    setError("");
    setFeedback("");
    if (newPassword !== confirmPassword) {
      setError("两次输入的新密码不一致。");
      return;
    }
    try {
      await authRepository.changePassword({ currentPassword, newPassword });
      setFeedback("密码已更新，请重新登录。");
      onPasswordChanged();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "无法更新密码。");
    }
  }

  async function toggleStatus(target: AuthUser) {
    const nextStatus: AuthStatus = target.status === "active" ? "disabled" : "active";
    const action = nextStatus === "disabled" ? "停用" : "启用";
    if (!window.confirm(`确定${action}账户 ${target.email} 吗？`)) return;
    setError("");
    try {
      const updatedUser = await authRepository.setUserStatus(target.id, nextStatus);
      setUsers((items) => items.map((item) => (item.id === updatedUser.id ? updatedUser : item)));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : `无法${action}账户。`);
    }
  }

  return (
    <>
      <section className="card account-identity">
        <span className="avatar avatar-lg" aria-hidden="true">{user.displayName.slice(0, 1).toUpperCase()}</span>
        <div>
          <h2>{user.displayName}</h2>
          <span>{user.email}</span>
        </div>
        <span className="badge"><ShieldCheck size={13} /> {user.role === "admin" ? "管理员" : "普通用户"}</span>
      </section>

      {(feedback || error) && (
        <p className={error ? "form-error" : "form-success"} role="status">
          {error || feedback}
        </p>
      )}

      <div className="two-col">
        <form className="card editor-form" onSubmit={saveProfile}>
          <header className="card-head"><h2><UserRound size={17} />账户资料</h2></header>
          <label className="field"><span className="field-label">昵称</span><input maxLength={60} required value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></label>
          <label className="field"><span className="field-label">登录邮箱</span><input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          {email.trim().toLowerCase() !== user.email && (
            <label className="field"><span className="field-label">当前密码</span><input required type="password" value={profilePassword} onChange={(event) => setProfilePassword(event.target.value)} /></label>
          )}
          <div className="button-row"><button className="button button-primary" type="submit">保存</button></div>
        </form>

        <form className="card editor-form" onSubmit={savePassword}>
          <header className="card-head"><h2><KeyRound size={17} />修改密码</h2></header>
          <label className="field"><span className="field-label">当前密码</span><input autoComplete="current-password" required type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></label>
          <label className="field"><span className="field-label">新密码</span><input autoComplete="new-password" minLength={8} required type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></label>
          <label className="field"><span className="field-label">确认新密码</span><input autoComplete="new-password" minLength={8} required type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label>
          <div className="button-row"><button className="button button-soft" type="submit">更新密码</button></div>
        </form>
      </div>

      {user.role === "admin" && (
        <section className="card">
          <header className="card-head">
            <h2><UsersRound size={17} />用户管理</h2>
            <span className="card-sub">{users.length} 个账户</span>
          </header>
          {loadingUsers ? <p className="card-description">正在加载用户…</p> : (
            <ul className="simple-list">
              {users.map((item) => (
                <li key={item.id}>
                  <span>
                    {item.displayName} <small>{item.email} · {item.role === "admin" ? "管理员" : "用户"} · {new Date(item.createdAt).toLocaleDateString("zh-CN")}</small>
                  </span>
                  <span className="button-row">
                    <span className={item.status === "active" ? "badge badge-accent" : "badge"}>{item.status === "active" ? "已启用" : "已停用"}</span>
                    <button className="button button-ghost button-sm" disabled={item.id === user.id} type="button" onClick={() => toggleStatus(item)}>
                      {item.status === "active" ? "停用" : "启用"}
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </>
  );
}
