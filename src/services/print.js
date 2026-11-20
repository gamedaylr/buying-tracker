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
export function printHtml(html, { preparedWindow, autoPrint = false } = {}) {
  const doc = printableDocument(html, { autoPrint });
  const win = preparedWindow && !preparedWindow.closed ? preparedWindow : openBlank();
  if (!win) return false;
  try {
    win.document.open();
    win.document.write(doc);
    win.document.close();
  } catch (ignore) {
    return false;
  }
  if (!autoPrint) {
    try {
      win.focus();
      win.print();
    } catch (ignore) {
      // The page still has its own Print button.
    }
  }
  return true;
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
