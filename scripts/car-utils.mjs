#!/usr/bin/env node
// Car Utils 本机管理工具：安装为 macOS 后台服务、启动/停止、打开 App、迁移旧 Docker 数据。
// 只使用 Node 内置模块，便于在 launchd 和 .app 中直接调用。

import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { homedir, platform } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const HOME = homedir();
const LABEL = "com.carutils.server";
const DATA_DIR = process.env.CAR_UTILS_DATA_DIR || join(HOME, "Library", "Application Support", "Car Utils");
const DB_PATH = join(DATA_DIR, "car-utils.sqlite");
const BACKUP_DIR = join(DATA_DIR, "backups");
const LOG_DIR = join(HOME, "Library", "Logs", "Car Utils");
const PLIST_PATH = join(HOME, "Library", "LaunchAgents", `${LABEL}.plist`);
const APP_PATH = join(HOME, "Applications", "Car Utils.app");
const LEGACY_VOLUME = "car-utils_car-utils-sqlite";
const LEGACY_CONTAINERS = ["car-utils-web", "car-utils-server"];

const env = readDotEnv();
const NODE_PATH = stableNodePath();
const PORT = Number(env.CAR_UTILS_APP_PORT || 4173);
const HOST = env.CAR_UTILS_HOST || "0.0.0.0";
const APP_URL = `http://localhost:${PORT}/`;

const commands = {
  install,
  start,
  stop,
  restart,
  status,
  open: openApp,
  launch,
  logs,
  backup,
  migrate: migrateFromDocker,
  uninstall,
  help,
};

const command = process.argv[2] ?? "help";
if (!(command in commands)) {
  console.error(`未知命令：${command}\n`);
  help();
  process.exit(1);
}

