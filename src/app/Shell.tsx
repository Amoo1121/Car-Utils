import {
  BarChart3,
  Car,
  ChevronDown,
  CloudOff,
  Home,
  ListOrdered,
  LoaderCircle,
  LogOut,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Check,
  CircleAlert,
  Warehouse,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { PersistenceStatusSnapshot } from "../repositories/storeRepository";
import { relativeTime } from "../ui/format";
import { BrandMark } from "../ui/BrandMark";
import type { Page } from "./router";
import { useWorkspace } from "./workspace";

export const pageMeta: Record<Page, { label: string; icon: ReactNode }> = {
  home: { label: "首页", icon: <Home size={20} /> },
  timeline: { label: "记录", icon: <ListOrdered size={20} /> },
  insights: { label: "洞察", icon: <BarChart3 size={20} /> },
  garage: { label: "车库", icon: <Warehouse size={20} /> },
  settings: { label: "设置", icon: <Settings size={20} /> },
};

const navOrder: Page[] = ["home", "timeline", "insights", "garage", "settings"];

export function Shell({
  page,
  children,
  onOpenPalette,
}: {
  page: Page;
  children: ReactNode;
  onOpenPalette: () => void;
}) {
  const { navigate, openEditor, session, vehicle } = useWorkspace();

  return (
    <div className="shell">
      <a className="skip-link" href="#main">
        跳到主要内容
      </a>
      <aside className="sidebar" aria-label="主导航">
        <div className="sidebar-brand">
          <BrandMark />
          <div>
            <strong>Car Utils</strong>
            <span>车务管家</span>
          </div>
        </div>
        <button className="button button-primary sidebar-add" disabled={!vehicle} type="button" onClick={() => openEditor({ kind: "quick" })}>
          <Plus size={18} />
          记一笔
          <kbd>N</kbd>
        </button>
        <nav className="sidebar-nav">
          {navOrder.map((item) => (
            <a
              aria-current={item === page ? "page" : undefined}
              className={item === page ? "nav-item active" : "nav-item"}
              href={`#/${item}`}
              key={item}
              onClick={(event) => {
                event.preventDefault();
                navigate(item);
              }}
            >
              {pageMeta[item].icon}
              <span>{pageMeta[item].label}</span>
            </a>
          ))}
        </nav>
        <div className="sidebar-footer">
          <SyncIndicator snapshot={session.persistence} refreshing={session.refreshing} onRefresh={session.refresh} />
          <div className="sidebar-user">
            <span className="avatar" aria-hidden="true">
              {session.authUser?.displayName.slice(0, 1).toUpperCase()}
            </span>
            <div>
              <strong>{session.authUser?.displayName}</strong>
              <span>{session.authUser?.email}</span>
            </div>
            <button aria-label="退出登录" className="icon-button" title="退出登录" type="button" onClick={() => void session.logout()}>
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      <div className="main-column">
        <header className="topbar">
          <div className="topbar-leading">
            <span className="topbar-brand">
              <BrandMark size={28} />
            </span>
            <VehicleSwitcher />
          </div>
          <div className="topbar-actions">
            <button aria-label="搜索与快捷操作" className="search-trigger" type="button" onClick={onOpenPalette}>
              <Search size={16} />
              <span>搜索记录、跳转或执行操作</span>
              <kbd>⌘K</kbd>
            </button>
            <span className="topbar-sync">
              <SyncIndicator compact snapshot={session.persistence} refreshing={session.refreshing} onRefresh={session.refresh} />
            </span>
            <button
              aria-label="设置"
              className="icon-button topbar-settings"
              type="button"
              onClick={() => navigate("settings")}
            >
              <Settings size={18} />
            </button>
          </div>
        </header>

        <main className="page" id="main" tabIndex={-1}>
          {children}
        </main>
      </div>

      <nav className="tabbar" aria-label="底部导航">
        {(["home", "timeline"] as Page[]).map((item) => (
          <TabbarLink active={item === page} key={item} page={item} />
        ))}
        <button aria-label="记一笔" className="tabbar-add" disabled={!vehicle} type="button" onClick={() => openEditor({ kind: "quick" })}>
          <Plus size={26} />
        </button>
        {(["insights", "garage"] as Page[]).map((item) => (
          <TabbarLink active={item === page} key={item} page={item} />
        ))}
      </nav>
    </div>
  );
}

function TabbarLink({ page, active }: { page: Page; active: boolean }) {
  const { navigate } = useWorkspace();
  return (
    <a
      aria-current={active ? "page" : undefined}
      className={active ? "tabbar-item active" : "tabbar-item"}
      href={`#/${page}`}
      onClick={(event) => {
        event.preventDefault();
        navigate(page);
      }}
    >
      {pageMeta[page].icon}
      <span>{pageMeta[page].label}</span>
    </a>
  );
}

function VehicleSwitcher() {
  const { vehicle, vehicles, selectVehicle, navigate, openEditor } = useWorkspace();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!vehicle) {
    return (
      <button className="vehicle-switcher empty" type="button" onClick={() => openEditor({ kind: "vehicle" })}>
        <Car size={18} />
        <span>添加第一台车</span>
      </button>
    );
  }

  return (
    <div className="vehicle-switcher-wrap" ref={ref}>
      <button aria-expanded={open} aria-haspopup="menu" className="vehicle-switcher" type="button" onClick={() => setOpen((value) => !value)}>
        <span className="vehicle-switcher-icon">
          <Car size={18} />
        </span>
        <span className="vehicle-switcher-copy">
          <strong>{vehicle.nickname}</strong>
          <small>{[vehicle.plate, `${vehicle.brand} ${vehicle.model}`.trim()].filter(Boolean).join(" · ") || vehicle.energyType}</small>
        </span>
        <ChevronDown size={16} />
      </button>
      {open && (
        <div className="menu" role="menu">
          {vehicles.map((item) => (
            <button
              aria-checked={item.id === vehicle.id}
              className="menu-item"
              key={item.id}
              role="menuitemradio"
              type="button"
              onClick={() => {
                selectVehicle(item.id);
                setOpen(false);
              }}
            >
              <span>
                <strong>{item.nickname}</strong>
                <small>
                  {[item.plate, `${item.brand} ${item.model}`.trim()].filter(Boolean).join(" · ")}
                  {item.isArchived ? " · 已归档" : ""}
                </small>
              </span>
              {item.id === vehicle.id && <Check size={16} />}
            </button>
          ))}
          <div className="menu-divider" />
          <button
            className="menu-item"
            role="menuitem"
            type="button"
            onClick={() => {
              setOpen(false);
              openEditor({ kind: "vehicle" });
            }}
          >
            <span>
              <strong>添加车辆</strong>
            </span>
            <Plus size={16} />
          </button>
          <button
            className="menu-item"
            role="menuitem"
            type="button"
            onClick={() => {
              setOpen(false);
              navigate("garage");
            }}
          >
            <span>
              <strong>管理车库</strong>
            </span>
            <Warehouse size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

export function describePersistence(snapshot: PersistenceStatusSnapshot | null) {
  if (!snapshot) return { tone: "pending", label: "正在连接", detail: "" };
  switch (snapshot.status) {
    case "backend_connected":
    case "backend_persisted":
      return { tone: "ok", label: "已同步", detail: `已保存到本机数据库 · ${relativeTime(snapshot.updatedAt)}` };
    case "backend_empty_importing_legacy":
      return { tone: "pending", label: "正在导入", detail: "正在把浏览器中的旧数据写入数据库" };
    case "backend_unavailable_using_local_backup":
      return { tone: "warn", label: "离线", detail: "暂时连不上 Car Utils 服务，修改会先保存在浏览器，恢复后自动合并" };
    case "save_failed_local_backup_only":
      return { tone: "error", label: "未同步", detail: "保存到数据库失败，已暂存在浏览器。点击重试" };
  }
}

function SyncIndicator({
  snapshot,
  refreshing,
  onRefresh,
  compact = false,
}: {
  snapshot: PersistenceStatusSnapshot | null;
  refreshing: boolean;
  onRefresh: () => Promise<void>;
  compact?: boolean;
}) {
  const content = describePersistence(snapshot);
  const icon = refreshing ? (
    <LoaderCircle className="spin" size={15} />
  ) : content.tone === "ok" ? (
    <Check size={15} />
  ) : content.tone === "warn" ? (
    <CloudOff size={15} />
  ) : content.tone === "error" ? (
    <CircleAlert size={15} />
  ) : (
    <LoaderCircle className="spin" size={15} />
  );

  return (
    <button
      aria-label={`${content.label}，${content.detail}。点击刷新`}
      className={`sync-indicator tone-${content.tone}${compact ? " compact" : ""}`}
      disabled={refreshing}
      title={`${content.detail}\n点击从数据库重新读取`}
      type="button"
      onClick={() => void onRefresh()}
    >
      {icon}
      {!compact && <span>{refreshing ? "刷新中" : content.label}</span>}
      {!compact && !refreshing && <RefreshCw className="sync-refresh" size={13} />}
    </button>
  );
}
