import { Cloud, Database, Download, HardDrive, Laptop, Monitor, Moon, Palette, RefreshCw, Smartphone, Sun, Upload, UserRound } from "lucide-react";
import { useEffect, useState, type ChangeEvent, type ReactNode } from "react";
import { countStoreItems, createStoreBackup, mergeStores, parseStoreBackup, today, type StoreCounts } from "../../shared/carData";
import { loadCloudSyncConfig, saveCloudSyncConfig, syncStoreWithCloud, validateCloudSyncConfig, type CloudSyncConfig } from "../../shared/cloudSync";
import { createServerBackup, fetchSystemInfo, type SystemInfo } from "../../repositories/systemRepository";
import { describePersistence } from "../../app/Shell";
import { useWorkspace } from "../../app/workspace";
import { AccountManager } from "../auth/AccountManager";
import { Segmented, SelectField, TextField } from "../../ui/fields";
import { downloadFile, fileSize, relativeTime } from "../../ui/format";
import { useToast } from "../../ui/Toast";

const sections = [
  { id: "account", label: "账户", icon: <UserRound size={16} /> },
  { id: "appearance", label: "外观", icon: <Palette size={16} /> },
  { id: "data", label: "数据与备份", icon: <Database size={16} /> },
  { id: "devices", label: "多设备", icon: <Smartphone size={16} /> },
] as const;

export function SettingsPage({ sub }: { sub?: string }) {
  const { navigate } = useWorkspace();
  const active = sections.find((section) => section.id === sub)?.id ?? "account";
  return (
    <div className="page-stack">
      <header className="page-head">
        <div>
          <h1>设置</h1>
          <p>账户、外观、数据安全与多设备</p>
        </div>
      </header>
      <div className="settings-layout">
        <nav aria-label="设置分区" className="settings-nav">
          {sections.map((section) => (
            <a
              aria-current={section.id === active ? "page" : undefined}
              className={section.id === active ? "settings-nav-item active" : "settings-nav-item"}
              href={`#/settings/${section.id}`}
              key={section.id}
              onClick={(event) => {
                event.preventDefault();
                navigate("settings", section.id);
              }}
            >
              {section.icon}
              {section.label}
            </a>
          ))}
        </nav>
        <div className="settings-content">
          {active === "account" && <AccountSection />}
          {active === "appearance" && <AppearanceSection />}
          {active === "data" && <DataSection />}
          {active === "devices" && <DevicesSection />}
        </div>
      </div>
    </div>
  );
}

function SettingsCard({ title, icon, description, children }: { title: string; icon?: ReactNode; description?: ReactNode; children: ReactNode }) {
  return (
    <section className="card settings-card">
      <header className="card-head">
        <h2>
          {icon}
          {title}
        </h2>
      </header>
      {description && <p className="card-description">{description}</p>}
      {children}
    </section>
  );
}

function AccountSection() {
  const { session } = useWorkspace();
  if (!session.authUser) return null;
  return <AccountManager onPasswordChanged={session.clear} onProfileUpdated={session.updateAuthUser} user={session.authUser} />;
}

function AppearanceSection() {
  const { theme, setTheme } = useWorkspace();
  return (
    <SettingsCard description="跟随系统时，会随 macOS / iOS 的深色模式自动切换。" icon={<Palette size={17} />} title="主题">
      <Segmented
        label="主题"
        options={[
          { value: "system", label: "跟随系统", icon: <Monitor size={15} /> },
          { value: "light", label: "浅色", icon: <Sun size={15} /> },
          { value: "dark", label: "深色", icon: <Moon size={15} /> },
        ]}
        value={theme}
        onChange={setTheme}
      />
      <p className="card-description">快捷键：N 记一笔 · F 加油 · W 洗车 · E 费用 · ⌘K 搜索与命令</p>
    </SettingsCard>
  );
}

function formatCounts(counts: StoreCounts) {
  return `${counts.vehicles} 台车、${counts.fuelRecords} 条加油、${counts.washRecords} 条洗车、${counts.expenseRecords} 条费用、${counts.washProducts} 种耗材`;
}