try {
  await commands[command]();
} catch (error) {
  console.error(`\n✖ ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

function help() {
  console.log(`Car Utils 管理工具

用法：npm run car -- <命令>    或    node scripts/car-utils.mjs <命令>

  install     构建、迁移旧数据、安装为登录自启的后台服务，并创建 ~/Applications/Car Utils.app
  launch      确保服务运行后打开 App（Car Utils.app 调用的就是它）
  start       启动后台服务
  stop        停止后台服务（数据不会删除）
  restart     重启后台服务（更新代码后使用）
  status      查看运行状态与数据位置
  open        在浏览器 App 窗口中打开
  logs        查看最近日志
  backup      立即创建一份 SQLite 备份
  migrate     从旧 Docker 版复制数据（只复制，不删除 Docker 数据）
  uninstall   移除后台服务和 App 图标（保留全部数据）

数据目录：${DATA_DIR}
访问地址：${APP_URL}`);
}

async function install() {
  assertMac();
  step("检查运行环境");
  assertNodeVersion();

  step("构建前端与后端");
  build();

  // Stop the old containers first so no write can land in Docker after the copy.
  step("释放端口并停止旧版 Docker 容器（数据卷保留）");
  stopLegacyContainers();

  step("检查旧版数据");
  if (existsSync(DB_PATH)) {
    console.log(`  已存在本机数据库，跳过迁移：${DB_PATH}`);
  } else {
    await migrateFromDocker({ quiet: true });
  }

  step("安装后台服务");
  writeLaunchAgent();
  launchctlReload();
  await waitForHealth();

  step("创建 Car Utils.app");
  createAppBundle();

  console.log(`\n✔ 安装完成。
  · 打开方式：Launchpad / ~/Applications 中的「Car Utils」，或访问 ${APP_URL}
  · 服务会在登录 macOS 时自动启动，关闭终端不影响使用
  · 数据：${DB_PATH}
  · 自动备份：${BACKUP_DIR}（每天一份，保留 30 份）`);
  launchBrowser();
}

async function start() {
  assertMac();
  if (!existsSync(PLIST_PATH)) {
    throw new Error("后台服务尚未安装，请先运行 npm run car -- install");
  }
  launchctl(["bootstrap", `gui/${uid()}`, PLIST_PATH], { allowFailure: true });
  launchctl(["kickstart", `gui/${uid()}/${LABEL}`], { allowFailure: true });
  await waitForHealth();
  console.log(`✔ Car Utils 正在运行：${APP_URL}`);
}

function stop() {
  assertMac();
  launchctl(["bootout", `gui/${uid()}/${LABEL}`], { allowFailure: true });
  console.log("✔ 已停止。数据保留在", DATA_DIR);
  console.log("  注意：下次登录 macOS 时服务会自动启动；如需彻底移除请运行 uninstall。");
}

async function restart() {
  assertMac();
  if (!existsSync(PLIST_PATH)) throw new Error("后台服务尚未安装，请先运行 install。");
  writeLaunchAgent();
  launchctlReload();
  await waitForHealth();
  // Keep the launcher in sync too (node path or project location may have changed).
  if (existsSync(APP_PATH)) createAppBundle();
  console.log(`✔ 已重启：${APP_URL}`);
}

async function status() {
  const healthy = await isHealthy();
  console.log(`服务状态   ${healthy ? "● 运行中" : "○ 未运行"}`);
  console.log(`访问地址   ${APP_URL}`);
  console.log(`后台服务   ${existsSync(PLIST_PATH) ? "已安装（登录自启）" : "未安装"}`);
  console.log(`App 图标   ${existsSync(APP_PATH) ? APP_PATH : "未创建"}`);
  console.log(`数据库     ${existsSync(DB_PATH) ? DB_PATH : "尚未创建"}`);
  console.log(`备份目录   ${BACKUP_DIR}`);
  console.log(`日志目录   ${LOG_DIR}`);
}

async function launch() {
  if (!(await isHealthy())) {
    if (existsSync(PLIST_PATH)) {
      await start();
    } else {
      throw new Error("Car Utils 尚未安装。请在项目目录运行 npm run setup。");
    }
  }
  launchBrowser();
}

function openApp() {
  launchBrowser();
}

function logs() {
  const file = join(LOG_DIR, "server.log");
  if (!existsSync(file)) {
    console.log("暂无日志。");
    return;
  }
  const lines = readFileSync(file, "utf8").trimEnd().split("\n");
  console.log(lines.slice(-80).join("\n"));
}

async function backup() {
  if (!existsSync(DB_PATH)) throw new Error("尚未找到本机数据库。");
  mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+$/, "").replace("T", "-");
  const target = join(BACKUP_DIR, `car-utils-${stamp}-manual.sqlite`);
  const { DatabaseSync } = await import("node:sqlite");
  const database = new DatabaseSync(DB_PATH);
  try {
    database.exec(`VACUUM INTO '${target.replaceAll("'", "''")}'`);
  } finally {
    database.close();
  }
  console.log(`✔ 备份已写入：${target}`);
}

