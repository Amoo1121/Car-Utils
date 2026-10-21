export type DevPortEnvironment = {
  CAR_UTILS_WEB_PORT?: string;
  CAR_UTILS_API_PORT?: string;
  CAR_UTILS_APP_PORT?: string;
};

export type DevPorts = {
  webPort: number;
  apiPort: number;
};

/**
 * The Vite dev server proxies `/api` to the always-on native service (port 4173 by default),
 * so development uses the same SQLite data as the installed app. Set CAR_UTILS_API_PORT
 * to point at a separate backend instead.
 */
export function resolveDevPorts(environment: DevPortEnvironment): DevPorts {
  const appPort = parsePort(environment.CAR_UTILS_APP_PORT, 4173, "CAR_UTILS_APP_PORT");
  return {
    webPort: parsePort(environment.CAR_UTILS_WEB_PORT, 5173, "CAR_UTILS_WEB_PORT"),
    apiPort: parsePort(environment.CAR_UTILS_API_PORT, appPort, "CAR_UTILS_API_PORT"),
  };
}

function parsePort(value: string | undefined, fallback: number, name: string) {
  if (value == null || value.trim() === "") return fallback;

  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new TypeError(`${name} must be an integer between 1 and 65535.`);
  }

  return port;
}
