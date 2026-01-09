import net from "net";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";

const base = Number(process.env.PORT || "1420");
const max = Number(process.env.PORT_MAX || "1430");

function findFreePort(start, end) {
  return new Promise((resolve, reject) => {
    let port = start;
    const tryPort = () => {
      if (port > end) return reject(new Error("No free port found"));
      const srv = net.createServer();
      srv.once("error", () => {
        port += 1;
        tryPort();
      });
      srv.once("listening", () => {
        srv.close(() => resolve(port));
      });
      srv.listen(port, "127.0.0.1");
    };
    tryPort();
  });
}

findFreePort(base, max)
  .then((port) => {
    console.log(`[auto-dev] Using port ${port}`);
    const devUrl = `http://127.0.0.1:${port}`;
    const tauriConfigPath = path.resolve("src-tauri", "tauri.conf.json");
    const tauriDevConfigPath = path.resolve("src-tauri", "tauri.conf.dev.json");
    const rawConfig = fs.readFileSync(tauriConfigPath, "utf8");
    const config = JSON.parse(rawConfig);
    config.build = config.build || {};
    config.build.devUrl = devUrl;
    if ("beforeDevCommand" in config.build) {
      delete config.build.beforeDevCommand;
    }
    fs.writeFileSync(tauriDevConfigPath, JSON.stringify(config, null, 2));
    console.log("[auto-dev] Starting Vite...");
    spawn(
      "cmd",
      ["/c", "start", "npm", "run", "dev:vite"],
      {
        stdio: "ignore",
        shell: true,
        env: { ...process.env, VITE_PORT: String(port), PORT: String(port) }
      }
    );

    setTimeout(() => {
      console.log("[auto-dev] Starting Tauri...");
      const child = spawn(
        "npm",
        ["run", "tauri:dev", "--", "--config", tauriDevConfigPath, "--no-dev-server-wait", "--port", String(port)],
        {
          stdio: "inherit",
          shell: true,
          env: {
            ...process.env,
            VITE_PORT: String(port),
            PORT: String(port),
            TAURI_DEV_URL: devUrl,
            TAURI_CONFIG: tauriDevConfigPath
          }
        }
      );
      child.on("exit", (code) => process.exit(code || 0));
    }, 1200);
  })
  .catch((err) => {
    console.error(`[auto-dev] ${err.message}`);
    process.exit(1);
  });
