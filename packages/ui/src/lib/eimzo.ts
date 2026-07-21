/**
 * Thin client for the locally-installed E-IMZO application.
 *
 * E-IMZO listens on a websocket on the signer's own machine. Everything here happens there: the
 * key is read from their disk, the password is typed into E-IMZO's own native window, and only
 * the finished signature crosses to us. The key and the password never reach the browser, let
 * alone the server — that is a property of the design, not a promise we keep.
 *
 * Verified against E-IMZO v6.4.7. From localhost the socket answers with no apikey registration;
 * from any other origin it answers -1022 — its built-in allowlist is localhost and 127.0.0.1 and
 * nothing else, so any production host is refused until NIC issues a domain API-KEY.
 *
 * Until then each director's E-IMZO runs with «Режим разработчика» on, which drops the origin
 * check — for every site they visit, not just this one. deploy/README.md states what that exposes
 * and what the directors have to be told; the short version is that E-IMZO's password window does
 * not name who asked for it, so it is the human, not the code, holding that line.
 *
 * Ported verbatim from the spravka project, where this flow is in production use. Behaviour is
 * deliberately unchanged — the constants below are measured against a real E-IMZO install, not
 * derived from its (absent) documentation.
 */

const WS_URL = 'wss://127.0.0.1:64443/service/cryptapi';
const CALL_TIMEOUT_MS = 120_000; // loading a key waits on a human typing a password

/** A key E-IMZO found on this machine. `disk` may be a flash drive — it scans all of them. */
export interface EimzoKey {
  disk: string;
  path: string;
  name: string;
  alias: string;
}

export type EimzoStatus = 'checking' | 'ready' | 'not-running' | 'domain-denied';

/**
 * Why E-IMZO could not be used — the two reasons look identical to the user and are opposite in
 * meaning. 'not-running' is theirs to fix (open the app). 'domain-denied' is ours (the site has
 * no API-KEY for this domain) and no amount of restarting will help.
 */
export type EimzoProbe =
  | { status: 'ready'; keys: EimzoKey[] }
  | { status: 'not-running' }
  | { status: 'domain-denied'; reason: string };

interface Reply {
  success?: boolean;
  status?: number;
  reason?: string;
  [k: string]: unknown;
}

/** E-IMZO refused or is not there. Carries a message meant for the rahbar, not a stack trace. */
export class EimzoError extends Error {}

/**
 * E-IMZO's own code for "this domain has no API-KEY": measured, not documented — the client
 * answers -1022 «API-key для домена <origin> недействителен» to any origin outside its built-in
 * list, which is localhost and 127.0.0.1 only. A production domain needs a key from the centre.
 */
const DOMAIN_DENIED = -1022;

/** Raised when the *site*, not the signer's machine, is the problem. */
export class EimzoDomainError extends EimzoError {}

/**
 * One websocket per call — E-IMZO's own client does the same, and a long-lived socket would
 * otherwise sit open while the user reads the page.
 */
function call<T extends Reply>(plugin: string, name: string, args: unknown[] = []): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let ws: WebSocket;
    try {
      ws = new WebSocket(WS_URL);
    } catch {
      reject(new EimzoError('E-IMZO dasturi bilan bogʻlanib boʻlmadi'));
      return;
    }

    const timer = setTimeout(() => {
      try {
        ws.close();
      } catch {}
      reject(new EimzoError('E-IMZO javob bermadi'));
    }, CALL_TIMEOUT_MS);

    const done = (fn: () => void) => {
      clearTimeout(timer);
      try {
        ws.close();
      } catch {}
      fn();
    };

    ws.onerror = () => done(() => reject(new EimzoError('E-IMZO dasturi ishga tushmagan')));
    ws.onclose = (e) => {
      if (e.code !== 1000) done(() => reject(new EimzoError('E-IMZO ulanishi uzildi')));
    };
    ws.onmessage = (ev) => {
      let data: T;
      try {
        data = JSON.parse(ev.data as string) as T;
      } catch {
        done(() => reject(new EimzoError('E-IMZO tushunarsiz javob qaytardi')));
        return;
      }
      done(() => {
        // `success: false` is E-IMZO reporting a real problem — a wrong password, a cancelled
        // dialog, an unreadable key. Its own reason is more useful than anything we could invent.
        if (data.success === false) {
          const Err = data.status === DOMAIN_DENIED ? EimzoDomainError : EimzoError;
          reject(new Err(data.reason || 'E-IMZO amalni bajarmadi'));
        } else resolve(data);
      });
    };
    ws.onopen = () => ws.send(JSON.stringify({ plugin, name, arguments: args.map(String) }));
  });
}

/**
 * Ask E-IMZO for the keys, and learn from the answer why it will not work when it will not.
 *
 * One call rather than a separate liveness ping, because the two failures need telling apart and
 * this is the call that distinguishes them. A dead socket means the app is not running — the
 * rahbar can fix that. A -1022 means the app is running fine and refusing *this site* — no amount
 * of restarting helps, and telling them "E-IMZO is not running" would send them to fix the one
 * thing that is not broken.
 *
 * Keys come from every disk E-IMZO can see, a flash drive included; it finds them itself, so the
 * rahbar picks from a list rather than hunting for a file.
 */
export async function probeEimzo(): Promise<EimzoProbe> {
  try {
    const r = await call<{ certificates?: EimzoKey[] }>('pfx', 'list_all_certificates');
    return { status: 'ready', keys: r.certificates ?? [] };
  } catch (e) {
    if (e instanceof EimzoDomainError) return { status: 'domain-denied', reason: e.message };
    return { status: 'not-running' };
  }
}

/**
 * Unlock a key. E-IMZO opens its own password window here — nothing about that window is ours,
 * which is exactly why the password never touches the page. Returns a handle that lives in
 * E-IMZO's memory for a short while.
 */
export async function loadKey(key: EimzoKey): Promise<string> {
  const r = await call<{ keyId?: string }>('pfx', 'load_key', [key.disk, key.path, key.name, key.alias]);
  if (!r.keyId) throw new EimzoError('Kalit ochilmadi');
  return r.keyId;
}

/** Sign base64 data with an unlocked key, returning attached PKCS#7/CMS (also base64). */
export async function createPkcs7(dataBase64: string, keyId: string): Promise<string> {
  const r = await call<{ pkcs7_64?: string }>('pkcs7', 'create_pkcs7', [dataBase64, keyId, 'no']);
  if (!r.pkcs7_64) throw new EimzoError('Imzo yaratilmadi');
  return r.pkcs7_64;
}

/** Drop the unlocked key from E-IMZO's memory. Best-effort: it also expires on its own. */
export async function unloadKey(keyId: string): Promise<void> {
  try {
    await call('pfx', 'unload_key', [keyId]);
  } catch {
    /* the key expires by itself; failing to tidy up is not worth an error to the user */
  }
}
