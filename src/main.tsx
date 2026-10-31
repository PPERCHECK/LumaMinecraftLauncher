import React, { useEffect, useState, useCallback, useRef } from "react";
import { createRoot } from "react-dom/client";
import { Updates, UpdateNotice } from "./Updates";
import {
  House,
  Boxes,
  Compass,
  ScanEye,
  Server,
  Download,
  Settings2,
  Plus,
  Play,
  ChevronDown,
  ChevronRight,
  ArrowUpRight,
  Search,
  X,
  Minus,
  Square,
  Check,
  FolderOpen,
  Clock3,
  ArrowDownToLine,
  RefreshCw,
  ShieldCheck,
  Palette,
  Globe2,
  Terminal,
  MoreHorizontal,
  Trash2,
  Copy,
  LoaderCircle,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  SlidersHorizontal,
  HardDrive,
  PackageOpen,
  Upload,
  Users,
  ExternalLink,
  Save,
  CircleHelp,
  Monitor,
  Zap,
  FileText,
  RotateCcw,
  CheckCheck,
} from "lucide-react";
import type {
  State,
  Instance,
  Project,
  ProjectVersion,
  Job,
  Settings,
  Version,
  Loader,
} from "./shared";
import { Logo } from "./Art";
import { Photo, photoNames, photos } from "./Photos";
import "./style.css";
const raw = (method: string, data?: any) => window.luma.call(method, data);
const nav = [
  ["home", House, "Главная", "Home"],
  ["instances", Boxes, "Мои сборки", "Instances"],
  ["catalog", Compass, "Каталог", "Discover"],
  ["cheats", ScanEye, "Читы", "Client mods"],
  ["servers", Server, "Серверы", "Servers"],
  ["friends", Users, "Друзья", "Friends"],
  ["downloads", Download, "Загрузки", "Downloads"],
  ["settings", Settings2, "Настройки", "Settings"],
  ["horizon", CircleHelp, "Horizon", "Horizon"],
] as const;
function PlayerAvatar({ account }: { account?: any }) {
  return (
    <div
      className={"avatar " + (account?.skin ? "skin-face" : "")}
      style={
        account?.skin
          ? { backgroundImage: `url("${account.skin}")` }
          : undefined
      }
    >
      {account?.skin ? null : account ? (
        account.name.slice(0, 2).toUpperCase()
      ) : (
        <Users size={20} />
      )}
    </div>
  );
}
const fmt = (n: number) =>
  n >= 1e6
    ? (n / 1e6).toFixed(1) + "M"
    : n >= 1000
      ? (n / 1000).toFixed(1) + "K"
      : String(n);
const size = (n: number) =>
  n >= 1024 ** 3
    ? (n / 1024 ** 3).toFixed(1) + " GB"
    : n >= 1024 ** 2
      ? (n / 1024 ** 2).toFixed(1) + " MB"
      : (n / 1024).toFixed(0) + " KB";
