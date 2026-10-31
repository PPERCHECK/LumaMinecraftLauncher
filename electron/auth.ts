import { shell } from "electron";
import http from "node:http";
import { randomBytes } from "node:crypto";
import { db, save, vault, offlineUUID } from "./storage";
import { json, post, form } from "./network";
import type { Account } from "../src/shared";
const MS = "https://login.microsoftonline.com/consumers/oauth2/v2.0/";
const SCOPE = "XboxLive.signin offline_access";
function store(a: Account, t?: any) {
  const idx = db().accounts.findIndex((x) => x.id === a.id);
  if (t) vault("account:" + a.id, t);
  if (idx < 0) db().accounts.push(a);
  else db().accounts[idx] = a;
  db().activeAccount = a.id;
  save();
  return a;
}
export function addLocal(name: string) {
  if (!/^[a-zA-Z0-9_]{3,16}$/.test(name))
    throw Error("Nickname: 3–16 letters, numbers or _");
  return store({ id: offlineUUID(name), name, type: "local" });
}
async function minecraft(ms: any) {
  const xbox = await post("https://user.auth.xboxlive.com/user/authenticate", {
    Properties: {
      AuthMethod: "RPS",
      SiteName: "user.auth.xboxlive.com",
      RpsTicket: "d=" + ms.access_token,
    },
    RelyingParty: "http://auth.xboxlive.com",
    TokenType: "JWT",
  });
  const xsts = await post("https://xsts.auth.xboxlive.com/xsts/authorize", {
    Properties: { SandboxId: "RETAIL", UserTokens: [xbox.Token] },
    RelyingParty: "rp://api.minecraftservices.com/",
    TokenType: "JWT",
  });
  const mc = await post(
    "https://api.minecraftservices.com/authentication/login_with_xbox",
    {
      identityToken: `XBL3.0 x=${xsts.DisplayClaims.xui[0].uhs};${xsts.Token}`,
    },
  );
  const headers = { Authorization: "Bearer " + mc.access_token };
  const ent = await json(
    "https://api.minecraftservices.com/entitlements/mcstore",
    { headers },
  );
  if (
    !ent.items?.some((x: any) =>
      ["game_minecraft", "product_minecraft"].includes(x.name),
    )
  )
    throw Error("Minecraft Java Edition ownership not found on this account");
  const p = await json("https://api.minecraftservices.com/minecraft/profile", {
    headers,
  });
  return store(
    {
      id: p.id,
      name: p.name,
      type: "microsoft",
      skin: p.skins
        ?.find((x: any) => x.state === "ACTIVE")
        ?.url?.replace(/^http:/, "https:"),
    },
    {
      accessToken: mc.access_token,
      refreshToken: ms.refresh_token,
      expires: Date.now() + mc.expires_in * 1000,
    },
  );
}
let pending = false;
export async function loginMicrosoft(emit: (e: string, v: any) => void) {
  if (pending) throw Error("Sign-in already in progress");
  const client_id = db().settings.msClientId;
  if (!client_id)
    throw Error("Set Microsoft Client ID in Settings → Integrations");
  pending = true;
  try {
    const d = await form(MS + "devicecode", { client_id, scope: SCOPE });
    emit("auth", {
      code: d.user_code,
      url: d.verification_uri,
      expires: d.expires_in,
    });
    await shell.openExternal(d.verification_uri);
    let interval = d.interval || 5;
    const end = Date.now() + d.expires_in * 1000;
    while (Date.now() < end) {
      await new Promise((r) => setTimeout(r, interval * 1000));
      const r = await fetch(MS + "token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id,
          grant_type: "urn:ietf:params:oauth:grant-type:device_code",
          device_code: d.device_code,
        }),
        signal: AbortSignal.timeout(30000),
      });
      const t = (await r.json()) as any;
      if (r.ok) return await minecraft(t);
      if (t.error === "slow_down") {
        interval += 5;
        continue;
      }
      if (t.error === "authorization_pending") continue;
      throw Error(t.error_description || t.error);
    }
    throw Error("Sign-in expired. Try again.");
  } finally {
    pending = false;
    emit("auth", null);
  }
}
const ELY_SCOPE = "account_info minecraft_server_session offline_access";
async function elyAccount(t: any) {
  const p = await json("https://account.ely.by/api/account/v1/info", {
    headers: { Authorization: "Bearer " + t.access_token },
  });
  return store(
    {
      id: p.uuid.replaceAll("-", ""),
      name: p.username,
      type: "ely",
      skin: `https://skinsystem.ely.by/skins/${encodeURIComponent(p.username)}.png`,
    },
    {
      accessToken: t.access_token,
      refreshToken: t.refresh_token,
      expires: Date.now() + t.expires_in * 1000,
    },
  );
}
export async function loginEly() {
  if (pending) throw Error("Sign-in already in progress");
  const s = db().settings,
    secret = vault("elySecret");
  if (!s.elyClientId || !secret)
    throw Error("Set Ely.by Client ID and Client Secret in Settings");
  const redirect = new URL(s.elyRedirect);
  if (
    !["localhost", "127.0.0.1"].includes(redirect.hostname) ||
    redirect.protocol !== "http:" ||
    !redirect.port
  )
    throw Error("Ely.by redirect must be an HTTP loopback URL with a port");
  const state = randomBytes(32).toString("hex");
  pending = true;
  try {
    const code = await new Promise<string>((resolve, reject) => {
      let timer: NodeJS.Timeout;
      const server = http.createServer((req, res) => {
        const u = new URL(req.url || "/", redirect.origin);
        if (u.pathname !== redirect.pathname) {
          res.writeHead(404).end();
          return;
        }
        if (u.searchParams.get("state") !== state) {
          res.writeHead(400).end("Invalid OAuth state");
          return;
        }
        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        res.end("Luma: you may close this browser tab.");
        clearTimeout(timer);
        server.close();
        if (u.searchParams.get("error"))
          reject(Error(u.searchParams.get("error")!));
        else if (u.searchParams.get("code"))
          resolve(u.searchParams.get("code")!);
        else reject(Error("OAuth code missing"));
      });
      server.on("error", (e) => {
        clearTimeout(timer);
        reject(e);
      });
      server.listen(Number(redirect.port), redirect.hostname, () => {
        const u = new URL("https://account.ely.by/oauth2/v1");
        u.search = new URLSearchParams({
          client_id: s.elyClientId,
          redirect_uri: redirect.href,
          response_type: "code",
          scope: ELY_SCOPE,
          state,
        }).toString();
        void shell.openExternal(u.href).catch(reject);
      });
      timer = setTimeout(() => {
        server.close();
        reject(Error("Ely.by sign-in timed out"));
      }, 180000);
    });
    const t = await form("https://account.ely.by/api/oauth2/v1/token", {
      client_id: s.elyClientId,
      client_secret: secret,
      redirect_uri: redirect.href,
      grant_type: "authorization_code",
      code,
    });
    return await elyAccount(t);
  } finally {
    pending = false;
  }
}
export async function credentials() {
  let a = db().accounts.find((x) => x.id === db().activeAccount);
  if (!a) throw Error("Select or add an account");
  if (a.type === "local") return { ...a, accessToken: "0" };
  let t = vault("account:" + a.id);
  if (!t) throw Error("Sign in again");
  if (t.expires < Date.now() + 120000) {
    if (a.type === "microsoft") {
      await minecraft(
        await form(MS + "token", {
          client_id: db().settings.msClientId,
          grant_type: "refresh_token",
          refresh_token: t.refreshToken,
          scope: SCOPE,
        }),
      );
    } else {
      await elyAccount(
        await form("https://account.ely.by/api/oauth2/v1/token", {
          client_id: db().settings.elyClientId,
          client_secret: vault("elySecret"),
          grant_type: "refresh_token",
          refresh_token: t.refreshToken,
          scope: ELY_SCOPE,
        }),
      );
    }
    t = vault("account:" + a.id);
    a = db().accounts.find((x) => x.id === a!.id)!;
  }
  return { ...a, accessToken: t.accessToken };
}
export function removeAccount(id: string) {
  vault("account:" + id, null);
  db().accounts = db().accounts.filter((x) => x.id !== id);
  if (db().activeAccount === id) db().activeAccount = db().accounts[0]?.id;
  save();
}