async function migrateFromDocker({ quiet = false } = {}) {
  if (existsSync(DB_PATH) && !process.argv.includes("--force")) {
    console.log(`本机数据库已存在：${DB_PATH}\n如确实需要用 Docker 数据覆盖，请加 --force（会先备份当前数据库）。`);
    return false;
  }
  if (!hasDocker()) {
    if (!quiet) console.log("未检测到可用的 Docker，跳过迁移。");
    else console.log("  未检测到 Docker 旧数据，将创建全新数据库。");
    return false;
  }

  const volumeExists = run("docker", ["volume", "inspect", LEGACY_VOLUME], { allowFailure: true }).ok;
  if (!volumeExists) {
    console.log("  未找到旧版 Docker 数据卷，将创建全新数据库。");
    return false;
  }

  mkdirSync(DATA_DIR, { recursive: true });
  if (existsSync(DB_PATH)) {
    mkdirSync(BACKUP_DIR, { recursive: true });
    copyFileSync(DB_PATH, join(BACKUP_DIR, `car-utils-before-migrate-${Date.now()}.sqlite`));
  }

  const temp = join(DATA_DIR, `.migrate-${Date.now()}.sqlite`);
  const snapshotScript =
    "const {DatabaseSync}=require('node:sqlite');" +
    "const d=new DatabaseSync('/data/car-utils.sqlite',{readOnly:true});" +
    "require('fs').rmSync('/out/snap.sqlite',{force:true});" +
    "d.exec(\"VACUUM INTO '/out/snap.sqlite'\");d.close();";

  const image = findLegacyImage();
  const outDir = dirname(temp);
  const result = run(
    "docker",
    [
      "run", "--rm",
      "-v", `${LEGACY_VOLUME}:/data:ro`,
      "-v", `${outDir}:/out`,
      "--entrypoint", "node",
      image,
      "--no-warnings", "-e", snapshotScript,
    ],
    { allowFailure: true },
  );
  const snapshot = join(outDir, "snap.sqlite");
  if (!result.ok || !existsSync(snapshot)) {
    throw new Error(`从 Docker 读取旧数据失败：${result.stderr || result.stdout}`);
  }
  renameSync(snapshot, temp);

  const { DatabaseSync } = await import("node:sqlite");
  const check = new DatabaseSync(temp, { readOnly: true });
  const integrity = check.prepare("PRAGMA integrity_check").get();
  const users = check.prepare("SELECT COUNT(*) AS count FROM auth_users").get();
  const stores = check.prepare("SELECT COUNT(*) AS count FROM user_stores").get();
  check.close();
  if (integrity?.integrity_check !== "ok") {
    rmSync(temp, { force: true });
    throw new Error("旧数据库完整性校验失败，已放弃迁移。Docker 中的数据未被改动。");
  }

  renameSync(temp, DB_PATH);
  console.log(`  ✔ 已从 Docker 复制数据：${users.count} 个账户，${stores.count} 份车辆账本`);
  console.log(`    Docker 数据卷 ${LEGACY_VOLUME} 原样保留，可作为额外备份。`);
  return true;
}

function uninstall() {
  assertMac();
  launchctl(["bootout", `gui/${uid()}/${LABEL}`], { allowFailure: true });
  rmSync(PLIST_PATH, { force: true });
  rmSync(APP_PATH, { recursive: true, force: true });
  console.log(`✔ 已移除后台服务与 App 图标。数据仍保留在：${DATA_DIR}`);
}

// ---------------------------------------------------------------------------

function build() {
  if (!existsSync(join(PROJECT_DIR, "node_modules"))) run("npm", ["install"], { cwd: PROJECT_DIR, inherit: true });
  if (!existsSync(join(PROJECT_DIR, "server", "node_modules"))) {
    run("npm", ["install"], { cwd: join(PROJECT_DIR, "server"), inherit: true });
  }
  run("npm", ["run", "build"], { cwd: PROJECT_DIR, inherit: true });
  run("npm", ["run", "build"], { cwd: join(PROJECT_DIR, "server"), inherit: true });
}

