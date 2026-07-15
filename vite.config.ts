import react from "@vitejs/plugin-react";
import {loadEnv} from "vite";
import {defineConfig} from "vitest/config";
import {resolveDevPorts} from "./src/config/devPorts";

export default defineConfig(({mode}) => {
    const environment = loadEnv(mode, process.cwd(), "");
    const ports = resolveDevPorts(environment);

    return {
        base: "./",
        plugins: [react()],
        server: {
            port: ports.webPort,
            strictPort: true,
            proxy: {
                "/api": `http://127.0.0.1:${ports.apiPort}`,
            },
        },
        test: {
            include: ["src/**/*.test.ts"],
        },
    };
});
