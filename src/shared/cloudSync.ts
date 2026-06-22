import {
  DATA_SCHEMA_VERSION,
  mergeStores,
  normalizeStore,
  type Store,
} from "./carData";

export const CLOUD_SYNC_CONFIG_KEY = "car-utils-cloud-sync-config-v1";

const DEFAULT_COLLECTION_NAME = "car_utils_sync";
const CLOUD_DOCUMENT_VERSION = 1;
const KDF_ITERATIONS = 120_000;

export type CloudSyncConfig = {
  provider: "cloudbase";
  envId: string;
  region: string;
  accessKey?: string;
  collectionName: string;
  syncKey: string;
};

export type CloudSyncResult = {
  mergedStore: Store;
  documentId: string;
  remoteFound: boolean;
  remoteUpdatedAt?: number;
  syncedAt: number;
};

type CloudSyncDocument = {
  app?: "car-utils";
  documentVersion?: number;
  syncDocumentId?: string;
  schemaVersion?: number;
  encrypted?: boolean;
  updatedAt?: number;
  store?: unknown;
  payload?: string;
  crypto?: {
    algorithm: "AES-GCM";
    kdf: "PBKDF2";
    hash: "SHA-256";
    iterations: number;
    salt: string;
    iv: string;
  };
};

export function createDefaultCloudSyncConfig(): CloudSyncConfig {
  return {
    provider: "cloudbase",
    envId: "",
    region: "ap-shanghai",
    accessKey: "",
    collectionName: DEFAULT_COLLECTION_NAME,
    syncKey: "",
  };
}

export function loadCloudSyncConfig(): CloudSyncConfig {
  if (typeof localStorage === "undefined") return createDefaultCloudSyncConfig();

  try {
    const raw = localStorage.getItem(CLOUD_SYNC_CONFIG_KEY);
    if (!raw) return createDefaultCloudSyncConfig();
    return normalizeCloudSyncConfig(JSON.parse(raw));
  } catch {
    return createDefaultCloudSyncConfig();
  }
}

export function saveCloudSyncConfig(config: CloudSyncConfig) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(CLOUD_SYNC_CONFIG_KEY, JSON.stringify(normalizeCloudSyncConfig(config)));
}

export function validateCloudSyncConfig(config: CloudSyncConfig) {
  const normalizedConfig = normalizeCloudSyncConfig(config);
  if (!normalizedConfig.envId) return "请填写 CloudBase 环境 ID。";
  if (!normalizedConfig.syncKey || normalizedConfig.syncKey.length < 8) {
    return "请填写至少 8 位的同步密钥。两台设备需要使用同一个密钥。";
  }
  if (!/^[A-Za-z][A-Za-z0-9_-]{1,63}$/.test(normalizedConfig.collectionName)) {
    return "集合名需要以字母开头，只能包含字母、数字、下划线或短横线。";
  }
  return "";
}

export async function syncStoreWithCloud(localStore: Store, config: CloudSyncConfig): Promise<CloudSyncResult> {
  const normalizedConfig = normalizeCloudSyncConfig(config);
  const validationError = validateCloudSyncConfig(normalizedConfig);
  if (validationError) throw new Error(validationError);

  ensureWebCrypto();

  const documentId = await makeSyncDocumentId(normalizedConfig.syncKey);
  const cloudbaseApp = await createCloudBaseClient(normalizedConfig);
  const database = cloudbaseApp.database();
  const documentRef = database.collection(normalizedConfig.collectionName).doc(documentId);
  const remoteDocument = await readCloudDocument(documentRef);
  const remoteStore = remoteDocument ? await readRemoteStore(remoteDocument, normalizedConfig.syncKey) : null;
  const syncedAt = Date.now();
  const mergedBase = remoteStore ? mergeStores(localStore, remoteStore) : normalizeStore(localStore);
  const mergedStore = normalizeStore({
    ...mergedBase,
    syncState: {
      ...(mergedBase.syncState ?? { pendingChanges: [], cloudEnabled: true }),
      pendingChanges: mergedBase.syncState?.pendingChanges ?? [],
      cloudEnabled: true,
      cloudUserId: documentId,
      lastPulledAt: syncedAt,
      lastPushedAt: syncedAt,
      lastSyncAt: syncedAt,
    },
  });
  const salt = remoteDocument?.crypto?.salt ? base64ToBytes(remoteDocument.crypto.salt) : undefined;
  const encryptedDocument = await encryptStore(mergedStore, normalizedConfig.syncKey, documentId, salt);

  await documentRef.set(encryptedDocument);

  return {
    mergedStore,
    documentId,
    remoteFound: Boolean(remoteStore),
    remoteUpdatedAt: remoteDocument?.updatedAt,
    syncedAt,
  };
}

function normalizeCloudSyncConfig(value: Partial<CloudSyncConfig> | unknown): CloudSyncConfig {
  const config = value && typeof value === "object" ? (value as Partial<CloudSyncConfig>) : {};
  return {
    provider: "cloudbase",
    envId: config.envId?.trim() ?? "",
    region: config.region?.trim() || "ap-shanghai",
    accessKey: config.accessKey?.trim() ?? "",
    collectionName: config.collectionName?.trim() || DEFAULT_COLLECTION_NAME,
    syncKey: config.syncKey ?? "",
  };
}