function writeLaunchAgent() {
  mkdirSync(dirname(PLIST_PATH), { recursive: true });
  mkdirSync(LOG_DIR, { recursive: true });
  mkdirSync(DATA_DIR, { recursive: true });
  const variables = {
    PORT: String(PORT),
    HOST,
    NODE_ENV: "production",
    CAR_UTILS_RUNTIME: "native",
    CAR_UTILS_DB_PATH: DB_PATH,
    CAR_UTILS_BACKUP_DIR: BACKUP_DIR,
    CAR_UTILS_STATIC_DIR: join(PROJECT_DIR, "dist"),
    AUTH_SESSION_DAYS: env.AUTH_SESSION_DAYS || "30",
    AUTH_COOKIE_SECURE: env.AUTH_COOKIE_SECURE || "false",
    ...(env.AUTH_PASSWORD_PEPPER ? { AUTH_PASSWORD_PEPPER: env.AUTH_PASSWORD_PEPPER } : {}),
  };
  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${xml(NODE_PATH)}</string>
    <string>--no-warnings</string>
    <string>${xml(join(PROJECT_DIR, "server", "dist", "index.js"))}</string>
  </array>
  <key>WorkingDirectory</key><string>${xml(join(PROJECT_DIR, "server"))}</string>
  <key>EnvironmentVariables</key>
  <dict>
${Object.entries(variables)
  .map(([key, value]) => `    <key>${key}</key><string>${xml(value)}</string>`)
  .join("\n")}
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>5</integer>
  <key>ProcessType</key><string>Background</string>
  <key>StandardOutPath</key><string>${xml(join(LOG_DIR, "server.log"))}</string>
  <key>StandardErrorPath</key><string>${xml(join(LOG_DIR, "server.log"))}</string>
</dict>
</plist>
`;
  writeFileSync(PLIST_PATH, plist);
}

function launchctlReload() {
  launchctl(["bootout", `gui/${uid()}/${LABEL}`], { allowFailure: true });
  // bootout is asynchronous; retry bootstrap briefly while launchd releases the label.
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const result = launchctl(["bootstrap", `gui/${uid()}`, PLIST_PATH], { allowFailure: true });
    if (result.ok) return;
    sleep(500);
  }
  launchctl(["bootstrap", `gui/${uid()}`, PLIST_PATH]);
}

function createAppBundle() {
  const contents = join(APP_PATH, "Contents");
  const macos = join(contents, "MacOS");
  const resources = join(contents, "Resources");
  rmSync(APP_PATH, { recursive: true, force: true });
  mkdirSync(macos, { recursive: true });
  mkdirSync(resources, { recursive: true });

  writeFileSync(
    join(contents, "Info.plist"),
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>Car Utils</string>
  <key>CFBundleDisplayName</key><string>Car Utils</string>
  <key>CFBundleIdentifier</key><string>com.carutils.launcher</string>
  <key>CFBundleVersion</key><string>2.0.0</string>
  <key>CFBundleShortVersionString</key><string>2.0.0</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleExecutable</key><string>car-utils</string>
  <key>CFBundleIconFile</key><string>AppIcon</string>
  <key>LSUIElement</key><true/>
  <key>LSMinimumSystemVersion</key><string>12.0</string>
</dict>
</plist>
`,
  );

  const launcher = join(macos, "car-utils");
  writeFileSync(
    launcher,
    `#!/bin/zsh
# Generated by scripts/car-utils.mjs — re-run "npm run car -- install" after moving the project.
exec "${NODE_PATH}" --no-warnings "${join(PROJECT_DIR, "scripts", "car-utils.mjs")}" launch >> "${join(LOG_DIR, "launcher.log")}" 2>&1
`,
  );
  chmodSync(launcher, 0o755);

  const icon = buildIcon(resources);
  if (!icon) console.log("  （未能生成图标，App 将使用系统默认图标）");
  run("touch", [APP_PATH], { allowFailure: true });
}

function buildIcon(resources) {
  const svg = join(PROJECT_DIR, "public", "app-icon.svg");
  if (!existsSync(svg)) return false;
  const work = join(DATA_DIR, ".icon-build");
  const iconset = join(work, "AppIcon.iconset");
  rmSync(work, { recursive: true, force: true });
  mkdirSync(iconset, { recursive: true });
  const rendered = run("qlmanage", ["-t", "-s", "1024", "-o", work, svg], { allowFailure: true });
  const png = join(work, "app-icon.svg.png");
  if (!rendered.ok || !existsSync(png)) return false;
  for (const size of [16, 32, 128, 256, 512]) {
    run("sips", ["-z", String(size), String(size), png, "--out", join(iconset, `icon_${size}x${size}.png`)], { allowFailure: true });
    run("sips", ["-z", String(size * 2), String(size * 2), png, "--out", join(iconset, `icon_${size}x${size}@2x.png`)], { allowFailure: true });
  }
  const result = run("iconutil", ["-c", "icns", iconset, "-o", join(resources, "AppIcon.icns")], { allowFailure: true });
  rmSync(work, { recursive: true, force: true });
  return result.ok;
}

