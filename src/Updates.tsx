import { useEffect, useState } from "react";
import {
  Download,
  RefreshCw,
  ShieldCheck,
  ExternalLink,
  CheckCircle2,
  LoaderCircle,
} from "lucide-react";
export function Updates({ c }: { c: any }) {
  const [state, setState] = useState<any>();
  useEffect(() => {
    void window.luma
      .call("updateStatus")
      .then(setState)
      .catch(() => {});
    return window.luma.on("update", setState);
  }, []);
  if (!state) return null;
  const names: any = {
    idle: c.tr("Готов к проверке", "Ready to check"),
    checking: c.tr("Проверяем обновления…", "Checking for updates…"),
    available: c.tr("Новая версия найдена", "New version available"),
    downloading: c.tr("Скачиваем обновление…", "Downloading update…"),
    ready: c.tr("Обновление готово к установке", "Ready to install"),
    current: c.tr("Установлена последняя версия", "You are up to date"),
    error: c.tr("Проверка не завершена", "Unable to check"),
    development: c.tr(
      "Проверка доступна в установленной версии",
      "Available in the installed app",
    ),
  };
  return (
    <div className="settings-card update-card">
      <div className="setting-row">
        <div>
          <div className="eyebrow">LUMA UPDATES</div>
          <h3>{c.tr("Всегда актуальная Luma", "Always up to date")}</h3>
          <p>
            {c.tr(
              "Проверка при запуске и каждые 4 часа. Обновления скачиваются в фоне.",
              "Checks on startup and every 4 hours. Updates download in the background.",
            )}
          </p>
        </div>
        <span className="update-emblem">
          <ShieldCheck size={25} />
        </span>
      </div>
      <div className="update-status">
        <strong>{names[state.status]}</strong>
        <span>
          v{state.version}
          {state.nextVersion ? " → v" + state.nextVersion : ""}
        </span>
      </div>
      {state.status === "downloading" && (
        <div className="progress-bar">
          <span style={{ width: state.percent + "%" }} />
        </div>
      )}
      {state.error && <p className="error-text">{state.error}</p>}
      <div className="setting-row">
        <div>
          <strong>
            {c.tr(
              "Автоматически проверять и скачивать",
              "Automatically check and download",
            )}
          </strong>
          <p>
            {c.tr(
              "Установка — после нажатия кнопки перезапуска. Миры и сборки сохраняются.",
              "Install when you choose to restart. Worlds and instances are preserved.",
            )}
          </p>
        </div>
        <button
          role="switch"
          aria-checked={state.enabled}
          aria-label="Automatic launcher updates"
          className={"switch " + (state.enabled ? "on" : "")}
          onClick={() =>
            c.run(async () =>
              setState(
                await window.luma.call("setUpdatesEnabled", !state.enabled),
              ),
            )
          }
        >
          <span />
        </button>
      </div>
      <div className="panel-toolbar">
        <button
          className="secondary"
          disabled={[
            "development",
            "checking",
            "available",
            "downloading",
            "ready",
          ].includes(state.status)}
          onClick={() =>
            c.run(async () =>
              setState(await window.luma.call("checkLauncherUpdates")),
            )
          }
        >
          {state.status === "checking" ? (
            <LoaderCircle size={16} className="spin" />
          ) : (
            <RefreshCw size={16} />
          )}{" "}
          {c.tr("Проверить сейчас", "Check now")}
        </button>
        {state.status === "ready" && (
          <button
            className="primary"
            onClick={() =>
              c.run(() => window.luma.call("installLauncherUpdate"))
            }
          >
            <Download size={16} />
            {c.tr("Установить и перезапустить", "Install and restart")}
          </button>
        )}
        <button
          className="text-link"
          onClick={() =>
            window.luma.call(
              "openUrl",
              "https://github.com/PPERCHECK/LumaMinecraftLauncher/releases",
            )
          }
        >
          <ExternalLink size={14} />
          GitHub Releases
        </button>
      </div>
    </div>
  );
}
export function UpdateNotice({ c }: { c: any }) {
  const [state, setState] = useState<any>();
  useEffect(() => {
    void window.luma
      .call("updateStatus")
      .then(setState)
      .catch(() => {});
    return window.luma.on("update", setState);
  }, []);
  if (state?.status !== "ready") return null;
  return (
    <div className="update-notice">
      <CheckCircle2 size={19} />
      <div>
        <strong>Luma {state.nextVersion}</strong>
        <small>{c.tr("Обновление загружено", "Update downloaded")}</small>
      </div>
      <button
        className="primary"
        onClick={() => c.run(() => window.luma.call("installLauncherUpdate"))}
      >
        {c.tr("Перезапустить", "Restart")}
      </button>
    </div>
  );
}
