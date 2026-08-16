import {
  BarChart3,
  CarFront,
  Cloud,
  Fuel,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
  UserRound,
  UsersRound,
  Wrench,
  X,
} from "lucide-react";

export type AppTab = "overview" | "analytics" | "fuel" | "wash" | "vehicles" | "users" | "sync";

export const appTabTitles: Record<AppTab, string> = {
  overview: "车辆概览",
  analytics: "数据分析",
  fuel: "加油记录",
  wash: "洗车护理",
  vehicles: "车辆管理",
  users: "账户与权限",
  sync: "数据同步",
};

export const appTabDescriptions: Record<AppTab, string> = {
  overview: "掌握当前车辆状态与最近发生的车务活动",
  analytics: "查看里程、成本、油耗与加油站表现",
  fuel: "记录每次补能并维护可追溯的加油账单",
  wash: "管理洗车记录、护理流程与耗材库存",
  vehicles: "维护车辆资料、状态与历史数据归属",
  users: "管理登录资料、密码、用户与访问权限",
  sync: "管理本地持久化、备份与跨端同步",
};

const tabGroups = [
  {
    label: "车辆工作台",
    tabs: [
      { id: "overview", label: "车辆概览", icon: CarFront },
      { id: "analytics", label: "数据分析", icon: BarChart3 },
      { id: "fuel", label: "加油记录", icon: Fuel },
      { id: "wash", label: "洗车护理", icon: Sparkles },
    ],
  },
  {
    label: "系统管理",
    tabs: [
      { id: "vehicles", label: "车辆管理", icon: Wrench },
      { id: "sync", label: "数据同步", icon: Cloud },
    ],
  },
] satisfies Array<{ label: string; tabs: Array<{ id: AppTab; label: string; icon: typeof CarFront }> }>;

export type AppNavigationProps = {
  activeTab: AppTab;
  collapsed: boolean;
  mobileOpen: boolean;
  userName: string;
  onChange: (tab: AppTab) => void;
  onCloseMobile: () => void;
  onLogout: () => void;
  onOpenMobile: () => void;
  onToggleCollapsed: () => void;
};

export function AppNavigation({
  activeTab,
  collapsed,
  mobileOpen,
  userName,
  onChange,
  onCloseMobile,
  onLogout,
  onOpenMobile,
  onToggleCollapsed,
}: AppNavigationProps) {
  function selectTab(tab: AppTab) {
    onChange(tab);
    onCloseMobile();
  }

  return (
    <>
      <header className="mobile-app-bar">
        <button className="mobile-menu-button" type="button" aria-label="打开导航" onClick={onOpenMobile}>
          <Menu size={20} />
        </button>
        <div>
          <span>Car Utils</span>
          <strong>{appTabTitles[activeTab]}</strong>
        </div>
      </header>

      {mobileOpen && <button className="nav-scrim" type="button" aria-label="关闭导航" onClick={onCloseMobile} />}

      <aside className={`app-nav${collapsed ? " collapsed" : ""}${mobileOpen ? " mobile-open" : ""}`}>
        <div className="nav-top">
          <div className="nav-brand-mark" aria-hidden="true">
            <CarFront size={21} />
          </div>
          <div className="nav-brand-copy">
            <strong>Car Utils</strong>
            <span>VEHICLE COMMAND</span>
          </div>
          <button className="desktop-nav-toggle" type="button" aria-label={collapsed ? "展开导航" : "收起导航"} onClick={onToggleCollapsed}>
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
          <button className="mobile-nav-close" type="button" aria-label="关闭导航" onClick={onCloseMobile}>
            <X size={20} />
          </button>
        </div>

        <nav className="nav-tabs" aria-label="功能导航">
          {tabGroups.map((group) => (
            <div className="nav-group" key={group.label}>
              <span className="nav-group-label">{group.label}</span>
              {group.tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    aria-current={activeTab === tab.id ? "page" : undefined}
                    aria-label={tab.label}
                    className={activeTab === tab.id ? "nav-tab active" : "nav-tab"}
                    key={tab.id}
                    title={collapsed ? tab.label : undefined}
                    type="button"
                    onClick={() => selectTab(tab.id)}
                  >
                    <Icon size={18} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="nav-user">
          <button
            aria-current={activeTab === "users" ? "page" : undefined}
            aria-label="账户与权限"
            className={activeTab === "users" ? "nav-tab active" : "nav-tab"}
            title={collapsed ? "账户与权限" : undefined}
            type="button"
            onClick={() => selectTab("users")}
          >
            <UsersRound size={17} />
            <span>账户与权限</span>
          </button>
          <div className="nav-user-chip" title={userName}>
            <div className="nav-user-avatar">
              <UserRound size={17} />
              <i aria-hidden="true" />
            </div>
            <span>
              <small>当前用户</small>
              <strong>{userName}</strong>
            </span>
          </div>
          <button className="nav-tab" title={collapsed ? "退出登录" : undefined} type="button" onClick={onLogout}>
            <LogOut size={17} />
            <span>退出登录</span>
          </button>
        </div>
      </aside>
    </>
  );
}