function launchBrowser() {
  const preferred = (env.CAR_UTILS_BROWSER || "app").toLowerCase();
  if (platform() !== "darwin") {
    console.log(`请在浏览器打开：${APP_URL}`);
    return;
  }
  if (preferred !== "default") {
    // Chromium "app mode" gives a standalone window without tabs or address bar.
    const candidates = ["Google Chrome", "Microsoft Edge", "Brave Browser", "Arc", "Chromium"];
    for (const name of candidates) {
      if (!appInstalled(name)) continue;
      const result = run("open", ["-na", name, "--args", `--app=${APP_URL}`], { allowFailure: true });
      if (result.ok) return;
    }
  }
  run("open", [APP_URL], { allowFailure: true });
}

function appInstalled(name) {
  return ["/Applications", join(HOME, "Applications")].some((dir) => existsSync(join(dir, `${name}.app`)));
}

function stopLegacyContainers() {
  if (!hasDocker()) {
    console.log("  未运行 Docker，跳过。");
    return;
  }
  for (const container of LEGACY_CONTAINERS) {
    const inspect = run("docker", ["inspect", "-f", "{{.State.Running}}", container], { allowFailure: true });
    if (!inspect.ok) continue;
    // Disable auto-restart so the old web container does not reclaim the port after a reboot.
    run("docker", ["update", "--restart=no", container], { allowFailure: true });
    if (inspect.stdout.trim() === "true") {
      run("docker", ["stop", container], { allowFailure: true });
      console.log(`  已停止 ${container}（容器与数据卷均保留）`);
    }
  }
}

function findLegacyImage() {
  for (const image of ["car-utils-car-utils-server", "node:22-bookworm-slim", "node:22-alpine"]) {
    if (run("docker", ["image", "inspect", image], { allowFailure: true }).ok) return image;
  }
  return "node:22-alpine";
}

async function isHealthy() {
  try {
    const response = await fetch(`http://127.0.0.1:${PORT}/api/health`, { signal: AbortSignal.timeout(1500) });
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForHealth(timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isHealthy()) return;
    await new Promise((resolveWait) => setTimeout(resolveWait, 400));
  }
  throw new Error(`服务未能在 ${timeoutMs / 1000}s 内启动。请查看日志：${join(LOG_DIR, "server.log")}`);
}

function hasDocker() {
  return run("docker", ["info"], { allowFailure: true }).ok;
}

function launchctl(args, options = {}) {
  return run("launchctl", args, options);
}

function run(file, args, { allowFailure = false, cwd, inherit = false } = {}) {
  const result = spawnSync(file, args, {
    cwd,
    encoding: "utf8",
    stdio: inherit ? "inherit" : "pipe",
  });
  const ok = result.status === 0;
  if (!ok && !allowFailure) {
    throw new Error(`${file} ${args.join(" ")} 失败\n${result.stderr ?? ""}`);
  }
  return { ok, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

function uid() {
  return execFileSync("id", ["-u"], { encoding: "utf8" }).trim();
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function assertMac() {
  if (platform() !== "darwin") throw new Error("后台服务安装目前仅支持 macOS。其他系统可运行 npm run serve。");
}

function assertNodeVersion() {
  const major = Number(process.versions.node.split(".")[0]);
  if (major < 22) throw new Error(`需要 Node.js 22 或更高版本（当前 ${process.versions.node}）。`);
  console.log(`  Node.js ${process.versions.node} · ${NODE_PATH}`);
}

function step(message) {
  console.log(`\n▸ ${message}`);
}

function xml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function readDotEnv() {
  const values = { ...process.env };
  const file = join(PROJECT_DIR, ".env");
  if (!existsSync(file)) return values;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const value = match[2].replace(/^["']|["']$/g, "");
    if (!(match[1] in process.env)) values[match[1]] = value;
  }
  return values;
}

/** Homebrew's versioned Cellar path disappears on upgrade; prefer the stable opt/ symlink. */
function stableNodePath() {
  const match = process.execPath.match(/^(.*)\/Cellar\/([^/]+)\/[^/]+\/bin\/node$/);
  if (match) {
    const candidate = `${match[1]}/opt/${match[2]}/bin/node`;
    if (existsSync(candidate)) return candidate;
  }
  return process.execPath;
}
