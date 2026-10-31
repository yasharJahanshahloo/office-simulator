/**
 * /avatar: the avatar creator. Builds an AvatarSetup, previews it live and shows its code
 * plus the bot command. No server calls; the current setup lives in the URL hash (#A1-XXXXX).
 */
import './creator.css';
import {
  type AvatarSetup,
  FACIAL_HAIR,
  FACIAL_HAIR_FA,
  HAIR_COLORS,
  HAIR_STYLES,
  HAIR_STYLE_FA,
  PANTS_COLORS,
  SHIRT_COLORS,
  SKIN_TONES,
  type Swatch,
  decodeAvatar,
  encodeAvatar,
} from '../../../shared/avatar';
import { randomAvatar } from '../avatars/setup';
import { Preview } from './preview';

const BOT = 'office_sims_bot';

type SwatchField = 'skin' | 'hairColor' | 'shirt' | 'pants';
type ChoiceField = 'hairStyle' | 'facialHair';
type ToggleField = 'glasses' | 'headphones';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

function swatchGroup(field: SwatchField, title: string, items: readonly Swatch[]): string {
  return `<section class="group" data-group="${field}">
    <h2>${title}</h2>
    <div class="swatches" role="radiogroup" aria-label="${title}">
      ${items
        .map(
          (s, i) =>
            `<button type="button" class="swatch" role="radio" data-field="${field}" data-value="${i}"
              style="--c:${s.hex}" title="${esc(s.fa)}" aria-label="${esc(s.fa)}"></button>`,
        )
        .join('')}
    </div>
  </section>`;
}

function chipGroup<T extends string>(field: ChoiceField, title: string, values: readonly T[], fa: Record<T, string>) {
  return `<section class="group" data-group="${field}">
    <h2>${title}</h2>
    <div class="chips" role="radiogroup" aria-label="${title}">
      ${values
        .map((v) => `<button type="button" class="chip" role="radio" data-field="${field}" data-value="${v}">${fa[v]}</button>`)
        .join('')}
    </div>
  </section>`;
}

function toggle(field: ToggleField, label: string): string {
  return `<button type="button" class="toggle" role="switch" data-field="${field}">
    <span class="toggle-track"><span class="toggle-thumb"></span></span>${label}
  </button>`;
}

const root = document.querySelector<HTMLElement>('#creator')!;
root.innerHTML = `
  <header class="top">
    <div>
      <h1>ساخت آواتار</h1>
      <p class="lead">آواتار خودتان را برای دفتر بسازید و کدش را برای ربات بفرستید.</p>
    </div>
    <a class="back" href="/">دفتر</a>
  </header>
  <main class="layout">
    <div class="viewer">
    <div class="stage">
      <div class="preview" aria-label="پیش‌نمایش آواتار"></div>
      <div class="pose" role="radiogroup" aria-label="حالت">
        <button type="button" data-pose="working" role="radio">در حال کار</button>
        <button type="button" data-pose="idle" role="radio">استراحت</button>
      </div>
      <p class="hint">برای چرخاندن، بکشید</p>
    </div>
      <section class="output" aria-live="polite">
        <div class="code-label">کد آواتار شما</div>
        <div class="code" dir="ltr"></div>
        <div class="actions">
          <button type="button" class="copy">کپی دستور</button>
          <a class="bale" target="_blank" rel="noopener">باز کردن در بله</a>
        </div>
        <p class="howto">دستور را کپی کنید و برای ربات <a href="https://ble.ir/${BOT}" target="_blank" rel="noopener"><bdi dir="ltr">@${BOT}</bdi></a> در بله بفرستید.</p>
      </section>
    </div>
      <div class="controls">
        ${swatchGroup('skin', 'رنگ پوست', SKIN_TONES)}
        ${chipGroup('hairStyle', 'مدل مو', HAIR_STYLES, HAIR_STYLE_FA)}
        ${swatchGroup('hairColor', 'رنگ مو', HAIR_COLORS)}
        ${chipGroup('facialHair', 'ریش و سبیل', FACIAL_HAIR, FACIAL_HAIR_FA)}
        ${swatchGroup('shirt', 'رنگ پیراهن', SHIRT_COLORS)}
        ${swatchGroup('pants', 'رنگ شلوار', PANTS_COLORS)}
        <section class="group">
          <h2>لوازم</h2>
          <div class="toggles">${toggle('glasses', 'عینک')}${toggle('headphones', 'هدفون')}</div>
        </section>
        <button type="button" class="random">تصادفی</button>
      </div>
  </main>`;

