export type UpdateState = {
  status:
    | "idle"
    | "checking"
    | "available"
    | "downloading"
    | "ready"
    | "current"
    | "error"
    | "development";
  version: string;
  nextVersion?: string;
  percent: number;
  error?: string;
  enabled: boolean;
  lastChecked?: string;
};
export const releaseSource = {
  provider: "github" as const,
  owner: "PPERCHECK",
  repo: "LumaMinecraftLauncher",
  private: false,
};
export class UpdateController {
  state: UpdateState;
  constructor(
    private updater: any,
    version: string,
    private packaged: boolean,
    enabled: boolean,
    private emit: (s: UpdateState) => void,
    private busy: () => boolean,
  ) {
    this.state = {
      status: packaged ? "idle" : "development",
      version,
      percent: 0,
      enabled,
    };
    updater.autoDownload = true;
    updater.autoInstallOnAppQuit = false;
    updater.allowDowngrade = false;
    updater.allowPrerelease = false;
    updater.setFeedURL(releaseSource);
    updater.on("checking-for-update", () =>
      this.set({ status: "checking", error: undefined }),
    );
    updater.on("update-available", (v: any) =>
      this.set({ status: "available", nextVersion: v.version, percent: 0 }),
    );
    updater.on("update-not-available", () =>
      this.set({
        status: "current",
        nextVersion: undefined,
        lastChecked: new Date().toISOString(),
      }),
    );
    updater.on("download-progress", (p: any) =>
      this.set({ status: "downloading", percent: p.percent }),
    );
    updater.on("update-downloaded", (v: any) =>
      this.set({
        status: "ready",
        nextVersion: v.version,
        percent: 100,
        lastChecked: new Date().toISOString(),
      }),
    );
    updater.on("error", () =>
      this.set({
        status: "error",
        error:
          "Не удалось получить обновление из GitHub Releases. Проверьте интернет и наличие опубликованного релиза с latest.yml. / Update unavailable: check your connection and GitHub release assets.",
      }),
    );
  }
  private set(p: Partial<UpdateState>) {
    Object.assign(this.state, p);
    this.emit({ ...this.state });
  }
  enable(value: boolean) {
    this.set({ enabled: value });
  }
  async check() {
    if (!this.packaged) return this.state;
    if (
      ["checking", "available", "downloading", "ready"].includes(
        this.state.status,
      )
    )
      return this.state;
    this.set({
      status: "checking",
      error: undefined,
      lastChecked: new Date().toISOString(),
    });
    try {
      await this.updater.checkForUpdates();
    } catch {
      this.set({
        status: "error",
        error:
          "GitHub Releases: обновление недоступно. Проверьте сеть и наличие latest.yml. / Check connection and release metadata.",
      });
    }
    return this.state;
  }
  install() {
    if (this.state.status !== "ready")
      throw Error("Обновление ещё не загружено / Update not downloaded");
    if (this.busy())
      throw Error(
        "Сначала закройте игру и дождитесь загрузок / Stop games and wait for downloads",
      );
    this.updater.quitAndInstall(true, true);
  }
}
