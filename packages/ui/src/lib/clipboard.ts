/**
 * Copy text to the clipboard, returning whether it actually succeeded.
 *
 * `navigator.clipboard` only exists in a secure context (HTTPS or localhost); over plain HTTP
 * it is `undefined`, so we fall back to a temporary <textarea> + document.execCommand('copy'),
 * which still works everywhere. Callers should surface real success/failure to the user rather
 * than assuming the copy happened (the old `navigator.clipboard?.writeText(...)` silently no-op'd
 * on HTTP while still showing a "copied" toast).
 */
export async function copyText(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Permission denied or blocked — fall through to the legacy path.
    }
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
