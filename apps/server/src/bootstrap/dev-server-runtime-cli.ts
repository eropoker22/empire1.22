import { startDevServerRuntime } from "./dev-server-runtime";

interface DevRuntimeProcess {
  stdout: {
    write(message: string): void;
  };
  once(signal: "SIGINT" | "SIGTERM", listener: (signal: "SIGINT" | "SIGTERM") => void): void;
  exit(code: number): never;
}

const devProcess = (globalThis as { process?: DevRuntimeProcess }).process;

if (!devProcess) {
  throw new Error("Dev server runtime requires a Node-like process.");
}

const runtime = startDevServerRuntime();

const shutdown = (signal: "SIGINT" | "SIGTERM"): void => {
  runtime.stop();
  devProcess.stdout.write(`Empire Streets dev runtime stopped after ${signal}.\n`);
  devProcess.exit(0);
};

devProcess.once("SIGINT", shutdown);
devProcess.once("SIGTERM", shutdown);

devProcess.stdout.write("Empire Streets dev runtime tick loop started. Press Ctrl+C to stop.\n");
