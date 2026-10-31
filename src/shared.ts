export type Loader = "vanilla" | "fabric" | "quilt" | "forge" | "neoforge";
export type Account = {
  id: string;
  name: string;
  type: "local" | "microsoft" | "ely";
  skin?: string;
};
export type Mod = {
  file: string;
  name: string;
  source: "modrinth" | "curseforge" | "local";
  projectId?: string;
  versionId?: string;
  version?: string;
  kind: string;
  enabled: boolean;
  url?: string;
  hash?: string;
};
export type Instance = {
  id: string;
  name: string;
  version: string;
  loader: Loader;
  loaderVersion?: string;
  installedVersion?: string;
  memory: number;
  java: string;
  args: string;
  gameArgs: string;
  width: number;
  height: number;
  cover: string;
  minutes: number;
  created: string;
  mods: Mod[];
  description: string;
};
export type Settings = {
  language: "ru" | "en" | "uk" | "de" | "fr" | "es" | "pl" | "pt_br" | "zh_cn";
  theme: "dark" | "light";
  accent: string;
  motion: boolean;
  scale: number;
  density: "comfortable" | "compact";
  sidebar: boolean;
  startPage: string;
  blur: number;
  opacity: number;
  background?: string;
  onboardingDone: boolean;
  msClientId: string;
  elyClientId: string;
  elyRedirect: string;
};
export type Server = { id: string; name: string; address: string };
export type Friend = { id: string; name: string; address: string };
export type Billing = { paymentUrl: string };
export type State = {
  accounts: Account[];
  activeAccount?: string;
  instances: Instance[];
  activeInstance?: string;
  servers: Server[];
  friends: Friend[];
  billing: Billing;
  settings: Settings;
  keys: { curseforge: boolean; elySecret: boolean };
  dataPath: string;
  running: string[];
};
export type Job = {
  id: string;
  label: string;
  instanceId?: string;
  status: "queued" | "running" | "done" | "error" | "cancelled";
  progress: number;
  total: number;
  speed: number;
  phase: string;
  error?: string;
};
export type Project = {
  id: string;
  source: "modrinth" | "curseforge";
  title: string;
  description: string;
  icon?: string;
  downloads: number;
  author: string;
  type: string;
  url: string;
  gallery?: string[];
  body?: string;
};
export type ProjectVersion = {
  id: string;
  name: string;
  date: string;
  gameVersions: string[];
  loaders: string[];
};
export type Version = { id: string; type: string; url: string; sha1: string };
export type API = {
  call: (method: string, data?: any) => Promise<any>;
  on: (event: string, fn: (data: any) => void) => () => void;
};
declare global {
  interface Window {
    luma: API;
  }
}
