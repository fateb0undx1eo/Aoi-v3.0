const { spawn } = require("node:child_process");

const nextBin = require.resolve("next/dist/bin/next");
const port = process.env.PORT || "3002";
const hostname = process.env.HOST || "0.0.0.0";

const child = spawn(process.execPath, [nextBin, "start", "--hostname", hostname, "--port", port], {
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
