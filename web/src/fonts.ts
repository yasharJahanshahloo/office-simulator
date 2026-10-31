/**
 * Font stack shared by the HUD and canvas textures. Vazirmatn (loaded in index.html)
 * covers Latin + Persian; emoji fall through to the system emoji fonts.
 */
export const FONT_STACK =
  "Vazirmatn, system-ui, -apple-system, 'Segoe UI', 'Noto Sans Arabic', Tahoma, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji'";

/** First strong character is right-to-left (Hebrew / Arabic / Persian). */
export function isRtl(text: string): boolean {
  const m = text.match(/[A-Za-zÀ-ɏ֐-ࣿיִ-﷿ﹰ-﻿]/);
  return !!m && /[֐-ࣿיִ-﷿ﹰ-﻿]/.test(m[0]);
}

/**
 * Resolves once the web font needed for `text` has loaded (or failed).
 * Canvas textures draw immediately with fallbacks and redraw after this.
 */
export function whenFontReady(font: string, text: string): Promise<void> {
  if (!('fonts' in document)) return Promise.resolve();
  return document.fonts.load(font, text).then(
    () => undefined,
    () => undefined,
  );
}