const preview = new Preview(root.querySelector<HTMLElement>('.preview')!);
const codeEl = root.querySelector<HTMLElement>('.code')!;
const copyBtn = root.querySelector<HTMLButtonElement>('.copy')!;
const baleLink = root.querySelector<HTMLAnchorElement>('.bale')!;

let setup: AvatarSetup = fromHash() ?? randomAvatar();

function fromHash(): AvatarSetup | null {
  const raw = decodeURIComponent(location.hash.slice(1));
  return raw ? decodeAvatar(raw) : null;
}

function render(): void {
  const code = encodeAvatar(setup);
  if (location.hash !== `#${code}`) history.replaceState(null, '', `#${code}`);
  codeEl.textContent = code;
  baleLink.href = `https://ble.ir/${BOT}?start=avatar_${code}`;
  preview.setLook(setup);

  root.querySelectorAll<HTMLButtonElement>('[data-field]').forEach((b) => {
    const field = b.dataset.field as keyof AvatarSetup;
    const value = setup[field];
    const on = typeof value === 'boolean' ? value : String(value) === b.dataset.value;
    b.setAttribute('aria-checked', String(on));
    b.classList.toggle('on', on);
  });
  // hair colour only matters if there is hair (or facial hair) to colour
  root
    .querySelector('[data-group="hairColor"]')!
    .classList.toggle('muted', setup.hairStyle === 'bald' && setup.facialHair === 'none');
}

root.querySelector('.controls')!.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button');
  if (!btn) return;
  if (btn.classList.contains('random')) {
    setup = randomAvatar();
  } else {
    const field = btn.dataset.field;
    const v = btn.dataset.value!;
    if (field === 'glasses' || field === 'headphones') setup = { ...setup, [field]: !setup[field] };
    else if (field === 'hairStyle' || field === 'facialHair') setup = { ...setup, [field]: v };
    else if (field) setup = { ...setup, [field]: Number(v) };
    else return;
  }
  resetCopy();
  render();
});

const poseBtns = root.querySelectorAll<HTMLButtonElement>('[data-pose]');
const setPose = (pose: 'working' | 'idle') => {
  preview.setPose(pose);
  poseBtns.forEach((b) => {
    const on = b.dataset.pose === pose;
    b.classList.toggle('on', on);
    b.setAttribute('aria-checked', String(on));
  });
};
poseBtns.forEach((b) => b.addEventListener('click', () => setPose(b.dataset.pose as 'working' | 'idle')));
setPose('working');

/* ------------------------------------------------------------------ copy */

/** Clipboard API where allowed; the site is plain http on a LAN IP, so usually the fallback. */
async function copyText(text: string): Promise<boolean> {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      /* fall through */
    }
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;';
  document.body.appendChild(ta);
  ta.select();
  ta.setSelectionRange(0, text.length);
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  ta.remove();
  return ok;
}

let copyTimer = 0;
function resetCopy(): void {
  clearTimeout(copyTimer);
  copyBtn.textContent = 'کپی دستور';
  copyBtn.classList.remove('done');
}

copyBtn.addEventListener('click', async () => {
  const ok = await copyText(`/avatar ${encodeAvatar(setup)}`);
  clearTimeout(copyTimer);
  copyBtn.textContent = ok ? 'کپی شد ✓' : 'کپی نشد؛ کد را دستی کپی کنید';
  copyBtn.classList.toggle('done', ok);
  if (!ok) window.getSelection()?.selectAllChildren(codeEl);
  copyTimer = window.setTimeout(resetCopy, 2500);
});

// a pasted link or edited hash: show that avatar; an invalid code puts the current one back
window.addEventListener('hashchange', () => {
  const next = fromHash();
  if (next && encodeAvatar(next) !== encodeAvatar(setup)) {
    setup = next;
    resetCopy();
  }
  render();
});

render();

// for screenshots and the console
Object.assign(window, {
  setAvatar: (code: string) => {
    const a = decodeAvatar(code);
    if (a) {
      setup = a;
      render();
    }
    return !!a;
  },
  setPose,
  preview,
});
