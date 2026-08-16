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
    <section className="account-workspace tab-stack">
      <section className="account-identity-panel">
        <div className="account-avatar"><UserRound size={25} /></div>
        <div>
          <p className="eyebrow">AUTHENTICATED ACCOUNT</p>
          <h2>{user.displayName}</h2>
          <span>{user.email}</span>
        </div>
        <div className="account-role-badge">
          <ShieldCheck size={15} />
          {user.role === "admin" ? "系统管理员" : "普通用户"}
        </div>
      </section>

      {(feedback || error) && (
        <p className={error ? "status-banner error" : "status-banner success"} role="status">
          {error || feedback}
        </p>
      )}

      <div className="account-settings-grid">
        <form className="panel account-form" onSubmit={saveProfile}>
          <div className="section-title"><UserRound size={17} /><span>账户资料</span></div>
          <label>用户名<input maxLength={60} required value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></label>
          <label>登录邮箱<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          {email.trim().toLowerCase() !== user.email && (
            <label>当前密码<input required type="password" value={profilePassword} onChange={(event) => setProfilePassword(event.target.value)} /></label>
          )}
          <button className="primary-button" type="submit">保存账户资料</button>
        </form>

        <form className="panel account-form" onSubmit={savePassword}>
          <div className="section-title"><KeyRound size={17} /><span>修改密码</span></div>
          <label>当前密码<input autoComplete="current-password" required type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></label>
          <label>新密码<input autoComplete="new-password" minLength={8} required type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></label>
          <label>确认新密码<input autoComplete="new-password" minLength={8} required type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label>
          <button className="secondary-button" type="submit">更新密码</button>
        </form>
      </div>

      {user.role === "admin" && (
        <section className="panel admin-users-panel">
          <div className="panel-heading-row">
            <div>
              <div className="section-title compact"><UsersRound size={17} /><span>用户管理</span></div>
              <p className="filter-count">管理已注册账户及其访问状态</p>
            </div>
            <span className="admin-user-count">{users.length} 个账户</span>
          </div>
          {loadingUsers ? <p className="empty">正在加载用户...</p> : (
            <div className="admin-user-list">
              {users.map((item) => (
                <div className="admin-user-row" key={item.id}>
                  <div className="admin-user-main">
                    <div className="admin-user-icon"><UserRound size={17} /></div>
                    <div><strong>{item.displayName}</strong><span>{item.email}</span></div>
                  </div>
                  <span className={`account-status ${item.status}`}>{item.status === "active" ? "已启用" : "已停用"}</span>
                  <span>{item.role === "admin" ? "管理员" : "用户"}</span>
                  <time dateTime={new Date(item.createdAt).toISOString()}>{new Date(item.createdAt).toLocaleDateString("zh-CN")}</time>
                  <button className="text-button" disabled={item.id === user.id} type="button" onClick={() => toggleStatus(item)}>
                    {item.status === "active" ? "停用" : "启用"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </section>
  );
}