const texts: Record<string, [string, string]> = {
  create: ["Создать сборку", "Create instance"],
  import: ["Импортировать", "Import"],
  play: ["Играть", "Play"],
  selected: ["Выбранная сборка", "Selected instance"],
  account: ["Аккаунт", "Account"],
  all: ["Все", "All"],
  install: ["Установить", "Install"],
  cancel: ["Отмена", "Cancel"],
  save: ["Сохранить", "Save"],
  name: ["Название", "Name"],
  version: ["Версия Minecraft", "Minecraft version"],
  loader: ["Загрузчик", "Mod loader"],
  search: [
    "Поиск модов, сборок и новых идей…",
    "Search mods, packs and new ideas…",
  ],
  empty: ["Здесь начинается твоя история", "Your story starts here"],
  addAccount: ["Добавить аккаунт", "Add account"],
  back: ["Назад", "Back"],
  open: ["Открыть", "Open"],
  settings: ["Настройки", "Settings"],
  backup: ["Резервная копия", "Backup"],
  mods: ["Моды", "Mods"],
  config: ["Конфигурации", "Configuration"],
  logs: ["Консоль", "Console"],
  manage: ["Управление", "Manage"],
  delete: ["Удалить", "Delete"],
};
const translations: Record<string, Record<string, string>> = {
  uk: { Home: "Головна", Instances: "Мої збірки", Discover: "Каталог", Servers: "Сервери", Friends: "Друзі", Downloads: "Завантаження", Settings: "Налаштування", Play: "Грати", "Create instance": "Створити збірку", Language: "Мова", "Play together.": "Грайте разом." },
  de: { Home: "Start", Instances: "Instanzen", Discover: "Katalog", Servers: "Server", Friends: "Freunde", Downloads: "Downloads", Settings: "Einstellungen", Play: "Spielen", "Create instance": "Instanz erstellen", Language: "Sprache", "Play together.": "Gemeinsam spielen." },
  fr: { Home: "Accueil", Instances: "Instances", Discover: "Catalogue", Servers: "Serveurs", Friends: "Amis", Downloads: "Téléchargements", Settings: "Paramètres", Play: "Jouer", "Create instance": "Créer une instance", Language: "Langue", "Play together.": "Jouez ensemble." },
  es: { Home: "Inicio", Instances: "Instancias", Discover: "Catálogo", Servers: "Servidores", Friends: "Amigos", Downloads: "Descargas", Settings: "Ajustes", Play: "Jugar", "Create instance": "Crear instancia", Language: "Idioma", "Play together.": "Juega en compañía." },
  pl: { Home: "Główna", Instances: "Instancje", Discover: "Katalog", Servers: "Serwery", Friends: "Znajomi", Downloads: "Pobieranie", Settings: "Ustawienia", Play: "Graj", "Create instance": "Utwórz instancję", Language: "Język", "Play together.": "Grajcie razem." },
  pt_br: { Home: "Início", Instances: "Instâncias", Discover: "Catálogo", Servers: "Servidores", Friends: "Amigos", Downloads: "Downloads", Settings: "Configurações", Play: "Jogar", "Create instance": "Criar instância", Language: "Idioma", "Play together.": "Joguem juntos." },
  zh_cn: { Home: "主页", Instances: "游戏实例", Discover: "内容库", Servers: "服务器", Friends: "好友", Downloads: "下载", Settings: "设置", Play: "开始游戏", "Create instance": "创建实例", Language: "语言", "Play together.": "一起游玩。" },
};
function App() {
  const [s, setS] = useState<State | null>(null),
    [page, setPage] = useState("home"),
    [modal, setModal] = useState<string | null>(null),
    [edit, setEdit] = useState<string>(""),
    [jobs, setJobs] = useState<Job[]>([]),
    [toast, setToast] = useState<{ text: string; error?: boolean } | null>(
      null,
    ),
    [auth, setAuth] = useState<any>(null),
    [fatal, setFatal] = useState("");
  const first = useRef(true);
  const language = s?.settings.language || "ru";
  const en = language !== "ru";
  const localize = (eng: string) => translations[language]?.[eng] || eng;
  const t = (k: string) => en ? localize(texts[k]?.[1] || k) : texts[k]?.[0] || k;
  const tr = (ru: string, eng: string) => (en ? localize(eng) : ru);
  const notify = (text: string, error = false) => {
    setToast({ text, error });
  };
  const run = async (fn: () => Promise<any>, message?: string) => {
    try {
      const r = await fn();
      if (message) notify(message);
      return r;
    } catch (e) {
      notify((e as Error).message, true);
      return null;
    }
  };
  const reload = useCallback(async () => {
    const state = await raw("state");
    setS(state);
    if (first.current) {
      setPage(state.settings.startPage);
      first.current = false;
    }
  }, []);
  useEffect(() => {
    if (!window.luma) {
      setFatal(
        "Запустите Luma Launcher.exe или npm run dev. Для запуска игры требуется десктопное приложение.",
      );
      return;
    }
    void reload().catch((e) => setFatal(e.message));
    void raw("jobs").then(setJobs);
    const off = [
      window.luma.on("refresh", () => void reload()),
      window.luma.on("jobs", setJobs),
      window.luma.on("auth", setAuth),
      window.luma.on("game-exit", (d) => {
        if (d.code)
          notify(
            tr(
              "Игра завершилась с ошибкой. Откройте консоль сборки.",
              "Game exited with an error. Open instance console.",
            ),
            true,
          );
      }),
    ];
    return () => off.forEach((f) => f());
  }, [reload]);
  useEffect(() => {
    if (toast) {
      const id = setTimeout(() => setToast(null), 6500);
      return () => clearTimeout(id);
    }
  }, [toast]);
  useEffect(() => {
    if (!s) return;
    const a = s.settings;
    document.documentElement.dataset.theme = a.theme;
    document.documentElement.dataset.motion = String(a.motion);
    document.documentElement.dataset.density = a.density;
    document.documentElement.style.setProperty("--accent", a.accent);
    document.documentElement.style.setProperty("--glow-blur", a.blur + "px");
    document.documentElement.style.setProperty(
      "--panel-opacity",
      String(a.opacity),
    );
    document.documentElement.style.zoom = String(a.scale);
    document.documentElement.lang = a.language;
  }, [s?.settings]);
  if (fatal)
    return (
      <div className="fatal">
        <Logo />
        <h1>Luma</h1>
        <p>{fatal}</p>
      </div>
    );
  if (!s)
    return (
      <div className="splash">
        <Logo />
        <span>Luma</span>
        <LoaderCircle className="spin" />
      </div>
    );
  const current = s.instances.find((i) => i.id === s.activeInstance),
    account = s.accounts.find((a) => a.id === s.activeAccount),
    activeJobs = jobs.filter((j) => ["running", "queued"].includes(j.status));
  const openInstance = (id: string) => {
    setEdit(id);
    setModal("instance");
  };
  const play = (id?: string, server?: string) => {
    if (!id) {
      setModal("create");
      return;
    }
    if (!account) {
      setModal("accounts");
      return;
    }
    void run(
      () => raw("play", { id, server }),
      tr("Запуск добавлен в очередь", "Launch queued"),
    );
  };
  const ctx = {
    s,
    en,
    t,
    tr,
    run,
    notify,
    reload,
    openInstance,
    play,
    setModal,
    setPage,
  };
  if (!s.settings.onboardingDone)
    return <Onboarding c={ctx} account={account} auth={auth} />;
  return (
    <div
      className={"app " + (!s.settings.sidebar ? "small-sidebar" : "")}
      style={
        s.settings.background
          ? {
              backgroundImage: `linear-gradient(var(--app-veil),var(--app-veil)),url("${s.settings.background.startsWith("photo:") ? photos[s.settings.background.slice(6)] : s.settings.background}")`,
            }
          : undefined
      }
    >
      <aside className="sidebar">
        <button className="brand" onClick={() => setPage("home")}>
          <span className="brand-symbol">
            <Logo />
          </span>
          <span className="brand-name">
            luma<span>LAUNCHER</span>
          </span>
        </button>
        <div className="nav-caption">
          {tr("ТВОЁ ПРОСТРАНСТВО", "YOUR SPACE")}
        </div>
        <nav>
          {nav.map(([id, Icon, ru, eng], n) => (
            <React.Fragment key={id}>
              {(id === "downloads" || id === "horizon") && <div className="nav-separator" />}
              <button
                className={"nav-item " + (page === id ? "active" : "")}
                onClick={() => setPage(id)}
                title={en ? eng : ru}
              >
                <Icon size={19} />
                <span>{en ? localize(eng) : ru}</span>
                {id === "downloads" && activeJobs.length > 0 && (
                  <b className="nav-count">{activeJobs.length}</b>
                )}
                {id === "cheats" && <span className="tiny">LAB</span>}
                {id === "horizon" && <span className="tiny">?</span>}
              </button>
            </React.Fragment>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="edition">
            <span className="status-dot" />
            <span>Minecraft Java Edition</span>
            <small>v0.4.0</small>
          </div>
          <button
            className="account-button"
            onClick={() => setModal("accounts")}
          >
            <PlayerAvatar account={account} />
            <span>
              <strong>
                {account?.name || tr("Добавить аккаунт", "Add account")}
              </strong>
              <small>
                {account
                  ? {
                      local: tr("Локальный профиль", "Local profile"),
                      microsoft: "Microsoft",
                      ely: "Ely.by",
                    }[account.type]
                  : tr("Выбери свой способ входа", "Choose how to sign in")}
              </small>
            </span>
            <ChevronDown size={16} />
          </button>
        </div>
      </aside>
      <section className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            Luma <ChevronRight size={13} />
            <strong>{en ? localize(String(nav.find((x) => x[0] === page)?.[3] || "")) : nav.find((x) => x[0] === page)?.[2]}</strong>
          </div>
          <div className="top-actions">
            <button
              className="key-button"
              onClick={() => setPage("settings")}
            >
              <Globe2 size={14} />
              {language.replace("_", "-").toUpperCase()}
            </button>
            <span className="top-divider" />
            <button
              className="window-button"
              aria-label="Minimize"
              onClick={() => raw("window", "minimize")}
            >
              <Minus size={15} />
            </button>
            <button
              className="window-button"
              aria-label="Maximize"
              onClick={() => raw("window", "maximize")}
            >
              <Square size={12} />
            </button>
            <button
              className="window-button close"
              aria-label="Close"
              onClick={() => raw("window", "close")}
            >
              <X size={17} />
            </button>
          </div>
        </header>
        <main className="main">
          <div className="page-inner">
            {page === "home" && (
              <Home
                {...ctx}
                current={current}
                account={account}
                jobs={activeJobs}
              />
            )}
            {page === "instances" && <Instances {...ctx} />}
            {(page === "catalog" || page === "cheats") && (
              <CatalogView key={page} {...ctx} cheats={page === "cheats"} />
            )}
            {page === "servers" && <Servers {...ctx} />}
            {page === "friends" && <Friends {...ctx} />}
            {page === "downloads" && <Downloads {...ctx} jobs={jobs} />}
            {page === "settings" && <SettingsView {...ctx} />}
            {page === "horizon" && <Horizon {...ctx} />}
            <footer>
              <span>
                <Logo /> Luma Launcher
              </span>
              <span>
                {tr("Твой мир начинается здесь.", "Your world starts here.")}
              </span>
              <span>
                JAVA EDITION <span className="footer-dot">•</span> 0.4.0
              </span>
            </footer>
          </div>
        </main>
      </section>
      <UpdateNotice c={ctx} />
      {modal && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setModal(null);
          }}
        >
          <section
            className={"modal " + (modal === "instance" ? "wide" : "")}
            role="dialog"
            aria-modal="true"
          >
            <button
              className="modal-close icon-button"
              aria-label="Close dialog"
              onClick={() => setModal(null)}
            >
              <X size={21} />
            </button>
            {modal === "create" && (
              <CreateInstance {...ctx} close={() => setModal(null)} />
            )}{" "}
            {modal === "accounts" && <Accounts {...ctx} />}{" "}
            {modal === "instance" && <InstancePanel {...ctx} id={edit} />}
          </section>
        </div>
      )}
      {auth && (
        <div className="auth-float">
          <ShieldCheck size={22} />
          <div>
            <strong>{tr("Вход Microsoft", "Microsoft sign in")}</strong>
            <p>
              {tr(
                "Введите код на странице в браузере",
                "Enter this code in your browser",
              )}
            </p>
            <button
              className="device-code"
              onClick={() => {
                void navigator.clipboard.writeText(auth.code);
                notify(tr("Код скопирован", "Code copied"));
              }}
            >
              {auth.code}
              <Copy size={15} />
            </button>
            <button
              className="text-link"
              onClick={() => raw("openUrl", auth.url)}
            >
              {tr("Открыть страницу входа", "Open sign in page")}{" "}
              <ArrowUpRight size={14} />
            </button>
          </div>
        </div>
      )}
      {toast && (
        <div className={"toast " + (toast.error ? "error" : "")}>
          {toast.error ? (
            <AlertTriangle size={20} />
          ) : (
            <CheckCircle2 size={20} />
          )}
          <span>{toast.text}</span>
          <button onClick={() => setToast(null)} aria-label="Dismiss">
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
type Ctx = any;
function Onboarding({ c, account, auth }: { c: Ctx; account?: any; auth?: any }) {
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<"microsoft" | "ely" | "local">("microsoft");
  const [name, setName] = useState("");
  const [clientId, setClientId] = useState("");
  const [secret, setSecret] = useState("");
  const [theme, setTheme] = useState(c.s.settings.theme);
  const [accent, setAccent] = useState(c.s.settings.accent);
  const [cover, setCover] = useState("aurora");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const finish = async () => {
    await raw("settings", { onboardingDone: true });
    await c.reload();
  };
  const nextAfterCreate = () => {
    if (account?.type === "microsoft") setStep(3);
    else void finish();
  };
  const signIn = async () => {
    setBusy(true);
    setError("");
    try {
      if (mode === "local") await raw("addLocal", { name });
      else if (mode === "microsoft") {
        if (!clientId.trim()) throw Error(c.tr("Укажите Microsoft Client ID вашего приложения.", "Enter your Microsoft app Client ID."));
        await raw("settings", { msClientId: clientId.trim() });
        await raw("loginMicrosoft");
      } else {
        if (!clientId.trim() || !secret.trim()) throw Error(c.tr("Укажите Ely.by Client ID и Client Secret.", "Enter Ely.by Client ID and Client Secret."));
        await raw("settings", { elyClientId: clientId.trim() });
        await raw("setKey", { key: "elySecret", value: secret.trim() });
        await raw("loginEly");
      }
      await c.reload();
      setStep(1);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };
  const saveAppearance = async () => {
    setBusy(true);
    setError("");
    try {
      await raw("settings", { theme, accent });
      await raw("backgroundPreset", cover);
      await c.reload();
      setStep(2);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };
  return <div className="onboarding" style={{ backgroundImage: `linear-gradient(90deg,#0b0c16ec,#0b0c1680),url('${photos[cover]}')` }}>
    <div className="onboarding-top"><Logo /><strong>luma</strong><span>{c.tr("ПЕРВЫЙ ЗАПУСК", "FIRST LAUNCH")}</span></div>
    <div className="onboarding-panel">
      <div className="onboarding-progress">{[0,1,2,3].map(n => <i key={n} className={n <= step ? "active" : ""} />)}</div>
      {step === 0 && <>
        <div className="eyebrow">WELCOME TO LUMA</div>
        <h1>{c.tr("Добро пожаловать в лаунчер Luma", "Welcome to Luma Launcher")}</h1>
        <p>{c.tr("Выберите, как войти в игру. Аккаунт можно сменить позже.", "Choose how to sign in. You can change accounts later.")}</p>
        {account ? <div className="info-box"><CheckCircle2 size={18}/>{account.name}</div> : <>
          <div className="onboarding-accounts">
            {([ ["microsoft","Microsoft"], ["ely","Ely.by"], ["local",c.tr("Без лицензии","Offline profile")] ] as const).map(([id,title]) => <button key={id} className={mode === id ? "chosen" : ""} onClick={() => {setMode(id);setClientId("");setError("");}}>{title}</button>)}
          </div>
          {mode === "local" ? <label>{c.tr("Игровой ник", "Player name")}<input value={name} maxLength={16} onChange={e => setName(e.target.value)} placeholder="Player" /></label> : <>
            <label>{mode === "microsoft" ? "Microsoft Client ID" : "Ely.by Client ID"}<input value={clientId} onChange={e => setClientId(e.target.value)} placeholder={c.tr("ID приложения OAuth", "OAuth application ID")}/></label>
            {mode === "ely" && <label>Ely.by Client Secret<input type="password" value={secret} onChange={e => setSecret(e.target.value)} /></label>}
            <p className="fine-print">{mode === "microsoft" ? c.tr("Откроется защищённая страница Microsoft. Для входа нужен Client ID зарегистрированного приложения.", "Microsoft's secure sign-in page opens. A registered app Client ID is required.") : c.tr("Вход через страницу Ely.by. Client Secret хранится в защищённом хранилище Windows.", "Sign in through Ely.by. The Client Secret is stored in Windows secure storage.")}</p>
          </>}
        </>}
        {error && <p className="error-text">{error}</p>}
        <div className="onboarding-actions">{account ? <button className="primary" onClick={() => setStep(1)}>{c.tr("Продолжить", "Continue")} <ChevronRight size={17}/></button> : <button className="primary" disabled={busy || (mode === "local" && !name)} onClick={signIn}>{busy ? <LoaderCircle className="spin" size={17}/> : <ShieldCheck size={17}/>} {c.tr("Войти", "Sign in")}</button>}<button className="secondary" onClick={() => setStep(1)}>{c.tr("Позже", "Later")}</button></div>
      </>}
      {step === 1 && <>
        <div className="eyebrow">MAKE IT YOURS</div><h1>{c.tr("Настроим лаунчер", "Make it yours")}</h1>
        <p>{c.tr("Выберите атмосферу. Остальные параметры доступны в настройках в любое время.", "Choose an atmosphere. More settings remain available anytime.")}</p>
        <div className="onboarding-gallery">{photoNames.map(v => <button key={v} className={cover === v ? "chosen" : ""} onClick={() => setCover(v)}><Photo variant={v}/></button>)}</div>
        <div className="onboarding-controls"><label>{c.tr("Тема", "Theme")}<select value={theme} onChange={e => setTheme(e.target.value as any)}><option value="dark">{c.tr("Тёмная", "Dark")}</option><option value="light">{c.tr("Светлая", "Light")}</option></select></label><label>{c.tr("Акцент", "Accent")}<input type="color" value={accent} onChange={e => setAccent(e.target.value)}/></label></div>
        {error && <p className="error-text">{error}</p>}
        <div className="onboarding-actions"><button className="primary" disabled={busy} onClick={saveAppearance}>{c.tr("Сохранить и продолжить", "Save and continue")} <ChevronRight size={17}/></button></div>
      </>}
      {step === 2 && <>
        <div className="eyebrow">YOUR FIRST WORLD</div><h1>{c.tr("Создай первую сборку", "Create your first instance")}</h1>
        <p>{c.tr("Выберите версию Minecraft и загрузчик модов. Файлы загрузятся при первом запуске.", "Choose a Minecraft version and mod loader. Files download on first launch.")}</p>
        <div className="onboarding-create"><CreateInstance {...c} close={nextAfterCreate}/></div>
        <button className="secondary" onClick={nextAfterCreate}>{c.tr("Создать позже", "Create later")}</button>
      </>}
      {step === 3 && <>
        <div className="eyebrow">MINECRAFT BEDROCK</div><h1>{c.tr("Ещё один мир ждёт", "Another world awaits")}</h1>
        <p>{c.tr("Вы вошли через Microsoft. Если ваш аккаунт имеет право на Bedrock Edition, установите её через официальный Minecraft Launcher или Microsoft Store.", "You signed in with Microsoft. If your account owns Bedrock Edition, install it through the official Minecraft Launcher or Microsoft Store.")}</p>
        <div className="onboarding-actions"><button className="primary" onClick={() => raw("openUrl", "https://www.minecraft.net/en-us/download")}>{c.tr("Скачать Bedrock", "Get Bedrock")} <ExternalLink size={17}/></button><button className="secondary" onClick={finish}>{c.tr("Готово", "Done")}</button></div>
      </>}
    </div>
    {auth && <div className="auth-float"><ShieldCheck size={22}/><div><strong>{c.tr("Вход Microsoft", "Microsoft sign in")}</strong><p>{c.tr("Введите код на странице Microsoft", "Enter the code on Microsoft's page")}</p><button className="device-code" onClick={() => navigator.clipboard.writeText(auth.code)}>{auth.code}<Copy size={15}/></button><button className="text-link" onClick={() => raw("openUrl", auth.url)}>{c.tr("Открыть страницу входа", "Open sign in page")} <ExternalLink size={14}/></button></div></div>}
  </div>;
}
function Horizon(c: Ctx) {
  const [release, setRelease] = useState<any>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const refresh = () => raw("horizonRelease").then(setRelease).catch((e: Error) => setError(e.message));
  useEffect(() => { void refresh(); }, []);
  const get = async () => {
    setBusy(true);
    try { const job = await raw("downloadHorizon"); if (job) c.notify(c.tr("Horizon добавлен в загрузки", "Horizon added to downloads")); }
    catch (e) { c.notify((e as Error).message, true); }
    finally { setBusy(false); }
  };
  return <>
    <Heading eyebrow="EXPERIMENTAL · HORIZON" title={c.tr("Minecraft на Rust", "Minecraft in Rust")} description={c.tr("Экспериментальный независимый проект. Его официальный лаунчер устанавливает сборки Horizon и проверяет обновления GitHub.", "An independent experimental project. Its official launcher installs Horizon builds and checks GitHub for updates.")}/>
    <div className="horizon-hero"><Photo variant="night"/><div><span className="eyebrow">HORIZON RUST</span><h2>{c.tr("Новый взгляд на знакомый мир", "A new take on a familiar world")}</h2><p>{c.tr("Скачайте официальный лаунчер Horizon для Windows. Он подготовит игру из вашей собственной копии Minecraft Java Edition и будет обновлять её отдельно от Luma.", "Download Horizon's official Windows launcher. It prepares the game from your own Minecraft Java Edition copy and updates it separately from Luma.")}</p><div className="horizon-actions"><button className="primary" disabled={busy || !release} onClick={get}><ArrowDownToLine size={17}/>{busy ? c.tr("Подготовка…", "Preparing…") : c.tr("Скачать Horizon", "Download Horizon")}</button><button className="secondary" onClick={() => raw("openUrl", "https://playhorizon.dev/docs/install")}><ExternalLink size={16}/>{c.tr("Инструкция", "Instructions")}</button></div></div></div>
    <div className="horizon-meta"><div><strong>{release?.tag || "—"}</strong><span>{c.tr("Последний релиз лаунчера", "Latest launcher release")}</span></div><div><strong>{release ? size(release.size) : "—"}</strong><span>Windows x64 · ZIP</span></div><button className="secondary" onClick={() => void refresh()}><RefreshCw size={15}/>{c.tr("Проверить", "Refresh")}</button></div>
    {error && <p className="error-text">{error}</p>}
    <div className="info-box"><CircleHelp size={19}/><span>{c.tr("Horizon пока не запускается внутри Luma. После загрузки распакуйте ZIP и откройте horizon-launcher.exe. Обновления Horizon обслуживает его собственный лаунчер.", "Horizon does not launch inside Luma yet. Extract the ZIP and open horizon-launcher.exe. Horizon's launcher handles its own updates.")}</span></div>
  </>;
}
function Heading({ eyebrow, title, description, children }: any) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      <div className="heading-actions">{children}</div>
    </div>
  );
}
function Empty({ icon: Icon = Boxes, title, description, children }: any) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Icon size={26} />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {children}
    </div>
  );
}
function Badge({ children, tone = "" }: any) {
  return <span className={"badge " + tone}>{children}</span>;
}
function Home(c: Ctx) {
  const { s, t, tr, current, account, setModal, setPage, play, openInstance } =
    c;
  const [projects, setProjects] = useState<Project[]>([]);
  const [catalogError, setCatalogError] = useState("");
  const [manifest, setManifest] = useState<any>(null);
  useEffect(() => {
    raw("catalogSearch", { source: "modrinth", type: "mod", sort: "popular" })
      .then((r) => {
        setProjects(r.projects.slice(0, 4));
        setCatalogError(r.errors.join(" "));
      })
      .catch((e) => setCatalogError(e.message));
    raw("versions")
      .then(setManifest)
      .catch(() => {});
  }, []);
  const running = current && s.running.includes(current.id);
  return (
    <>
      <Heading
        eyebrow={tr("ПРИЯТНО ВИДЕТЬ ТЕБЯ СНОВА", "GOOD TO HAVE YOU HERE")}
        title={tr("Давай поиграем.", "Let’s play.")}
      >
        <button
          className="secondary"
          onClick={() =>
            raw("importPack").catch((e: any) => c.notify(e.message, true))
          }
        >
          <Download size={16} />
          {t("import")}
        </button>
        <button className="primary" onClick={() => setModal("create")}>
          <Plus size={17} />
          {t("create")}
        </button>
      </Heading>
      {account?.type === "microsoft" && <div className="bedrock-prompt"><span><strong>Minecraft Bedrock Edition</strong><small>{tr("У вас есть Microsoft аккаунт. Проверьте доступность Bedrock в официальном лаунчере.", "You have a Microsoft account. Check Bedrock availability in the official launcher.")}</small></span><button className="secondary" onClick={() => raw("openUrl", "https://www.minecraft.net/en-us/download")}>{tr("Скачать", "Download")} <ExternalLink size={15}/></button></div>}
      <section className="hero">
        {current?.cover?.startsWith("data:") ? <img className="photo" src={current.cover} alt="" /> : <Photo variant={current?.cover} />}
        <div className="hero-shade" />
        <div className="hero-content">
          <div className="hero-label">
            <span className="status-dot" /> MINECRAFT JAVA EDITION{" "}
            <span className="hero-line" />
            {current
              ? current.loader
              : tr("БЕСКОНЕЧНЫЕ ВОЗМОЖНОСТИ", "INFINITE POSSIBILITIES")}
          </div>
          <h2>
            {current ? (
              current.name
            ) : (
              <>
                {tr("Твой мир.", "Your world.")}
                <br />
                <span>{tr("Твои правила.", "Your rules.")}</span>
              </>
            )}
          </h2>
          <p>
            {current
              ? current.description ||
                tr(
                  "Всё готово к новому приключению. Осталось только начать.",
                  "Ready for a new adventure. Make it yours.",
                )
              : tr(
                  "Собирай, исследуй и меняй Minecraft под себя.\nВсе твои приключения — в одном месте.",
                  "Build, explore and make Minecraft your own.\nAll your adventures, in one place.",
                )}
          </p>
          <div className="hero-meta">
            <Badge>
              {current?.version || manifest?.latest?.release || "Java Edition"}
            </Badge>
            <Badge>{current?.loader || "Vanilla"}</Badge>
            {current && (
              <span>
                <Clock3 size={13} />
                {Math.floor(current.minutes / 60)} {tr("ч", "h")}{" "}
                {current.minutes % 60} {tr("мин", "min")}
              </span>
            )}
          </div>
          <div className="hero-actions">
            <button
              className="play-button"
              onClick={() =>
                running ? raw("stop", current.id) : play(current?.id)
              }
            >
              {running ? (
                <Square size={18} fill="currentColor" />
              ) : (
                <Play size={20} fill="currentColor" />
              )}
              {running
                ? tr("Остановить", "Stop")
                : current
                  ? t("play")
                  : tr("Начать приключение", "Start your adventure")}
              <span>
                {current
                  ? current.version
                  : tr("Создать сборку", "Create instance")}
                <ArrowUpRight size={14} />
              </span>
            </button>
            {current && (
              <button
                className="hero-settings"
                onClick={() => openInstance(current.id)}
                aria-label="Instance settings"
              >
                <SlidersHorizontal size={21} />
              </button>
            )}
          </div>
        </div>
        <div className="hero-bottom">
          <span>EXPLORE. CREATE. REPEAT.</span>
          <span>✦</span>
        </div>
      </section>
      <div className="home-stats">
        <button onClick={() => setPage("instances")}>
          <span className="stat-icon">
            <Boxes size={19} />
          </span>
          <div>
            <strong>{s.instances.length}</strong>
            <small>{tr("твоих сборок", "your instances")}</small>
          </div>
          <ChevronRight size={16} />
        </button>
        <button onClick={() => setModal("accounts")}>
          <span className="stat-icon green">
            <ShieldCheck size={19} />
          </span>
          <div>
            <strong>
              {account?.name || tr("Твой профиль", "Your profile")}
            </strong>
            <small>{account ? account.type : t("addAccount")}</small>
          </div>
          <ChevronRight size={16} />
        </button>
        <button onClick={() => setPage("downloads")}>
          <span className="stat-icon pink">
            <HardDrive size={19} />
          </span>
          <div>
            <strong>
              {c.jobs.length
                ? tr("Идёт загрузка", "Downloading")
                : tr("Всё под контролем", "All systems ready")}
            </strong>
            <small>
              {c.jobs.length
                ? c.jobs[0].phase
                : tr("Загрузки и обновления", "Downloads and updates")}
            </small>
          </div>
          <ChevronRight size={16} />
        </button>
      </div>
      <div className="section-title">
        <div>
          <h2>
            {tr("Мои сборки", "Your instances")}{" "}
            <span className="count">{s.instances.length}</span>
          </h2>
          <p>
            {tr(
              "Каждому приключению — свой мир.",
              "A world for every adventure.",
            )}
          </p>
        </div>
        <button className="text-link" onClick={() => setPage("instances")}>
          {tr("Все сборки", "All instances")}
          <ArrowUpRight size={15} />
        </button>
      </div>
      {s.instances.length ? (
        <div className="instance-grid home-grid">
          {s.instances.slice(0, 3).map((i: Instance) => (
            <InstanceCard key={i.id} i={i} {...c} />
          ))}
          <button className="create-card" onClick={() => setModal("create")}>
            <span>
              <Plus size={23} />
            </span>
            <strong>{t("create")}</strong>
            <small>{tr("Что исследуем сегодня?", "Where to next?")}</small>
          </button>
        </div>
      ) : (
        <div className="welcome-strip">
          <div className="empty-icon">
            <Boxes size={25} />
          </div>
          <div>
            <h3>
              {tr(
                "Место для твоей первой сборки",
                "Room for your first instance",
              )}
            </h3>
            <p>
              {tr(
                "Выбери версию и загрузчик. Luma установит игру и подходящую Java.",
                "Choose a version and loader. Luma installs the game and the right Java.",
              )}
            </p>
          </div>
          <button className="secondary" onClick={() => setModal("create")}>
            {t("create")}
            <Plus size={16} />
          </button>
        </div>
      )}
      <div className="section-title">
        <div>
          <h2>
            {tr("Сделай Minecraft своим", "Make Minecraft yours")}{" "}
            <Sparkles size={17} />
          </h2>
          <p>
            {tr(
              "Популярное в Modrinth. Из официального каталога, прямо сейчас.",
              "Popular on Modrinth. Live from the official catalog.",
            )}
          </p>
        </div>
        <button className="text-link" onClick={() => setPage("catalog")}>
          {tr("В каталог", "Discover more")}
          <ArrowUpRight size={15} />
        </button>
      </div>
      <div className="recommend-grid">
        {projects.map((p) => (
          <button
            key={p.id}
            className="mini-project"
            onClick={() => setPage("catalog")}
          >
            {p.icon ? <img src={p.icon} /> : <Boxes />}
            <div>
              <strong>{p.title}</strong>
              <small>
                {fmt(p.downloads)} {tr("загрузок", "downloads")}
              </small>
            </div>
            <ArrowUpRight size={16} />
          </button>
        ))}
      </div>
      {catalogError && <p className="hint warning">{catalogError}</p>}
    </>
  );
}
function InstanceCard({ i, ...c }: Ctx) {
  return (
    <article
      className={
        "instance-card " + (c.s.activeInstance === i.id ? "selected" : "")
      }
    >
      <button className="cover" onClick={() => c.openInstance(i.id)}>
        {i.cover.startsWith("data:") ? (
          <img src={i.cover} />
        ) : (
          <Photo variant={i.cover} />
        )}
        <div className="cover-badges">
          <Badge>{i.loader}</Badge>
          {c.s.activeInstance === i.id && (
            <Badge tone="selected-badge">
              <Check size={11} />
              {c.tr("Выбрана", "Selected")}
            </Badge>
          )}
        </div>
      </button>
      <div className="instance-info">
        <button className="instance-name" onClick={() => c.openInstance(i.id)}>
          {i.name}
        </button>
        <div className="instance-sub">
          <span>{i.version}</span>
          <span>•</span>
          <span>
            {i.mods.length} {c.tr("модов", "mods")}
          </span>
          <button
            className="icon-button"
            aria-label="Manage instance"
            onClick={() => c.openInstance(i.id)}
          >
            <MoreHorizontal size={18} />
          </button>
        </div>
        <div className="instance-card-actions">
          <button
            className="secondary"
            onClick={() => c.run(() => raw("selectInstance", i.id))}
          >
            {c.s.activeInstance === i.id ? (
              <Check size={15} />
            ) : (
              <ChevronRight size={15} />
            )}{" "}
            {c.s.activeInstance === i.id
              ? c.tr("Выбрана", "Selected")
              : c.tr("Выбрать", "Select")}
          </button>
          <button
            className="icon-play"
            aria-label="Play instance"
            onClick={() => c.play(i.id)}
          >
            <Play size={15} fill="currentColor" />
          </button>
        </div>
      </div>
    </article>
  );
}
function Instances(c: Ctx) {
  const [q, setQ] = useState("");
  return (
    <>
      <Heading
        eyebrow={c.tr("БИБЛИОТЕКА", "LIBRARY")}
        title={c.tr("Мои сборки", "Your instances")}
        description={c.tr(
          "От чистой ваниллы до мира, который ты придумал сам.",
          "From pure vanilla to a world of your own.",
        )}
      >
        <button
          className="secondary"
          onClick={() => c.run(() => raw("importPack"))}
        >
          <Download size={16} />
          {c.t("import")}
        </button>
        <button className="primary" onClick={() => c.setModal("create")}>
          <Plus size={17} />
          {c.t("create")}
        </button>
      </Heading>
      <div className="search-box">
        <Search size={18} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={c.tr("Найти свою сборку…", "Find your instance…")}
        />
      </div>
      {c.s.instances.length ? (
        <div className="instance-grid">
          {c.s.instances
            .filter((i: Instance) =>
              i.name.toLowerCase().includes(q.toLowerCase()),
            )
            .map((i: Instance) => (
              <InstanceCard key={i.id} i={i} {...c} />
            ))}
        </div>
      ) : (
        <Empty
          title={c.t("empty")}
          description={c.tr(
            "Создай сборку или импортируй .mrpack / CurseForge ZIP. Никаких общих папок и потерянных миров.",
            "Create an instance or import a .mrpack / CurseForge ZIP. Every world gets its own folder.",
          )}
        >
          <button className="primary" onClick={() => c.setModal("create")}>
            <Plus size={17} />
            {c.t("create")}
          </button>
        </Empty>
      )}
    </>
  );
}
function CreateInstance(c: Ctx) {
  const [manifest, setManifest] = useState<any>(),
    [err, setErr] = useState(""),
    [busy, setBusy] = useState(false),
    [name, setName] = useState(""),
    [version, setVersion] = useState(""),
    [loader, setLoader] = useState<Loader>("vanilla"),
    [lv, setLv] = useState(""),
    [lvs, setLvs] = useState<string[]>([]),
    [lbusy, setLbusy] = useState(false),
    [channel, setChannel] = useState("release"),
    [filter, setFilter] = useState("");
  useEffect(() => {
    raw("versions")
      .then((v) => {
        setManifest(v);
        setVersion(v.latest.release);
      })
      .catch((e) => setErr(e.message));
  }, []);
  useEffect(() => {
    let active = true;
    setLv("");
    setLvs([]);
    if (loader === "vanilla" || !version) return;
    setLbusy(true);
    raw("loaders", { version, loader })
      .then((v) => {
        if (active) {
          setLvs(v);
          setLv(v[0] || "");
        }
      })
      .catch((e) => active && setErr(e.message))
      .finally(() => active && setLbusy(false));
    return () => {
      active = false;
    };
  }, [version, loader]);
  const submit = async (importFolder = false) => {
    setBusy(true);
    try {
      await raw(importFolder ? "importFolder" : "createInstance", {
        name: name || "Minecraft " + version,
        version,
        loader,
        loaderVersion: lv,
      });
      c.close();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="modal-symbol">
        <Boxes size={27} />
      </div>
      <div className="eyebrow">A NEW ADVENTURE</div>
      <h2>{c.t("create")}</h2>
      <p className="modal-intro">
        {c.tr(
          "Твоя версия. Твои моды. Отдельное место для каждого мира.",
          "Your version. Your mods. A separate home for every world.",
        )}
      </p>
      <label>
        {c.t("name")}
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={c.tr("Моё новое приключение", "My next adventure")}
        />
      </label>
      <div className="form-row">
        <label>
          {c.tr("Тип версии", "Release channel")}
          <select
            value={channel}
            onChange={(e) => {
              setChannel(e.target.value);
              setFilter("");
            }}
          >
            <option value="release">Release</option>
            <option value="snapshot">Snapshot</option>
            <option value="old_beta">Beta</option>
            <option value="old_alpha">Alpha</option>
            <option value="all">{c.t("all")}</option>
          </select>
        </label>
        <label>
          {c.tr("Фильтр версий", "Filter versions")}
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="1.21…"
          />
        </label>
      </div>
      <label>
        {c.t("version")}
        <select
          value={version}
          onChange={(e) => setVersion(e.target.value)}
          disabled={!manifest}
        >
          {version &&
            !(manifest?.versions || []).some(
              (v: Version) =>
                v.id === version &&
                (channel === "all" || v.type === channel) &&
                v.id.includes(filter),
            ) && <option value={version}>{version}</option>}
          {(manifest?.versions || [])
            .filter(
              (v: Version) =>
                (channel === "all" || v.type === channel) &&
                v.id.includes(filter),
            )
            .map((v: Version) => (
              <option key={v.id} value={v.id}>
                {v.id} · {v.type}
              </option>
            ))}
        </select>
      </label>
      <label>
        {c.t("loader")}
        <div className="loader-choices">
          {(
            ["vanilla", "fabric", "forge", "quilt", "neoforge"] as Loader[]
          ).map((l) => (
            <button
              key={l}
              className={l === loader ? "chosen" : ""}
              onClick={() => setLoader(l)}
            >
              {l === "vanilla" ? <Boxes size={16} /> : <Zap size={16} />}
              <span>{l}</span>
            </button>
          ))}
        </div>
      </label>
      {loader !== "vanilla" && (
        <label>
          {c.tr("Версия загрузчика", "Loader version")}
          {lbusy ? (
            <p>
              <LoaderCircle className="spin" size={16} />{" "}
              {c.tr("Проверяем совместимость…", "Checking compatibility…")}
            </p>
          ) : lvs.length ? (
            <select value={lv} onChange={(e) => setLv(e.target.value)}>
              {lvs.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          ) : (
            <p className="warning">
              {c.tr(
                "Для этой версии загрузчик недоступен.",
                "Loader unavailable for this Minecraft version.",
              )}
            </p>
          )}
        </label>
      )}
      <div className="info-box">
        <ShieldCheck size={18} />
        <span>
          {c.tr(
            "Java устанавливается автоматически. Версии загружаются из официального манифеста Mojang. Alpha и Beta могут требовать особых условий запуска.",
            "Java is installed automatically. Versions come from Mojang’s official manifest. Alpha and Beta may need additional launch adjustments.",
          )}
        </span>
      </div>
      {err && <p className="error-text">{err}</p>}
      <div className="modal-actions">
        <button
          className="secondary"
          disabled={busy || !version}
          onClick={() => submit(true)}
        >
          <FolderOpen size={16} />
          {c.tr("Импорт папки", "Import folder")}
        </button>
        <button
          className="primary"
          disabled={busy || !version || lbusy || (loader !== "vanilla" && !lv)}
          onClick={() => submit()}
        >
          {busy ? (
            <LoaderCircle className="spin" size={17} />
          ) : (
            <Plus size={17} />
          )}{" "}
          {c.t("create")}
        </button>
      </div>
    </>
  );
}
function Accounts(c: Ctx) {
  const [mode, setMode] = useState("local"),
    [name, setName] = useState(""),
    [busy, setBusy] = useState(false),
    [err, setErr] = useState("");
  const login = async () => {
    setBusy(true);
    setErr("");
    try {
      await raw(
        mode === "local"
          ? "addLocal"
          : mode === "microsoft"
            ? "loginMicrosoft"
            : "loginEly",
        { name },
      );
      c.notify(c.tr("Аккаунт добавлен", "Account added"));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="modal-symbol">
        <Users size={27} />
      </div>
      <h2>{c.tr("Твой игровой профиль", "Your player profile")}</h2>
      <p className="modal-intro">
        {c.tr(
          "Все аккаунты под рукой. Выбери, кем будешь сегодня.",
          "All your accounts, one place. Choose who you’ll be today.",
        )}
      </p>
      <div className="account-list">
        {c.s.accounts.map((a: any) => (
          <div
            key={a.id}
            className={
              "account-row " + (c.s.activeAccount === a.id ? "chosen" : "")
            }
          >
            <PlayerAvatar account={a} />
            <div>
              <strong>{a.name}</strong>
              <small>
                {a.type === "local"
                  ? c.tr("Локальный профиль", "Local profile")
                  : a.type === "ely"
                    ? "Ely.by"
                    : "Microsoft"}
              </small>
            </div>
            <button
              className="icon-button"
              aria-label="Select account"
              onClick={() => c.run(() => raw("selectAccount", a.id))}
            >
              {c.s.activeAccount === a.id ? (
                <CheckCircle2 size={20} />
              ) : (
                <ChevronRight size={20} />
              )}
            </button>
            <button
              className="icon-button"
              aria-label="Sign out"
              onClick={() => c.run(() => raw("removeAccount", a.id))}
            >
              <Trash2 size={17} />
            </button>
          </div>
        ))}
      </div>
      <div className="tabs">
        {[
          ["local", c.tr("По нику", "Nickname")],
          ["microsoft", "Microsoft"],
          ["ely", "Ely.by"],
        ].map(([id, title]) => (
          <button
            key={id}
            disabled={busy}
            className={mode === id ? "active" : ""}
            onClick={() => {
              setMode(id);
              setErr("");
            }}
          >
            {title}
          </button>
        ))}
      </div>
      {mode === "local" ? (
        <>
          <label>
            {c.tr("Игровой ник", "Player name")}
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Player"
              maxLength={16}
            />
          </label>
          <div className="info-box">
            <CircleHelp size={19} />
            <span>
              {c.tr(
                "Локальный профиль подходит для одиночной игры и серверов без проверки лицензии. Он не даёт доступ к серверам с обязательной официальной авторизацией.",
                "Local profiles support singleplayer and servers without license verification. They cannot join servers that require official authentication.",
              )}
            </span>
          </div>
        </>
      ) : (
        <div className="info-box">
          <ShieldCheck size={20} />
          <span>
            {mode === "microsoft"
              ? c.tr(
                  "Вход откроется в браузере Microsoft. Luma проверит владение Java Edition. Пароль в лаунчере не запрашивается. Нужен свой Client ID в настройках.",
                  "Sign in opens in Microsoft’s browser page. Luma checks Java Edition ownership. A configured Client ID is required.",
                )
              : c.tr(
                  "Вход через OAuth Ely.by в браузере. Скины и сессия подключаются через authlib-injector. Совместимо с серверами Ely.by и серверами без проверки лицензии; не заменяет Microsoft.",
                  "Browser OAuth via Ely.by. Skins and sessions use authlib-injector. Supports Ely.by and offline servers; it does not replace Microsoft authentication.",
                )}
          </span>
        </div>
      )}
      {err && <p className="error-text">{err}</p>}
      <button
        className="primary full"
        disabled={busy || (mode === "local" && !name)}
        onClick={login}
      >
        {busy ? (
          <LoaderCircle className="spin" size={18} />
        ) : mode === "local" ? (
          <Plus size={18} />
        ) : (
          <ExternalLink size={17} />
        )}{" "}
        {busy
          ? c.tr("Ожидаем вход…", "Waiting for sign in…")
          : mode === "local"
            ? c.t("addAccount")
            : c.tr("Продолжить в браузере", "Continue in browser")}
      </button>
      <p className="fine-print">
        {c.tr(
          "Токены зашифрованы средствами операционной системы.",
          "Tokens are encrypted using the operating system’s secure storage.",
        )}
      </p>
    </>
  );
}
function CatalogView(c: Ctx) {
  const [query, setQuery] = useState(c.cheats ? "freecam" : ""),
    [source, setSource] = useState("modrinth"),
    [type, setType] = useState("mod"),
    [sort, setSort] = useState("popular"),
    [mc, setMc] = useState(""),
    [loader, setLoader] = useState(""),
    [category, setCategory] = useState(""),
    [categories, setCategories] = useState<any[]>([]),
    [manifest, setManifest] = useState<any>(),
    [projects, setProjects] = useState<Project[]>([]),
    [errors, setErrors] = useState<string[]>([]),
    [busy, setBusy] = useState(true),
    [offset, setOffset] = useState(0),
    [selected, setSelected] = useState<Project | null>(null);
  useEffect(() => {
    raw("versions")
      .then(setManifest)
      .catch(() => {});
  }, []);
  useEffect(() => {
    setCategory("");
    setCategories([]);
    if (source !== "all")
      raw("categories", source)
        .then(setCategories)
        .catch(() => {});
  }, [source]);
  useEffect(() => {
    let active = true;
    setBusy(true);
    const timer = setTimeout(() => {
      raw("catalogSearch", {
        query,
        source,
        type,
        sort,
        version: mc,
        loader,
        category,
        offset,
      })
        .then((r) => {
          if (active) {
            setProjects(r.projects);
            setErrors(r.errors);
          }
        })
        .catch((e) => active && setErrors([e.message]))
        .finally(() => active && setBusy(false));
    }, 350);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, source, type, sort, mc, loader, category, offset]);
  const change = (fn: () => void) => {
    setOffset(0);
    fn();
  };
  const validCategories = categories.filter((x) =>
    source === "modrinth"
      ? x.type === type
      : x.type ===
        ({ mod: 6, modpack: 4471, resourcepack: 12, shader: 6552 } as any)[
          type
        ],
  );
  return (
    <>
      <Heading
        eyebrow={
          c.cheats
            ? "LUMA LAB"
            : c.tr("ОТКРОЙ ЧТО-ТО НОВОЕ", "FIND YOUR NEXT FAVORITE")
        }
        title={
          c.cheats
            ? c.tr("Твои возможности. Без границ.", "More ways to play.")
            : c.tr("Больше, чем ванилла.", "Beyond vanilla.")
        }
        description={
          c.cheats
            ? c.tr(
                "Клиентские модификации из каталогов и твои собственные файлы.",
                "Client modifications from official catalogs and your own files.",
              )
            : c.tr(
                "Моды, сборки, ресурспаки и шейдеры. Найди свой Minecraft.",
                "Mods, packs, resource packs and shaders. Find your Minecraft.",
              )
        }
      >
        <button
          className="secondary"
          onClick={() => {
            if (!c.s.activeInstance) c.setModal("create");
            else void c.run(() => raw("addJars", c.s.activeInstance));
          }}
        >
          <Plus size={16} />
          {c.tr("Добавить .jar", "Add .jar")}
        </button>
      </Heading>
      {!c.cheats && <div className="extra-catalogs">
        {[
          ["Feed The Beast", "https://www.feed-the-beast.com/modpacks", "mountain", c.tr("Готовые сборки", "Curated modpacks")],
          ["Planet Minecraft", "https://www.planetminecraft.com/resources/mods/", "forest", c.tr("Моды и ресурсы сообщества", "Community mods and resources")],
          ["Vanilla Tweaks", "https://vanillatweaks.net/picker/resource-packs/", "rose", c.tr("Настройка ресурспаков", "Custom resource packs")],
        ].map(([name,url,picture,description]) => <button key={name} className="extra-catalog" onClick={() => raw("openUrl", url)}><Photo variant={picture}/><span><strong>{name}</strong><small>{description}</small></span><ExternalLink size={16}/></button>)}
        <button className="extra-import" onClick={() => c.run(() => raw("importPack"))}><Download size={17}/>{c.tr("Импортировать .mrpack или CurseForge ZIP", "Import .mrpack or CurseForge ZIP")}</button>
      </div>}
      {c.cheats && (
        <div className="info-box caution">
          <AlertTriangle size={21} />
          <span>
            {c.tr(
              "Читы могут нарушать правила серверов и приводить к блокировке. Luma не защищает от банов. Проверяй автора, исходники и правила сервера перед установкой.",
              "Client modifications may violate server rules and result in bans. Luma offers no ban protection. Check authors, sources and server rules before installing.",
            )}
          </span>
        </div>
      )}
      <div className="catalog-search">
        <div className="search-box">
          <Search size={19} />
          <input
            value={query}
            onChange={(e) => change(() => setQuery(e.target.value))}
            placeholder={c.t("search")}
          />
          {query && (
            <button
              className="icon-button"
              aria-label="Clear search"
              onClick={() => change(() => setQuery(""))}
            >
              <X size={16} />
            </button>
          )}
        </div>
        <select
          aria-label="Catalog source"
          value={source}
          onChange={(e) => change(() => setSource(e.target.value))}
        >
          <option value="modrinth">Modrinth</option>
          <option value="curseforge">CurseForge</option>
          <option value="all">Modrinth + CurseForge</option>
        </select>
      </div>
      <div className="catalog-tabs">
        {(c.cheats
          ? ["mod"]
          : ["mod", "modpack", "resourcepack", "shader"]
        ).map((v) => (
          <button
            key={v}
            className={v === type ? "active" : ""}
            onClick={() => change(() => setType(v))}
          >
            {
              (
                {
                  mod: c.tr("Моды", "Mods"),
                  modpack: c.tr("Сборки", "Modpacks"),
                  resourcepack: c.tr("Ресурспаки", "Resource packs"),
                  shader: c.tr("Шейдеры", "Shaders"),
                } as any
              )[v]
            }
          </button>
        ))}
        <span />
        <SlidersHorizontal size={16} />
        <select
          aria-label="Sort"
          value={sort}
          onChange={(e) => change(() => setSort(e.target.value))}
        >
          <option value="popular">{c.tr("Популярные", "Popular")}</option>
          <option value="updated">
            {c.tr("Обновлённые", "Recently updated")}
          </option>
          <option value="newest">{c.tr("Новые", "Newest")}</option>
        </select>
      </div>
      {c.cheats && (
        <div className="quick-filters">
          {["X-Ray", "ESP", "Freecam", "Fullbright", "Automation"].map((v) => (
            <button
              key={v}
              className={
                query.toLowerCase() === v.toLowerCase() ? "active" : ""
              }
              onClick={() => change(() => setQuery(v))}
            >
              {v}
            </button>
          ))}
        </div>
      )}
      <div className="filter-row">
        <label>
          {c.t("version")}
          <select
            value={mc}
            onChange={(e) => change(() => setMc(e.target.value))}
          >
            <option value="">{c.tr("Любая версия", "Any version")}</option>
            {manifest?.versions.map((v: Version) => (
              <option key={v.id}>{v.id}</option>
            ))}
          </select>
        </label>
        <label>
          {c.t("loader")}
          <select
            value={loader}
            onChange={(e) => change(() => setLoader(e.target.value))}
          >
            <option value="">{c.t("all")}</option>
            {["fabric", "forge", "quilt", "neoforge"].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label>
          {c.tr("Категория", "Category")}
          <select
            value={category}
            onChange={(e) => change(() => setCategory(e.target.value))}
          >
            <option value="">{c.t("all")}</option>
            {validCategories.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </label>
        <button
          className="text-link"
          onClick={() => {
            setQuery("");
            setMc("");
            setLoader("");
            setCategory("");
            setOffset(0);
          }}
        >
          {c.tr("Сбросить", "Reset")}
        </button>
      </div>
      {errors.map((e) => (
        <div key={e} className="info-box caution">
          <AlertTriangle size={18} />
          <span>{e}</span>
          <button className="text-link" onClick={() => c.setPage("settings")}>
            {c.t("settings")}
          </button>
        </div>
      ))}
      {busy ? (
        <div className="loading">
          <LoaderCircle className="spin" size={26} />
          {c.tr("Загружаем каталог…", "Loading catalog…")}
        </div>
      ) : projects.length ? (
        <div className="project-grid">
          {projects.map((p) => (
            <article className="project-card" key={p.source + p.id}>
              <div className="project-top">
                <button className="project-icon" onClick={() => setSelected(p)}>
                  {p.icon ? (
                    <img src={p.icon} loading="lazy" />
                  ) : (
                    <Boxes size={27} />
                  )}
                </button>
                <Badge
                  tone={
                    p.source === "modrinth" ? "green-badge" : "orange-badge"
                  }
                >
                  {p.source === "modrinth" ? "Modrinth" : "CurseForge"}
                </Badge>
              </div>
              <button className="project-name" onClick={() => setSelected(p)}>
                {p.title}
              </button>
              <small className="project-author">{p.author}</small>
              <p>{p.description}</p>
              <div className="project-bottom">
                <span>
                  <ArrowDownToLine size={14} />
                  {fmt(p.downloads)}
                </span>
                <button className="secondary" onClick={() => setSelected(p)}>
                  {c.tr("Подробнее", "Details")}
                  <ArrowUpRight size={14} />
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <Empty
          icon={Search}
          title={c.tr("Пока ничего не нашлось", "No projects found")}
          description={c.tr(
            "Попробуй другой запрос или убери часть фильтров.",
            "Try another search or remove some filters.",
          )}
        />
      )}
      <div className="pagination">
        <button
          className="secondary"
          disabled={offset === 0 || busy}
          onClick={() => setOffset(Math.max(0, offset - 24))}
        >
          {c.t("back")}
        </button>
        <span>
          {c.tr("Страница", "Page")} {offset / 24 + 1}
        </span>
        <button
          className="secondary"
          disabled={projects.length < 24 || busy}
          onClick={() => setOffset(offset + 24)}
        >
          {c.tr("Далее", "Next")}
          <ChevronRight size={16} />
        </button>
      </div>
      {selected && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => e.target === e.currentTarget && setSelected(null)}
        >
          <section className="modal wide" role="dialog">
            <button
              className="modal-close icon-button"
              aria-label="Close project"
              onClick={() => setSelected(null)}
            >
              <X size={21} />
            </button>
            <ProjectDetails
              {...c}
              p={selected}
              close={() => setSelected(null)}
            />
          </section>
        </div>
      )}
    </>
  );
}
function ProjectDetails(c: Ctx) {
  const [p, setP] = useState<Project>(c.p),
    [target, setTarget] = useState(c.s.activeInstance || ""),
    [versions, setVersions] = useState<ProjectVersion[]>([]),
    [selected, setSelected] = useState(""),
    [busy, setBusy] = useState(false),
    [err, setErr] = useState("");
  const i = c.s.instances.find((v: Instance) => v.id === target);
  useEffect(() => {
    raw("project", c.p)
      .then(setP)
      .catch((e) => setErr(e.message));
  }, [c.p.id]);
  useEffect(() => {
    let active = true;
    setBusy(true);
    setVersions([]);
    setSelected("");
    raw("projectVersions", {
      source: p.source,
      id: p.id,
      version: p.type === "modpack" ? undefined : i?.version,
      loader: p.type === "mod" ? i?.loader : undefined,
    })
      .then((v) => {
        if (active) {
          setVersions(v);
          setSelected(v[0]?.id || "");
        }
      })
      .catch((e) => active && setErr(e.message))
      .finally(() => active && setBusy(false));
    return () => {
      active = false;
    };
  }, [p.id, target]);
  const install = () =>
    c.run(async () => {
      await raw("installProject", {
        project: p,
        versionId: selected,
        instanceId: target,
      });
      c.notify(c.tr("Установка добавлена в очередь", "Installation queued"));
      c.close();
    });
  return (
    <>
      <div className="project-detail-head">
        {p.icon && <img src={p.icon} />}
        <div>
          <Badge tone="green-badge">{p.source}</Badge>
          <h2>{p.title}</h2>
          <p>{p.description}</p>
        </div>
      </div>
      <div className="detail-stats">
        <span>
          <Download size={15} />
          {fmt(p.downloads)} {c.tr("загрузок", "downloads")}
        </span>
        <button
          className="text-link"
          onClick={() => c.run(() => raw("openUrl", p.url))}
        >
          {c.tr("Страница проекта", "Project page")}
          <ExternalLink size={14} />
        </button>
      </div>
      {p.gallery?.length ? (
        <div className="gallery">
          {p.gallery.slice(0, 4).map((url) => (
            <img key={url} src={url} loading="lazy" />
          ))}
        </div>
      ) : null}
      <div className="project-description">{p.body || p.description}</div>
      <div className="install-box">
        <h3>{c.tr("Добавить к твоему Minecraft", "Add to your Minecraft")}</h3>
        {p.type === "modpack" ? (
          <p className="hint">
            {c.tr(
              "Модпак импортируется как новая изолированная сборка.",
              "Modpacks are imported as a new isolated instance.",
            )}
          </p>
        ) : (
          <label>
            {c.t("selected")}
            <select value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="">
                {c.tr("Выбрать сборку", "Choose instance")}
              </option>
              {c.s.instances.map((x: Instance) => (
                <option key={x.id} value={x.id}>
                  {x.name} · {x.version} · {x.loader}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          {c.tr("Версия проекта", "Project version")}
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            disabled={busy}
          >
            {versions.length ? (
              versions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} ·{" "}
                  {new Date(v.date).toLocaleDateString(
                    c.en ? "en-US" : "ru-RU",
                  )}
                </option>
              ))
            ) : (
              <option>
                {busy
                  ? c.tr("Загружается…", "Loading…")
                  : c.tr("Нет совместимых версий", "No compatible versions")}
              </option>
            )}
          </select>
        </label>
        <div className="info-box">
          <ShieldCheck size={18} />
          <span>
            {c.tr(
              "Обязательные зависимости будут установлены. Проверяются заявленные ограничения версии и загрузчика. Все возможные конфликты автоматически обнаружить нельзя.",
              "Required dependencies are installed automatically. Declared version and loader constraints are checked. Not all conflicts can be detected.",
            )}
          </span>
        </div>
        {err && <p className="error-text">{err}</p>}
        <button
          className="primary full"
          disabled={busy || !selected || (p.type !== "modpack" && !target)}
          onClick={install}
        >
          <Download size={17} />
          {c.t("install")}
        </button>
        {!target && p.type !== "modpack" && (
          <button
            className="text-link"
            onClick={() => {
              c.close();
              c.setModal("create");
            }}
          >
            {c.t("create")}
            <Plus size={15} />
          </button>
        )}
      </div>
    </>
  );
}
function InstancePanel(c: Ctx) {
  const i = c.s.instances.find((x: Instance) => x.id === c.id) as
    Instance | undefined;
  const [tab, setTab] = useState("overview"),
    [form, setForm] = useState<Instance | undefined>(i),
    [backups, setBackups] = useState<string[]>([]),
    [logs, setLogs] = useState(""),
    [files, setFiles] = useState<string[]>([]),
    [config, setConfig] = useState(""),
    [content, setContent] = useState(""),
    [presets, setPresets] = useState<string[]>([]),
    [presetName, setPresetName] = useState("");
  const pre = useRef<HTMLPreElement>(null);
  const [checking, setChecking] = useState(false);
  useEffect(() => {
    setForm(i);
  }, [i]);
  useEffect(() => {
    if (!i) return;
    if (tab === "backups")
      void c.run(async () => setBackups(await raw("backups", i.id)));
    if (tab === "logs") void raw("logs", i.id).then(setLogs);
    if (tab === "config") {
      void c.run(async () => {
        setFiles(await raw("configFiles", i.id));
        setPresets(await raw("presets", i.id));
      });
    }
    return window.luma.on("log", (d) => {
      if (d.id === i.id) setLogs((v) => (v + d.line).slice(-150000));
    });
  }, [tab, i?.id]);
  useEffect(() => {
    if (pre.current) pre.current.scrollTop = pre.current.scrollHeight;
  }, [logs]);
  if (!i || !form)
    return <Empty title={c.tr("Сборка не найдена", "Instance not found")} />;
  const set = (k: string, v: any) => setForm({ ...form, [k]: v });
  const saved = c.tr("Сохранено", "Saved");
  return (
    <>
      <div className="instance-panel-head">
        <span className="modal-symbol">
          <Boxes size={26} />
        </span>
        <div>
          <div className="eyebrow">
            {i.loader.toUpperCase()} · {i.version}
          </div>
          <h2>{i.name}</h2>
        </div>
        <button className="primary" onClick={() => c.play(i.id)}>
          <Play size={16} fill="currentColor" />
          {c.t("play")}
        </button>
      </div>
      <div className="tabs">
        {["overview", "mods", "config", "backups", "logs"].map((v) => (
          <button
            key={v}
            className={v === tab ? "active" : ""}
            onClick={() => setTab(v)}
          >
            {
              (
                {
                  overview: c.t("settings"),
                  mods: c.t("mods"),
                  config: c.t("config"),
                  backups: c.tr("Копии", "Backups"),
                  logs: c.t("logs"),
                } as any
              )[v]
            }
          </button>
        ))}
      </div>
      {tab === "overview" && (
        <>
          <div className="form-row">
            <label>
              {c.t("name")}
              <input
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
              />
            </label>
            <label>
              {c.tr("Память, MB", "Memory, MB")}
              <input
                type="number"
                min={512}
                max={(c.s as any).systemMemory}
                step={256}
                value={form.memory}
                onChange={(e) => set("memory", Number(e.target.value))}
              />
            </label>
          </div>
          <label>
            {c.tr("Описание", "Description")}
            <input
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
            />
          </label>
          <label>
            {c.tr(
              "Java — пустое поле для автоматического подбора",
              "Java — leave blank for automatic installation",
            )}
            <div className="input-with-button">
              <input
                value={form.java}
                onChange={(e) => set("java", e.target.value)}
                placeholder={c.tr("Автоматически", "Automatic")}
              />
              <button
                className="secondary"
                onClick={() =>
                  c.run(async () => {
                    const p = await raw("chooseJava");
                    if (p) set("java", p);
                  })
                }
              >
                <FolderOpen size={16} />
              </button>
            </div>
          </label>
          <div className="form-row">
            <label>
              {c.tr("Ширина окна", "Window width")}
              <input
                type="number"
                value={form.width}
                onChange={(e) => set("width", Number(e.target.value))}
              />
            </label>
            <label>
              {c.tr("Высота окна", "Window height")}
              <input
                type="number"
                value={form.height}
                onChange={(e) => set("height", Number(e.target.value))}
              />
            </label>
          </div>
          <label>
            {c.tr("Аргументы JVM", "JVM arguments")}
            <input
              value={form.args}
              onChange={(e) => set("args", e.target.value)}
              placeholder="-XX:+UseG1GC"
            />
          </label>
          <label>
            {c.tr("Аргументы игры", "Game arguments")}
            <input
              value={form.gameArgs}
              onChange={(e) => set("gameArgs", e.target.value)}
              placeholder="--fullscreen"
            />
          </label>
          <label>
            {c.tr("Обложка", "Cover")}
            <div className="cover-options">
              {photoNames.map((v) => (
                <button
                  key={v}
                  aria-label={v}
                  className={form.cover === v ? "chosen" : ""}
                  onClick={() => set("cover", v)}
                >
                  <Photo variant={v} />
                </button>
              ))}
              <button
                className="secondary"
                onClick={() => c.run(() => raw("coverImage", i.id))}
              >
                <Upload size={16} />
                {c.tr("Своя", "Custom")}
              </button>
            </div>
          </label>
          <button
            className="primary full"
            onClick={() => c.run(() => raw("updateInstance", form), saved)}
          >
            <Save size={16} />
            {c.t("save")}
          </button>
          <div className="folder-shortcuts">
            {[
              ["", FolderOpen, c.tr("Папка", "Folder")],
              ["mods", Boxes, c.t("mods")],
              ["saves", Globe2, c.tr("Миры", "Worlds")],
              ["screenshots", Monitor, c.tr("Скриншоты", "Screenshots")],
              ["config", Settings2, c.t("config")],
            ].map(([f, Icon, title]: any) => (
              <button
                key={f}
                className="secondary"
                onClick={() =>
                  c.run(() => raw("openFolder", { id: i.id, folder: f }))
                }
              >
                <Icon size={15} />
                {title}
              </button>
            ))}
          </div>
          <div className="danger-row">
            <span>
              {i.installedVersion
                ? `${c.tr("Установлена", "Installed")}: ${i.installedVersion}`
                : c.tr(
                    "Файлы игры ещё не установлены",
                    "Game files are not installed yet",
                  )}
            </span>
            <button
              className="text-link danger"
              onClick={() =>
                c.run(async () => {
                  await raw("removeInstance", i.id);
                })
              }
            >
              <Trash2 size={14} />
              {c.t("delete")}
            </button>
          </div>
        </>
      )}
      {tab === "mods" && (
        <>
          <div className="panel-toolbar">
            <button
              className="secondary"
              onClick={() => c.run(() => raw("addJars", i.id))}
            >
              <Plus size={16} />
              {c.tr("Добавить .jar", "Add .jar")}
            </button>
            <button
              className="secondary"
              disabled={checking}
              onClick={async () => {
                setChecking(true);
                await c.run(async () => {
                  const v = await raw("checkUpdates", i.id);
                  if (!v.length)
                    c.notify(c.tr("Обновлений нет", "No updates available"));
                  else {
                    await raw("updateMods", i.id);
                    c.notify(
                      c.tr(
                        "Обновления добавлены в очередь; создана копия",
                        "Updates queued; a backup will be created",
                      ),
                    );
                  }
                });
                setChecking(false);
              }}
            >
              {checking ? (
                <LoaderCircle className="spin" size={16} />
              ) : (
                <RefreshCw size={16} />
              )}{" "}
              {c.tr("Обновить", "Update")}
            </button>
            <button
              className="text-link"
              onClick={() => {
                c.setModal(null);
                c.setPage("catalog");
              }}
            >
              {c.tr("В каталог", "Discover")}
              <ArrowUpRight size={15} />
            </button>
          </div>
          <div className="info-box">
            <CircleHelp size={18} />
            <span>
              {c.tr(
                "Ручные .jar: совместимость и зависимости не проверены. Лаунчер не может обнаружить все конфликты. Выключенные моды сохраняются с расширением .disabled.",
                "Manual .jar files: compatibility and dependencies are unverified. Not all conflicts can be detected. Disabled mods remain on disk as .disabled files.",
              )}
            </span>
          </div>
          {i.mods.length ? (
            <div className="mod-list">
              {i.mods.map((m) => (
                <div key={m.file} className="mod-row">
                  <span className="mod-icon">
                    <Boxes size={21} />
                  </span>
                  <div>
                    <strong>{m.name}</strong>
                    <small>{m.version || m.file}</small>
                  </div>
                  <Badge>{m.source}</Badge>
                  <button
                    className={"switch " + (m.enabled ? "on" : "")}
                    role="switch"
                    aria-checked={m.enabled}
                    aria-label={m.name}
                    onClick={() =>
                      c.run(() => raw("toggleMod", { id: i.id, file: m.file }))
                    }
                  >
                    <span />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <Empty
              title={c.tr("Чистый лист", "A clean slate")}
              description={c.tr(
                "Добавь моды из каталога или выбери свои .jar.",
                "Add mods from the catalog or choose your .jar files.",
              )}
            />
          )}
          <div className="folder-shortcuts">
            <button
              className="secondary"
              onClick={() =>
                c.run(() => raw("exportPack", { id: i.id, format: "mrpack" }))
              }
            >
              <Upload size={16} />
              Export .mrpack
            </button>
            <button
              className="secondary"
              onClick={() =>
                c.run(() =>
                  raw("exportPack", { id: i.id, format: "curseforge" }),
                )
              }
            >
              <Upload size={16} />
              Export CurseForge
            </button>
          </div>
          <p className="hint">
            {c.tr(
              "Экспорт использует ссылки и манифесты источников. Для смешанных сборок и локальных файлов используй полную резервную копию.",
              "Exports use source URLs and manifests. For mixed packs or local files, use a full backup.",
            )}
          </p>
        </>
      )}
      {tab === "config" && (
        <>
          <p className="hint">
            {c.tr(
              "Редактируй только документированные параметры модов. Файлы обычно появляются после первого запуска игры. Перед сохранением создаётся копия.",
              "Edit documented mod settings only. Files usually appear after the first game launch. Saving creates a backup.",
            )}
          </p>
          <label>
            {c.tr("Файл конфигурации", "Config file")}
            <select
              value={config}
              onChange={(e) => {
                const f = e.target.value;
                setConfig(f);
                if (f)
                  void c.run(async () =>
                    setContent(await raw("readConfig", { id: i.id, file: f })),
                  );
              }}
            >
              <option value="">{c.tr("Выбрать файл", "Choose file")}</option>
              {files.map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
          </label>
          {config && (
            <>
              <textarea
                className="code-editor"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                spellCheck={false}
              />
              <button
                className="primary"
                onClick={() =>
                  c.run(
                    () =>
                      raw("writeConfig", {
                        id: i.id,
                        file: config,
                        text: content,
                      }),
                    saved,
                  )
                }
              >
                <Save size={16} />
                {c.t("save")}
              </button>
            </>
          )}
          <div className="panel-toolbar">
            <button
              className="secondary"
              onClick={() =>
                c.run(() => raw("openFolder", { id: i.id, folder: "config" }))
              }
            >
              <FolderOpen size={16} />
              {c.tr("Открыть папку конфигураций", "Open config folder")}
            </button>
          </div>
          <h3>{c.tr("Пресеты конфигураций", "Configuration presets")}</h3>
          <div className="input-with-button">
            <input
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder={c.tr("Название пресета", "Preset name")}
            />
            <button
              className="secondary"
              disabled={!presetName}
              onClick={() =>
                c.run(async () => {
                  await raw("savePreset", { id: i.id, name: presetName });
                  setPresets(await raw("presets", i.id));
                  setPresetName("");
                }, saved)
              }
            >
              <Save size={16} />
              {c.t("save")}
            </button>
          </div>
          {presets.map((name) => (
            <div className="simple-row" key={name}>
              <span>{name}</span>
              <button
                className="text-link"
                onClick={() =>
                  c.run(() => raw("restorePreset", { id: i.id, name }), saved)
                }
              >
                <RotateCcw size={14} />
                {c.tr("Применить", "Apply")}
              </button>
            </div>
          ))}
        </>
      )}
      {tab === "backups" && (
        <>
          <div className="panel-toolbar">
            <button
              className="primary"
              onClick={() =>
                c.run(
                  async () => {
                    await raw("backup", i.id);
                    setBackups(await raw("backups", i.id));
                  },
                  c.tr("Копия создана", "Backup created"),
                )
              }
            >
              <HardDrive size={16} />
              {c.tr("Создать копию", "Create backup")}
            </button>
            <button
              className="text-link"
              onClick={() => c.run(() => raw("dataFolder"))}
            >
              <FolderOpen size={16} />
              {c.tr("Папка данных", "Data folder")}
            </button>
          </div>
          <p className="hint">
            {c.tr(
              "Полные копии содержат миры, моды, настройки и параметры сборки. Перед откатом сохраняется текущая сборка.",
              "Full backups include worlds, mods, settings and instance options. Restoring first backs up the current instance.",
            )}
          </p>
          {backups.length ? (
            backups.map((f) => (
              <div className="simple-row" key={f}>
                <FileText size={18} />
                <span>{f}</span>
                <button
                  className="secondary"
                  onClick={() =>
                    c.run(
                      async () => {
                        await raw("restore", { id: i.id, file: f });
                        setBackups(await raw("backups", i.id));
                      },
                      c.tr("Сборка восстановлена", "Instance restored"),
                    )
                  }
                >
                  <RotateCcw size={14} />
                  {c.tr("Откатить", "Restore")}
                </button>
              </div>
            ))
          ) : (
            <Empty
              icon={HardDrive}
              title={c.tr("Копий пока нет", "No backups yet")}
              description={c.tr(
                "Сохрани мир, прежде чем его менять.",
                "Save your world before changing it.",
              )}
            />
          )}
        </>
      )}
      {tab === "logs" && (
        <>
          <div className="panel-toolbar">
            <Badge tone={c.s.running.includes(i.id) ? "green-badge" : ""}>
              {c.s.running.includes(i.id)
                ? c.tr("Игра запущена", "Game running")
                : c.tr("Игра не запущена", "Game stopped")}
            </Badge>
            <button
              className="text-link"
              onClick={() =>
                c.run(() => raw("openFolder", { id: i.id, folder: "logs" }))
              }
            >
              <FolderOpen size={15} />
              {c.tr("Все логи", "All logs")}
            </button>
          </div>
          <pre ref={pre} className="console">
            {logs ||
              c.tr(
                "Вывод игры появится здесь после запуска.",
                "Game output will appear here after launch.",
              )}
          </pre>
        </>
      )}
    </>
  );
}
function Friends(c: Ctx) {
  const [adding, setAdding] = useState(false), [name, setName] = useState(""),
    [address, setAddress] = useState(""), [nearby, setNearby] = useState<any[]>([]),
    [scanning, setScanning] = useState(false);
  const scan = async () => {
    setScanning(true);
    try { setNearby(await raw("discoverLan")); }
    catch (e) { c.notify((e as Error).message, true); }
    finally { setScanning(false); }
  };
  useEffect(() => { void scan(); }, []);
  const host = () => {
    if (!c.s.activeInstance) return c.setModal("create");
    c.run(() => raw("playLan", { id: c.s.activeInstance }), c.tr("Игра запустится с автоматически открытым LAN-миром", "The game will launch and automatically open the world to LAN"));
  };
  return <>
    <Heading eyebrow="LUMA FRIENDS · LOCAL NETWORK" title={c.tr("Играй вместе.", "Play together.")} description={c.tr("Открывай одиночный мир для локальной сети и подключайся к друзьям одним нажатием.", "Open a singleplayer world to your local network and join friends in one click.")}>
      <button className="secondary" disabled={scanning} onClick={scan}><RefreshCw size={16} className={scanning ? "spin" : ""}/>{c.tr("Найти в сети", "Scan LAN")}</button>
      <button className="primary" onClick={host}><Users size={17}/>{c.tr("Открыть для сети", "Open to LAN")}</button>
    </Heading>
    <div className="info-box"><ShieldCheck size={19}/><span>{c.tr("Автоматическое открытие устанавливает Auto LAN из Modrinth и работает в совместимых сборках Fabric/Quilt. Друг должен быть в той же локальной сети.", "Automatic hosting installs Auto LAN from Modrinth and works with compatible Fabric/Quilt instances. Your friend must be on the same local network.")}</span></div>
    <div className="friends-section"><h3>{c.tr("Открытые миры рядом", "Nearby LAN worlds")}</h3>
      {nearby.length ? <div className="friend-grid">{nearby.map(game => <article className="friend-card" key={game.address}><div className="server-icon"><Globe2 size={23}/></div><span><strong>{game.name}</strong><small>{game.address}</small></span><button className="primary" onClick={() => c.play(c.s.activeInstance, game.address)}><Play size={15}/>{c.tr("Войти", "Join")}</button></article>)}</div> : <p>{scanning ? c.tr("Ищем миры Minecraft…", "Looking for Minecraft worlds…") : c.tr("Открытых LAN-миров пока не найдено.", "No open LAN worlds found yet.")}</p>}
    </div>
    <div className="friends-title"><h3>{c.tr("Мои друзья", "My friends")}</h3><button className="secondary" onClick={() => setAdding(!adding)}><Plus size={15}/>{c.tr("Добавить друга", "Add friend")}</button></div>
    {adding && <div className="settings-card"><div className="form-row"><label>{c.tr("Имя друга", "Friend name")}<input value={name} onChange={e => setName(e.target.value)} placeholder="Alex"/></label><label>{c.tr("Адрес в локальной сети", "Local network address")}<input value={address} onChange={e => setAddress(e.target.value)} placeholder="192.168.1.42:25565"/></label></div><button className="primary" disabled={!address} onClick={() => c.run(async () => { await raw("addFriend", { name, address }); setAdding(false); setName(""); setAddress(""); })}><Plus size={15}/>{c.tr("Добавить", "Add")}</button></div>}
    {c.s.friends.length ? <div className="friend-grid">{c.s.friends.map((friend: any) => <article className="friend-card" key={friend.id}><PlayerAvatar/><span><strong>{friend.name}</strong><small>{friend.address}</small></span><button className="primary" onClick={() => c.play(c.s.activeInstance, friend.address)}><Play size={15}/>{c.tr("Войти", "Join")}</button><button className="icon-button" onClick={() => c.run(() => raw("removeFriend", friend.id))}><Trash2 size={16}/></button></article>)}</div> : <Empty icon={Users} title={c.tr("Добавь первого друга", "Add your first friend")} description={c.tr("Сохрани его локальный адрес или найди открытый мир автоматически.", "Save their local address or discover an open world automatically.")}/>} 
  </>;
}
function Servers(c: Ctx) {
  const [adding, setAdding] = useState(false),
    [name, setName] = useState(""),
    [address, setAddress] = useState(""),
    [statuses, setStatuses] = useState<Record<string, any>>({}),
    [busy, setBusy] = useState(false);
  const check = async () => {
    setBusy(true);
    await Promise.all(
      c.s.servers.map(async (x: any) => {
        try {
          const result = await raw("ping", x.address);
          setStatuses((v) => ({ ...v, [x.id]: result }));
        } catch {
          setStatuses((v) => ({ ...v, [x.id]: { online: false } }));
        }
      }),
    );
    setBusy(false);
  };
  useEffect(() => {
    void check();
  }, [c.s.servers.length]);
  return (
    <>
      <Heading
        eyebrow="MULTIPLAYER"
        title={c.tr("Вместе интереснее.", "Better together.")}
        description={c.tr(
          "Твои любимые серверы. Один клик до встречи.",
          "Your favorite servers. One click from your friends.",
        )}
      >
        <button className="secondary" disabled={busy} onClick={check}>
          <RefreshCw size={16} className={busy ? "spin" : ""} />
          {c.tr("Обновить", "Refresh")}
        </button>
        <button className="primary" onClick={() => setAdding(!adding)}>
          <Plus size={16} />
          {c.tr("Добавить сервер", "Add server")}
        </button>
      </Heading>
      {adding && (
        <div className="settings-card">
          <div className="form-row">
            <label>
              {c.t("name")}
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={c.tr("Мой сервер", "My server")}
              />
            </label>
            <label>
              {c.tr("Адрес сервера", "Server address")}
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="play.example.org:25565"
              />
            </label>
          </div>
          <button
            className="primary"
            disabled={!address}
            onClick={() =>
              c.run(async () => {
                await raw("addServer", { name, address });
                setAdding(false);
                setName("");
                setAddress("");
              })
            }
          >
            <Plus size={16} />
            {c.tr("Добавить", "Add")}
          </button>
        </div>
      )}
      <div className="info-box">
        <ShieldCheck size={18} />
        <span>
          {c.tr(
            "Локальные профили и Ely.by не дают доступ к серверам с обязательной Microsoft-авторизацией. Выбери подходящий аккаунт перед подключением.",
            "Local profiles and Ely.by cannot join Microsoft-authenticated servers. Select a compatible account before joining.",
          )}
        </span>
      </div>
      {c.s.servers.length ? (
        <div className="server-list">
          {c.s.servers.map((x: any) => {
            const st = statuses[x.id];
            return (
              <article key={x.id} className="server-card">
                <div className="server-icon">
                  <Server size={25} />
                </div>
                <div className="server-info">
                  <h3>{x.name}</h3>
                  <p>{x.address}</p>
                  <small>
                    {st?.online
                      ? st.description
                      : c.tr(
                          "Нет ответа от сервера",
                          "No response from server",
                        )}
                  </small>
                </div>
                <div className="server-status">
                  <Badge tone={st?.online ? "green-badge" : ""}>
                    {!st
                      ? c.tr("Проверяем…", "Checking…")
                      : st.online
                        ? "Online"
                        : "Offline"}
                  </Badge>
                  <small>
                    {st?.online
                      ? `${st.players?.online || 0} / ${st.players?.max || 0} · ${st.latency} ms`
                      : ""}
                  </small>
                  <small>{st?.version}</small>
                </div>
                <button
                  className="primary"
                  onClick={() => c.play(c.s.activeInstance, x.address)}
                >
                  <Play size={16} />
                  {c.tr("Подключиться", "Join")}
                </button>
                <button
                  className="icon-button"
                  aria-label="Delete server"
                  onClick={() => c.run(() => raw("removeServer", x.id))}
                >
                  <Trash2 size={17} />
                </button>
              </article>
            );
          })}
        </div>
      ) : (
        <Empty
          icon={Server}
          title={c.tr("Твои друзья где-то здесь", "Your friends are out there")}
          description={c.tr(
            "Добавь адрес сервера, чтобы видеть его статус и быстро подключаться.",
            "Add a server address to see its status and join quickly.",
          )}
        >
          <button className="primary" onClick={() => setAdding(true)}>
            <Plus size={16} />
            {c.tr("Добавить сервер", "Add server")}
          </button>
        </Empty>
      )}
    </>
  );
}
function Downloads(c: Ctx) {
  const names: Record<string, string> = {
    queued: c.tr("В очереди", "Queued"),
    running: c.tr("Загружается", "Running"),
    done: c.tr("Готово", "Complete"),
    error: c.tr("Ошибка", "Failed"),
    cancelled: c.tr("Отменено", "Cancelled"),
  };
  return (
    <>
      <Heading
        eyebrow={c.tr("ВСЁ НА СВОИХ МЕСТАХ", "EVERYTHING IN ORDER")}
        title={c.tr("Загрузки", "Downloads")}
        description={c.tr(
          "Установка, обновления и импорт — в одной очереди.",
          "Installations, updates and imports in one queue.",
        )}
      />
      {c.jobs.length ? (
        <div className="download-list">
          {c.jobs.map((j: Job) => {
            const pct = j.total
              ? Math.min(100, Math.round((j.progress / j.total) * 100))
              : 0;
            return (
              <article className="download-card" key={j.id}>
                <div className="download-icon">
                  {j.status === "done" ? (
                    <CheckCheck size={23} />
                  ) : j.status === "running" ? (
                    <LoaderCircle className="spin" size={23} />
                  ) : (
                    <Download size={23} />
                  )}
                </div>
                <div className="download-details">
                  <div className="download-top">
                    <h3>{j.label}</h3>
                    <Badge
                      tone={
                        j.status === "done"
                          ? "green-badge"
                          : j.status === "error"
                            ? "red-badge"
                            : ""
                      }
                    >
                      {names[j.status]}
                    </Badge>
                  </div>
                  <p>{j.error || j.phase || "—"}</p>
                  {j.status === "running" && (
                    <>
                      <div
                        className={
                          "progress-bar " + (!j.total ? "indeterminate" : "")
                        }
                      >
                        <span style={{ width: pct + "%" }} />
                      </div>
                      <div className="download-meta">
                        <span>
                          {j.total
                            ? `${size(j.progress)} / ${size(j.total)}`
                            : c.tr("Подготовка…", "Preparing…")}
                        </span>
                        <span>
                          {j.speed ? size(j.speed) + "/s" : ""}
                          {j.total ? " · " + pct + "%" : ""}
                        </span>
                      </div>
                    </>
                  )}
                </div>
                {["running", "queued"].includes(j.status) ? (
                  <button
                    className="icon-button"
                    aria-label="Cancel download"
                    onClick={() => c.run(() => raw("cancelJob", j.id))}
                  >
                    <X size={19} />
                  </button>
                ) : j.status !== "done" ? (
                  <button
                    className="secondary"
                    onClick={() => c.run(() => raw("retryJob", j.id))}
                  >
                    <RefreshCw size={16} />
                    {c.tr("Повторить", "Retry")}
                  </button>
                ) : (
                  <CheckCircle2 className="success-icon" size={20} />
                )}
              </article>
            );
          })}
        </div>
      ) : (
        <Empty
          icon={CheckCheck}
          title={c.tr("Можно выдохнуть", "All caught up")}
          description={c.tr(
            "Здесь появятся активные и завершённые загрузки этой сессии.",
            "Active and completed downloads from this session will appear here.",
          )}
        />
      )}
    </>
  );
}
function SettingsView(c: Ctx) {
  const [tab, setTab] = useState("appearance"),
    [form, setForm] = useState<Settings>(c.s.settings),
    [cf, setCf] = useState(""),
    [ely, setEly] = useState(""),
    [preview, setPreview] = useState<Settings | null>(null);
  useEffect(() => {
    setForm(c.s.settings);
  }, [c.s.settings]);
  const set = (k: string, v: any) => setForm({ ...form, [k]: v });
  const save = () =>
    c.run(
      () => raw("settings", form),
      c.tr("Настройки сохранены", "Settings saved"),
    );
  return (
    <>
      <Heading
        eyebrow={c.tr("ПО-ТВОЕМУ", "MAKE IT YOURS")}
        title={c.tr("Всё, как ты любишь.", "Just the way you like it.")}
        description={c.tr(
          "Маленькие детали, которые делают лаунчер твоим.",
          "The little things that make this launcher yours.",
        )}
      >
        <button className="primary" onClick={save}>
          <Save size={16} />
          {c.t("save")}
        </button>
      </Heading>
      <div className="tabs setting-tabs">
        {[
          ["appearance", Palette, c.tr("Оформление", "Appearance")],
          ["general", SlidersHorizontal, c.tr("Основные", "General")],
          ["integrations", Globe2, c.tr("Интеграции", "Integrations")],
          ["about", CircleHelp, c.tr("О приложении", "About")],
        ].map(([id, Icon, title]: any) => (
          <button
            key={id}
            className={tab === id ? "active" : ""}
            onClick={() => setTab(id)}
          >
            <Icon size={16} />
            {title}
          </button>
        ))}
      </div>
      {tab === "about" && <Updates c={c} />}
      {tab === "appearance" && (
        <>
          <div className="settings-card">
            <h3>{c.tr("Твоя атмосфера", "Your atmosphere")}</h3>
            <p>
              {c.tr(
                "Выбери, в каком свете начнётся приключение.",
                "Choose the light for your next adventure.",
              )}
            </p>
            <div className="theme-cards">
              {["dark", "light"].map((v) => (
                <button
                  key={v}
                  className={
                    "theme-card " + v + " " + (form.theme === v ? "chosen" : "")
                  }
                  onClick={() => set("theme", v)}
                >
                  <div className="theme-mini">
                    <i />
                    <div>
                      <b />
                      <b />
                      <b />
                    </div>
                  </div>
                  <span>
                    {v === "dark"
                      ? c.tr("Полночь", "Midnight")
                      : c.tr("Рассвет", "Daybreak")}
                    {form.theme === v && <CheckCircle2 size={17} />}
                  </span>
                </button>
              ))}
            </div>
            <label>
              {c.tr("Акцентный цвет", "Accent color")}
              <div className="color-options">
                {["#c6abff", "#f2adc8", "#8fdbc7", "#98c3fa", "#f1cb91"].map(
                  (v) => (
                    <button
                      key={v}
                      aria-label={v}
                      style={{ background: v }}
                      className={form.accent === v ? "chosen" : ""}
                      onClick={() => set("accent", v)}
                    >
                      {form.accent === v && <Check size={17} />}
                    </button>
                  ),
                )}
                <input
                  aria-label="Custom accent color"
                  type="color"
                  value={form.accent}
                  onChange={(e) => set("accent", e.target.value)}
                />
              </div>
            </label>
            <div className="form-row">
              <label>
                {c.tr("Размытие свечения", "Glow blur")}
                <input
                  type="range"
                  min="0"
                  max="80"
                  value={form.blur}
                  onChange={(e) => set("blur", Number(e.target.value))}
                />
                <small>{form.blur} px</small>
              </label>
              <label>
                {c.tr("Непрозрачность панелей", "Panel opacity")}
                <input
                  type="range"
                  min="0.5"
                  max="1"
                  step="0.05"
                  value={form.opacity}
                  onChange={(e) => set("opacity", Number(e.target.value))}
                />
                <small>{Math.round(form.opacity * 100)}%</small>
              </label>
            </div>
            <div className="setting-row">
              <div>
                <strong>
                  {c.tr("Фоновое изображение", "Background image")}
                </strong>
                <p>
                  {c.tr(
                    "Твой любимый пейзаж, скриншот или рисунок.",
                    "Your favorite landscape, screenshot or artwork.",
                  )}
                </p>
              </div>
              <button
                className="secondary"
                onClick={() => c.run(() => raw("backgroundImage"))}
              >
                <Upload size={16} />
                {c.tr("Выбрать", "Choose")}
              </button>
              {c.s.settings.background && (
                <button
                  className="icon-button"
                  aria-label="Remove background"
                  onClick={() => c.run(() => raw("clearBackground"))}
                >
                  <X size={17} />
                </button>
              )}
            </div>
            <div className="onboarding-gallery settings-gallery">{photoNames.map(v => <button key={v} className={c.s.settings.background === "photo:" + v ? "chosen" : ""} onClick={() => c.run(() => raw("backgroundPreset", v))}><Photo variant={v}/></button>)}</div>
          </div>
          <div className="settings-card">
            <h3>{c.tr("Движение и пространство", "Motion and space")}</h3>
            <Toggle
              label={c.tr("Плавные анимации", "Smooth animations")}
              description={c.tr(
                "Выключи для режима сниженного движения.",
                "Turn off for reduced motion.",
              )}
              value={form.motion}
              onChange={(v: boolean) => set("motion", v)}
            />
            <Toggle
              label={c.tr("Полная боковая панель", "Expanded sidebar")}
              description={c.tr(
                "Подписи разделов рядом с иконками.",
                "Section labels beside icons.",
              )}
              value={form.sidebar}
              onChange={(v: boolean) => set("sidebar", v)}
            />
            <div className="form-row">
              <label>
                {c.tr("Масштаб интерфейса", "Interface scale")}
                <select
                  value={form.scale}
                  onChange={(e) => set("scale", Number(e.target.value))}
                >
                  {[0.75, 0.85, 1, 1.15, 1.25, 1.5].map((v) => (
                    <option value={v} key={v}>
                      {v * 100}%
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {c.tr("Плотность карточек", "Card density")}
                <select
                  value={form.density}
                  onChange={(e) => set("density", e.target.value)}
                >
                  <option value="comfortable">
                    {c.tr("Просторная", "Comfortable")}
                  </option>
                  <option value="compact">
                    {c.tr("Компактная", "Compact")}
                  </option>
                </select>
              </label>
            </div>
          </div>
          <div className="settings-card">
            <div className="setting-row">
              <div>
                <h3>{c.tr("Сохрани свой стиль", "Save your style")}</h3>
                <p>
                  {c.tr(
                    "Перенеси оформление с предварительным просмотром.",
                    "Transfer your theme with a preview before applying.",
                  )}
                </p>
              </div>
              <button
                className="secondary"
                onClick={() => c.run(() => raw("exportTheme"))}
              >
                <Upload size={16} />
                {c.tr("Экспорт", "Export")}
              </button>
              <button
                className="secondary"
                onClick={() =>
                  c.run(async () => setPreview(await raw("previewTheme")))
                }
              >
                <Download size={16} />
                {c.t("import")}
              </button>
            </div>
            {preview && (
              <div
                className="theme-preview"
                style={{
                  background: preview.theme === "dark" ? "#111116" : "#f3f1f8",
                  color: preview.theme === "dark" ? "#eee" : "#222",
                }}
              >
                <span
                  className="preview-swatch"
                  style={{ background: preview.accent }}
                />
                <strong>
                  {c.tr("Предпросмотр оформления", "Theme preview")}
                </strong>
                <span>
                  {preview.theme} · {preview.scale * 100}%
                </span>
                <button className="secondary" onClick={() => setPreview(null)}>
                  {c.t("cancel")}
                </button>
                <button
                  className="primary"
                  style={{ background: preview.accent }}
                  onClick={() =>
                    c.run(async () => {
                      await raw("applyTheme", preview);
                      setPreview(null);
                    })
                  }
                >
                  {c.tr("Применить", "Apply")}
                </button>
              </div>
            )}
          </div>
        </>
      )}
      {tab === "general" && (
        <>
          <div className="settings-card">
            <h3>{c.tr("Поведение приложения", "App preferences")}</h3>
            <div className="form-row">
              <label>
                {c.tr("Язык", "Language")}
                <select
                  value={form.language}
                  onChange={(e) => set("language", e.target.value)}
                >
                  <option value="ru">Русский</option>
                  <option value="en">English</option>
                  <option value="uk">Українська</option>
                  <option value="de">Deutsch</option>
                  <option value="fr">Français</option>
                  <option value="es">Español</option>
                  <option value="pl">Polski</option>
                  <option value="pt_br">Português (Brasil)</option>
                  <option value="zh_cn">简体中文</option>
                </select>
              </label>
              <label>
                {c.tr("Стартовая страница", "Start page")}
                <select
                  value={form.startPage}
                  onChange={(e) => set("startPage", e.target.value)}
                >
                  {nav.map(([id, , ru, en]) => (
                    <option key={id} value={id}>
                      {c.en ? en : ru}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
          <div className="settings-card">
            <h3>{c.tr("Файлы и хранение", "Files and storage")}</h3>
            <p>
              {c.tr(
                "Все игровые папки изолированы. Java, библиотеки и ресурсы игры хранятся в общем кэше.",
                "Game folders are isolated. Java, libraries and assets share a common cache.",
              )}
            </p>
            <code className="data-path">{c.s.dataPath}</code>
            <button
              className="secondary"
              onClick={() => c.run(() => raw("dataFolder"))}
            >
              <FolderOpen size={16} />
              {c.tr("Открыть папку данных", "Open data folder")}
            </button>
            <p className="hint">
              {c.tr(
                "Память, Java, аргументы и разрешение настраиваются отдельно в каждой сборке.",
                "Memory, Java, arguments and resolution are configured per instance.",
              )}
            </p>
          </div>
        </>
      )}
      {tab === "integrations" && (
        <>
          <div className="info-box">
            <ShieldCheck size={20} />
            <span>
              {c.tr(
                "Секреты вводятся здесь и сохраняются в зашифрованном системном хранилище. Они не экспортируются вместе с оформлением.",
                "Secrets entered here are encrypted using the operating system’s secure storage. Theme exports do not include them.",
              )}
            </span>
          </div>
          <div className="settings-card">
            <div className="setting-row">
              <div>
                <h3>Microsoft</h3>
                <p>
                  {c.tr(
                    "Официальный вход через браузер и проверка владения Java Edition.",
                    "Official browser sign in and Java Edition ownership verification.",
                  )}
                </p>
              </div>
              <Badge tone={c.s.settings.msClientId ? "green-badge" : ""}>
                {c.s.settings.msClientId
                  ? c.tr("Настроено", "Configured")
                  : c.tr("Нужен Client ID", "Client ID required")}
              </Badge>
            </div>
            <label>
              Application (client) ID
              <input
                value={form.msClientId}
                onChange={(e) => set("msClientId", e.target.value)}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              />
            </label>
            <p className="hint">
              {c.tr(
                "Зарегистрируй приложение Microsoft Entra для личных аккаунтов. Разреши public client / device code flow и доступ к Minecraft Services. Client Secret не нужен.",
                "Register a Microsoft Entra app for personal accounts. Enable public client / device code flow and obtain Minecraft Services access. No client secret is needed.",
              )}
            </p>
            <button
              className="text-link"
              onClick={() =>
                raw(
                  "openUrl",
                  "https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-device-code",
                )
              }
            >
              {c.tr("Документация Microsoft", "Microsoft documentation")}
              <ArrowUpRight size={15} />
            </button>
          </div>
          <div className="settings-card">
            <div className="setting-row">
              <div>
                <h3>Ely.by</h3>
                <p>OAuth 2.0 · minecraft_server_session · authlib-injector</p>
              </div>
              <Badge
                tone={
                  c.s.keys.elySecret && c.s.settings.elyClientId
                    ? "green-badge"
                    : ""
                }
              >
                {c.s.keys.elySecret && c.s.settings.elyClientId
                  ? c.tr("Настроено", "Configured")
                  : c.tr("Нужны ключи", "Credentials required")}
              </Badge>
            </div>
            <label>
              Client ID
              <input
                value={form.elyClientId}
                onChange={(e) => set("elyClientId", e.target.value)}
              />
            </label>
            <label>
              Client Secret
              <input
                type="password"
                value={ely}
                onChange={(e) => setEly(e.target.value)}
                autoComplete="off"
                placeholder={
                  c.s.keys.elySecret
                    ? c.tr("Секрет сохранён", "Secret saved")
                    : c.tr("Введи свой секрет", "Enter your secret")
                }
              />
            </label>
            <button
              className="secondary"
              disabled={!ely}
              onClick={() =>
                c.run(
                  async () => {
                    await raw("setKey", { key: "elySecret", value: ely });
                    setEly("");
                  },
                  c.tr("Секрет сохранён", "Secret saved"),
                )
              }
            >
              <Save size={15} />
              {c.tr("Сохранить секрет", "Save secret")}
            </button>
            {c.s.keys.elySecret && (
              <button
                className="text-link danger key-delete"
                onClick={() =>
                  c.run(() => raw("setKey", { key: "elySecret", value: "" }))
                }
              >
                {c.tr("Удалить секрет", "Delete secret")}
              </button>
            )}
            <label>
              Redirect URI
              <input
                value={form.elyRedirect}
                onChange={(e) => set("elyRedirect", e.target.value)}
              />
            </label>
            <p className="hint">
              {c.tr(
                "Для личной установки зарегистрируй Website-приложение с точно таким же loopback Redirect URI. Для публичного распространения собственный Client Secret следует вынести на доверенный сервер обмена токенов.",
                "For personal use, register a Website app with this exact loopback Redirect URI. Public distributions should move their app secret to a trusted token exchange server.",
              )}
            </p>
            <button
              className="text-link"
              onClick={() =>
                raw("openUrl", "https://docs.ely.by/en/oauth.html")
              }
            >
              {c.tr("Документация Ely.by", "Ely.by documentation")}
              <ArrowUpRight size={15} />
            </button>
          </div>
          <div className="settings-card">
            <div className="setting-row">
              <div>
                <h3>CurseForge</h3>
                <p>
                  {c.tr(
                    "Каталог и загрузки через официальный API.",
                    "Catalog and downloads through the official API.",
                  )}
                </p>
              </div>
              <Badge tone={c.s.keys.curseforge ? "green-badge" : ""}>
                {c.s.keys.curseforge
                  ? c.tr("Ключ сохранён", "Key saved")
                  : c.tr("Нужен API key", "API key required")}
              </Badge>
            </div>
            <label>
              API key
              <input
                type="password"
                autoComplete="off"
                value={cf}
                onChange={(e) => setCf(e.target.value)}
                placeholder={c.s.keys.curseforge ? "••••••••" : ""}
              />
            </label>
            <div className="panel-toolbar">
              <button
                className="secondary"
                disabled={!cf}
                onClick={() =>
                  c.run(
                    async () => {
                      await raw("setKey", { key: "curseforge", value: cf });
                      setCf("");
                    },
                    c.tr("Ключ сохранён", "Key saved"),
                  )
                }
              >
                <Save size={15} />
                {c.tr("Сохранить ключ", "Save key")}
              </button>
              {c.s.keys.curseforge && (
                <button
                  className="text-link danger"
                  onClick={() =>
                    c.run(() => raw("setKey", { key: "curseforge", value: "" }))
                  }
                >
                  {c.tr("Удалить ключ", "Delete key")}
                </button>
              )}
              <button
                className="text-link"
                onClick={() =>
                  raw("openUrl", "https://console.curseforge.com/")
                }
              >
                {c.tr("Получить ключ", "Get a key")}
                <ArrowUpRight size={15} />
              </button>
            </div>
            <p className="hint">
              {c.tr(
                "Некоторые авторы запрещают стороннее распространение. Если API не возвращает ссылку, скачай файл вручную со страницы проекта.",
                "Some authors restrict third-party distribution. If the API returns no download URL, download manually from the project page.",
              )}
            </p>
          </div>
          <div className="settings-card">
            <h3>
              Modrinth{" "}
              <Badge tone="green-badge">
                {c.tr("Без ключа", "No key required")}
              </Badge>
            </h3>
            <p>
              {c.tr(
                "Публичный каталог работает сразу. Запросы содержат User-Agent; ошибки лимитов API показываются в интерфейсе.",
                "The public catalog works immediately. Requests include a User-Agent; API rate-limit errors appear in the UI.",
              )}
            </p>
          </div>
        </>
      )}
      {tab === "about" && (
        <div className="settings-card about-card">
          <span className="about-logo">
            <Logo />
          </span>
          <h2>Luma Launcher</h2>
          <Badge>0.2.0 · Windows x64</Badge>
          <p>
            {c.tr(
              "Независимый лаунчер Minecraft Java Edition.\nСоздан для твоих миров, идей и приключений.",
              "An independent Minecraft Java Edition launcher.\nBuilt for your worlds, ideas and adventures.",
            )}
          </p>
          <div className="about-links">
            {[
              [
                "Mojang metadata",
                "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json",
              ],
              [
                "XMCL",
                "https://github.com/Voxelum/minecraft-launcher-core-node",
              ],
              ["Modrinth API", "https://docs.modrinth.com/api/"],
              ["CurseForge API", "https://docs.curseforge.com/rest-api/"],
              ["Ely.by", "https://docs.ely.by/en/oauth.html"],
            ].map(([label, url]) => (
              <button
                key={label}
                className="secondary"
                onClick={() => raw("openUrl", url)}
              >
                {label}
                <ArrowUpRight size={14} />
              </button>
            ))}
          </div>
          <p className="fine-print">
            Not an official Minecraft product. Not approved by or associated
            with Mojang or Microsoft.
          </p>
          <p className="hint">
            {c.tr(
              "Alpha/Beta и редкие комбинации загрузчиков требуют проверки на конкретной версии. Вход Microsoft/Ely.by и CurseForge требуют ваших ключей и проверки на ваших аккаунтах.",
              "Alpha/Beta and uncommon loader combinations require version-specific testing. Microsoft/Ely.by sign in and CurseForge require your credentials and account-level verification.",
            )}
          </p>
        </div>
      )}
      <div className="bottom-save">
        <button className="primary" onClick={save}>
          <Check size={17} />
          {c.tr("Сохранить изменения", "Save changes")}
        </button>
      </div>
    </>
  );
}
function Toggle({ label, description, value, onChange }: any) {
  return (
    <div className="setting-row">
      <div>
        <strong>{label}</strong>
        <p>{description}</p>
      </div>
      <button
        role="switch"
        aria-checked={value}
        aria-label={label}
        className={"switch " + (value ? "on" : "")}
        onClick={() => onChange(!value)}
      >
        <span />
      </button>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);