function DataSection() {
  const { store, session } = useWorkspace();
  const toast = useToast();
  const [system, setSystem] = useState<SystemInfo | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const counts = countStoreItems(store);
  const persistence = describePersistence(session.persistence);

  useEffect(() => {
    void fetchSystemInfo().then(setSystem);
  }, []);

  async function backupNow() {
    setBusy(true);
    try {
      await createServerBackup();
      setSystem(await fetchSystemInfo());
      toast("已创建数据库快照");
    } catch (error) {
      toast({ message: error instanceof Error ? error.message : "备份失败", tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  function exportJson() {
    downloadFile(`car-utils-backup-${today()}.json`, JSON.stringify(createStoreBackup(store), null, 2), "application/json");
    toast("已导出 JSON 备份");
  }

  async function importJson(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    try {
      const incoming = parseStoreBackup(await file.text());
      const incomingCounts = countStoreItems(incoming);
      if (!window.confirm(`备份包含 ${formatCounts(incomingCounts)}。\n\n导入会按记录合并（同一条记录保留较新的版本），不会删除现有数据。继续？`)) return;
      const next = session.replaceStore(mergeStores(session.storeRef.current, incoming));
      toast(`导入完成，现在共有 ${formatCounts(countStoreItems(next))}`);
    } catch (error) {
      toast({ message: error instanceof Error ? error.message : "导入失败", tone: "error" });
    }
  }

  return (
    <>
      <SettingsCard icon={<HardDrive size={17} />} title="本机数据库">
        <dl className="info-list">
          <div><dt>状态</dt><dd className={`tone-text-${persistence.tone}`}>{persistence.label} · {persistence.detail}</dd></div>
          <div><dt>内容</dt><dd>{formatCounts(counts)}</dd></div>
          {system && (
            <>
              <div><dt>数据库</dt><dd className="mono">{system.databasePath}</dd></div>
              <div><dt>运行方式</dt><dd>{system.runtime === "native" ? "macOS 后台服务（登录自动启动）" : system.runtime === "docker" ? "Docker" : "开发模式"} · v{system.version}</dd></div>
            </>
          )}
        </dl>
        <div className="button-row">
          <button className="button button-soft" disabled={session.refreshing} type="button" onClick={() => void session.refresh()}>
            <RefreshCw className={session.refreshing ? "spin" : undefined} size={16} /> 重新读取
          </button>
        </div>
      </SettingsCard>

      <SettingsCard
        description={system?.backupDirectory ? <>服务每天自动为数据库拍一次快照，保留最近 30 份。位置：<span className="mono">{system.backupDirectory}</span></> : "当前运行方式未启用自动快照，请定期导出 JSON。"}
        icon={<Database size={17} />}
        title="自动备份"
      >
        {system?.backups.length ? (
          <ul className="simple-list">
            {system.backups.slice(0, 5).map((backup) => (
              <li key={backup.name}>
                <span className="mono">{backup.name}</span>
                <small>{relativeTime(backup.createdAt)} · {fileSize(backup.size)}</small>
              </li>
            ))}
          </ul>
        ) : system === undefined ? (
          <p className="card-description">正在读取…</p>
        ) : null}
        {system?.backupDirectory && (
          <div className="button-row">
            <button className="button button-soft" disabled={busy} type="button" onClick={() => void backupNow()}>
              立即备份
            </button>
          </div>
        )}
      </SettingsCard>

      <SettingsCard description="JSON 备份可以在任何设备上导入。导入是合并，不会覆盖或删除现有记录。" icon={<Download size={17} />} title="导入 / 导出">
        <div className="button-row">
          <button className="button button-primary" type="button" onClick={exportJson}>
            <Download size={16} /> 导出 JSON
          </button>
          <label className="button button-soft file-button">
            <Upload size={16} /> 导入备份
            <input accept="application/json,.json" type="file" onChange={(event) => void importJson(event)} />
          </label>
        </div>
      </SettingsCard>
    </>
  );
}

function DevicesSection() {
  const { session, store } = useWorkspace();
  const toast = useToast();
  const [system, setSystem] = useState<SystemInfo | null>(null);
  const [config, setConfig] = useState<CloudSyncConfig>(() => loadCloudSyncConfig());
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    void fetchSystemInfo().then(setSystem);
  }, []);

  function updateConfig<K extends keyof CloudSyncConfig>(key: K, value: CloudSyncConfig[K]) {
    setConfig((current) => ({ ...current, [key]: value }));
  }

  async function sync() {
    const error = validateCloudSyncConfig(config);
    if (error) {
      toast({ message: error, tone: "error" });
      return;
    }
    saveCloudSyncConfig(config);
    setSyncing(true);
    try {
      const result = await syncStoreWithCloud(store, config);
      const next = session.replaceStore(result.mergedStore);
      toast(`${result.remoteFound ? "已与云端合并" : "已创建云端同步文档"}：${formatCounts(countStoreItems(next))}`);
    } catch (syncError) {
      toast({ message: syncError instanceof Error ? syncError.message : "云同步失败", tone: "error" });
    } finally {
      setSyncing(false);
    }
  }

  return (
    <>
      <SettingsCard
        description="手机和这台 Mac 连同一个 Wi-Fi 时，在手机浏览器打开下面的地址并登录即可，数据实时共用这台电脑上的数据库。iPhone 可在 Safari 分享菜单中「添加到主屏幕」。"
        icon={<Laptop size={17} />}
        title="局域网访问"
      >
        {system?.lanUrls.length ? (
          <ul className="simple-list">
            {system.lanUrls.map((url) => (
              <li key={url}>
                <span className="mono">{url}</span>
                <button
                  className="button button-soft button-sm"
                  type="button"
                  onClick={() => {
                    void navigator.clipboard?.writeText(url);
                    toast("已复制地址");
                  }}
                >
                  复制
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="card-description">{system ? "未检测到局域网地址。" : "正在检测…"}</p>
        )}
        <p className="card-hint">安全提示：局域网内的设备都能看到登录页，请使用强密码。只想本机访问可在 .env 中设置 CAR_UTILS_HOST=127.0.0.1 后执行 npm run car -- restart。</p>
      </SettingsCard>

      <SettingsCard
        description="出门在外时，可通过腾讯云 CloudBase 同步一份端到端加密的副本。电脑和手机填写相同的环境 ID、集合名和同步密钥即可。同步是先拉取再合并，不会简单覆盖。"
        icon={<Cloud size={17} />}
        title="CloudBase 云同步"
      >
        <form
          className="editor-form"
          onSubmit={(event) => {
            event.preventDefault();
            void sync();
          }}
        >
          <div className="editor-row">
            <TextField label="环境 ID" value={config.envId} onChange={(value) => updateConfig("envId", value)} />
            <SelectField
              label="地域"
              options={[
                { value: "ap-shanghai", label: "上海" },
                { value: "ap-guangzhou", label: "广州" },
                { value: "ap-beijing", label: "北京" },
                { value: "ap-singapore", label: "新加坡" },
              ]}
              value={config.region}
              onChange={(value) => updateConfig("region", value)}
            />
          </div>
          <TextField autoComplete="off" hint="用于加密数据，忘记后无法解密云端副本" label="同步密钥" type="password" value={config.syncKey} onChange={(value) => updateConfig("syncKey", value)} />
          <div className="editor-row">
            <TextField label="集合名" value={config.collectionName} onChange={(value) => updateConfig("collectionName", value)} />
            <TextField autoComplete="off" label="Access Key（可选）" type="password" value={config.accessKey ?? ""} onChange={(value) => updateConfig("accessKey", value)} />
          </div>
          <div className="button-row">
            <button className="button button-primary" disabled={syncing} type="submit">
              <RefreshCw className={syncing ? "spin" : undefined} size={16} /> {syncing ? "同步中…" : "立即同步"}
            </button>
            <button
              className="button button-ghost"
              type="button"
              onClick={() => {
                saveCloudSyncConfig(config);
                toast("配置已保存");
              }}
            >
              仅保存配置
            </button>
          </div>
        </form>
      </SettingsCard>
    </>
  );
}
