import {
  CarFront,
  Cloud,
  Fuel,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
  UserRound,
  Wrench,
  X,
} from "lucide-react";

export type AppTab = "overview" | "fuel" | "wash" | "vehicles" | "sync";

export const appTabTitles: Record<AppTab, string> = {
  overview: "车辆概览",
  fuel: "加油记录",
  wash: "洗车护理",
  vehicles: "车辆管理",
  sync: "数据同步",
};

const tabs = [
  { id: "overview", label: "概览", icon: CarFront },
  { id: "fuel", label: "加油", icon: Fuel },
  { id: "wash", label: "洗车", icon: Sparkles },
  { id: "vehicles", label: "车辆", icon: Wrench },
  { id: "sync", label: "同步", icon: Cloud },
] satisfies Array<{ id: AppTab; label: string; icon: typeof CarFront }>;

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
            <span>车辆生活账本</span>
          </div>
          <button className="desktop-nav-toggle" type="button" aria-label={collapsed ? "展开导航" : "收起导航"} onClick={onToggleCollapsed}>
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
          <button className="mobile-nav-close" type="button" aria-label="关闭导航" onClick={onCloseMobile}>
            <X size={20} />
          </button>
        </div>

        <nav className="nav-tabs" aria-label="功能导航">
          {tabs.map((tab) => {
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
        </nav>

        <div className="nav-user">
          <div className="nav-user-chip" title={userName}>
            <UserRound size={18} />
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
