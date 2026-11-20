import { printableDocument } from '../lib/printHtml';

const WAITING_HTML = '<!DOCTYPE html><html><head><title>Saving slip…</title><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="font-family:Arial,sans-serif;padding:24px;font-size:16px"><p>Saving the slip…</p></body></html>';

function openBlank() {
  if (typeof window === 'undefined' || typeof window.open !== 'function') return null;
  try {
    return window.open('', '_blank');
  } catch (ignore) {
    return null;
  }
}

/**
 * Open the print tab during the tap, before any save request.
 * Mobile Safari and Chrome only allow a new window from that tap.
 */
export function preparePrintWindow() {
  const win = openBlank();
  if (!win) return null;
  try {
    win.document.open();
    win.document.write(WAITING_HTML);
    win.document.close();
  } catch (ignore) {
    // The window can still receive the slip in a moment.
  }
  return win;
}

export function closePrintWindow(win) {
  if (!win || win.closed) return;
  try {
    win.close();
  } catch (ignore) {
    // Already closed.
  }
}

/**
 * Print a slip or receipt.
 * autoPrint writes a script that prints when the new tab loads. Use that
 * after a save, when the tab was opened on the original tap.
 * A direct Print tap should leave autoPrint off so print() runs in the tap.
 */
export function printHtml(html, { preparedWindow, autoPrint = false, trackLabel = false } = {}) {
  const doc = printableDocument(html, { autoPrint, trackLabel });
  const win = preparedWindow && !preparedWindow.closed ? preparedWindow : openBlank();
  if (!win) return null;
  try {
    win.document.open();
    win.document.write(doc);
    win.document.close();
  } catch (ignore) {
    return null;
  }
  if (!autoPrint) {
    try {
      win.focus();
      win.print();
    } catch (ignore) {
      // The page still has its own Print button.
    }
  }
  return win;
}

/** Follow a label window so the desk can say when the print was skipped or cancelled. */
export function watchLabelPrint(win, onStatus) {
  if (!win) {
    onStatus('blocked');
    return () => {};
  }
  let sawDialog = false;
  let settled = false;
  function finish(status) {
    if (settled) return;
    if (status === 'dialog-opened') {
      sawDialog = true;
      onStatus('dialog');
      return;
    }
    settled = true;
    window.removeEventListener('message', onMessage);
    clearInterval(timer);
    if (status === 'dialog-closed' || sawDialog) onStatus('check');
    else onStatus('cancelled');
  }
  function onMessage(event) {
    const data = event.data;
    if (!data || data.source !== 'gameday-label') return;
    if (data.result === 'dialog-opened') finish('dialog-opened');
    else if (data.result === 'dialog-closed') finish('dialog-closed');
    else if (data.result === 'skipped') finish('skipped');
  }
  window.addEventListener('message', onMessage);
  const timer = setInterval(() => {
    if (win.closed) finish('window-closed');
  }, 400);
  return () => {
    settled = true;
    window.removeEventListener('message', onMessage);
    clearInterval(timer);
  };
}

export function absoluteAsset(url) {
  try {
    return new URL(url, window.location.href).href;
  } catch (ignore) {
    return url;
  }
}

export async function copyText(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const area = document.createElement('textarea');
  area.value = text;
  document.body.appendChild(area);
  area.select();
  document.execCommand('copy');
  area.remove();
}

export function downloadText(filename, text, type = 'text/csv') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
