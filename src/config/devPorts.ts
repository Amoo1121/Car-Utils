export type DevPortEnvironment = {
  CAR_UTILS_WEB_PORT?: string;
  CAR_UTILS_API_PORT?: string;
};

export type DevPorts = {
  webPort: number;
  apiPort: number;
};

export function resolveDevPorts(environment: DevPortEnvironment): DevPorts {
  return {
    webPort: parsePort(environment.CAR_UTILS_WEB_PORT, 5173, "CAR_UTILS_WEB_PORT"),
    apiPort: parsePort(environment.CAR_UTILS_API_PORT, 3001, "CAR_UTILS_API_PORT"),
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
