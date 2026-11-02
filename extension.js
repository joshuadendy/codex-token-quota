
const vscode = require("vscode");
const { spawn } = require("node:child_process");
const readline = require("node:readline");

function readQuota(executablePath) {
  return new Promise((resolve, reject) => {
    const proc = spawn(executablePath, ["app-server"]);
    const lines = readline.createInterface({ input: proc.stdout });
    let done = false;

    const timeout = setTimeout(
      () => finish(new Error("Codex timed out")),
      10000
    );

    function finish(error, result) {
      if (done) return;
      done = true;
      clearTimeout(timeout);
      lines.close();
      proc.kill();
      if (error) reject(error);
      else resolve(result);
    }

    function send(message) {
      proc.stdin.write(JSON.stringify(message) + "\n");
    }

    proc.on("error", finish);
    proc.on("close", () =>
      finish(new Error("Codex exited before responding"))
    );

    lines.on("line", (line) => {
      let msg;
      try {
        msg = JSON.parse(line);
      } catch {
        return;
      }

      if (msg.id === 1) {
        if (msg.error) return finish(new Error(msg.error.message));
        send({ method: "initialized" });
        send({ id: 2, method: "account/rateLimits/read" });
      }

      if (msg.id === 2) {
        if (msg.error) return finish(new Error(msg.error.message));
        finish(null, msg.result);
      }
    });

    send({
      id: 1,
      method: "initialize",
      params: {
        clientInfo: {
          name: "personal_codex_quota_bar",
          title: "Codex Quota Bar",
          version: "0.0.4"
        }
      }
    });
  });
}

function activate(context) {
  const item = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );

  item.command = "codexQuota.refresh";
  item.text = "$(sync~spin) Codex";
  item.show();

  let updating = false;

  async function refresh() {
    if (updating) return;
    updating = true;

    try {
      const config = vscode.workspace.getConfiguration("codexQuota");
      const executablePath = config.get(
        "executablePath",
        "/opt/homebrew/bin/codex"
      );
      const result = await readQuota(executablePath);
      const limits =
        result.rateLimitsByLimitId?.codex ?? result.rateLimits;

      const remainingPercent = limits?.individualLimit?.remainingPercent;

      if (Number.isFinite(remainingPercent)) {
        const percent = Math.max(0, Math.min(100, remainingPercent));
        const { used, limit } = limits.individualLimit;

        item.text = `$(pulse) Codex ${Math.round(percent)}%`;
        item.tooltip =
          `Individual limit — ${used} of ${limit} used ` +
          `(${Math.round(percent)}% remaining)`;
        return;
      }

      const windows = [limits?.primary, limits?.secondary]
        .filter(w => Number.isFinite(w?.usedPercent));

      if (!windows.length) throw new Error("No quota available");

      const label = mins =>
        mins === 10080 ? "7d" :
        mins === 300 ? "5h" :
        mins == null ? "Quota" : `${mins}m`;

      item.text = "$(pulse) Codex " + windows
        .map(w => `${label(w.windowDurationMins)} ${w.usedPercent}%`)
        .join(" · ");

      item.tooltip = "Quota used — click to refresh";
    } catch (error) {
      item.text = "$(warning) Codex ?";
      item.tooltip = `Usage unavailable: ${error.message}`;
    } finally {
      updating = false;
    }
  }

  const command = vscode.commands.registerCommand(
    "codexQuota.refresh",
    refresh
  );

  const timer = setInterval(refresh, 60000);
  context.subscriptions.push(
    item,
    command,
    { dispose: () => clearInterval(timer) }
  );

  refresh();
}

module.exports = { activate };