async function createCloudBaseClient(config: CloudSyncConfig) {
  const cloudbaseModule: any = await import("@cloudbase/js-sdk");
  const cloudbase = cloudbaseModule.default ?? cloudbaseModule;
  const app = cloudbase.init({
    env: config.envId,
    region: config.region,
    ...(config.accessKey ? { accessKey: config.accessKey } : {}),
  });

  if (!config.accessKey) {
    const authFactory = app.auth;
    const auth = typeof authFactory === "function" ? authFactory.call(app, { persistence: "local" }) : authFactory;
    if (auth?.signInAnonymously) {
      try {
        let loginState = null;
        try {
          loginState = auth.getLoginState ? await auth.getLoginState() : null;
        } catch {
          loginState = null;
        }

        if (!loginState) {
          const signInResult = await auth.signInAnonymously({});
          if (signInResult?.error) {
            throw new Error(getErrorMessage(signInResult.error));
          }
        }
      } catch (error) {
        throw new Error(`CloudBase 匿名登录失败：${getErrorMessage(error)}`);
      }
    }
  }

  return app;
}

async function readCloudDocument(documentRef: any): Promise<CloudSyncDocument | null> {
  try {
    const result = await documentRef.get();
    const data = result?.data;
    const document = Array.isArray(data) ? data[0] : data;
    return document && typeof document === "object" && Object.keys(document).length > 0
      ? (document as CloudSyncDocument)
      : null;
  } catch (error) {
    if (isMissingDocumentError(error)) return null;
    throw new Error(`读取云端数据失败：${getErrorMessage(error)}`);
  }
}

async function readRemoteStore(document: CloudSyncDocument, syncKey: string) {
  if (document.encrypted && document.payload && document.crypto) {
    return decryptStore(document, syncKey);
  }

  if (document.store) return normalizeStore(document.store);
  return null;
}

async function encryptStore(
  store: Store,
  syncKey: string,
  documentId: string,
  existingSalt?: Uint8Array,
): Promise<CloudSyncDocument> {
  const salt = existingSalt ?? crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveAesKey(syncKey, salt);
  const payload = new TextEncoder().encode(JSON.stringify(normalizeStore(store)));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: bytesToArrayBuffer(iv) },
    key,
    bytesToArrayBuffer(payload),
  );

  return {
    app: "car-utils",
    documentVersion: CLOUD_DOCUMENT_VERSION,
    syncDocumentId: documentId,
    schemaVersion: DATA_SCHEMA_VERSION,
    encrypted: true,
    updatedAt: Date.now(),
    crypto: {
      algorithm: "AES-GCM",
      kdf: "PBKDF2",
      hash: "SHA-256",
      iterations: KDF_ITERATIONS,
      salt: bytesToBase64(salt),
      iv: bytesToBase64(iv),
    },
    payload: bytesToBase64(new Uint8Array(encrypted)),
  };
}

async function decryptStore(document: CloudSyncDocument, syncKey: string) {
  if (!document.crypto?.salt || !document.crypto.iv || !document.payload) {
    throw new Error("云端同步文档缺少加密信息。");
  }

  try {
    const salt = base64ToBytes(document.crypto.salt);
    const iv = base64ToBytes(document.crypto.iv);
    const key = await deriveAesKey(syncKey, salt, document.crypto.iterations);
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: bytesToArrayBuffer(iv) },
      key,
      bytesToArrayBuffer(base64ToBytes(document.payload)),
    );
    return normalizeStore(JSON.parse(new TextDecoder().decode(decrypted)));
  } catch (error) {
    throw new Error(`无法解密云端数据，请检查同步密钥是否一致：${getErrorMessage(error)}`);
  }
}

async function deriveAesKey(syncKey: string, salt: Uint8Array, iterations = KDF_ITERATIONS) {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    bytesToArrayBuffer(new TextEncoder().encode(syncKey)),
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: bytesToArrayBuffer(salt),
      iterations,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function makeSyncDocumentId(syncKey: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    bytesToArrayBuffer(new TextEncoder().encode(`car-utils:${syncKey}`)),
  );
  return `car_utils_${bytesToHex(new Uint8Array(digest)).slice(0, 48)}`;
}

function ensureWebCrypto() {
  if (typeof crypto === "undefined" || !crypto.subtle || !crypto.getRandomValues) {
    throw new Error("云同步需要 HTTPS 或 localhost 环境，以启用浏览器加密能力。当前页面可以继续本地记录和 JSON 备份。");
  }
}

function bytesToHex(bytes: Uint8Array) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function bytesToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function isMissingDocumentError(error: unknown) {
  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes("not found") ||
    message.includes("not exist") ||
    message.includes("does not exist") ||
    message.includes("db_doc_not_found")
  );
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === "object") {
    const details = error as Record<string, unknown>;
    return String(details.msg ?? details.errMsg ?? details.error_description ?? details.error ?? details.code ?? "未知错误");
  }
  return String(error || "未知错误");
}
