import { translationLanguages } from './translation-languages.js';

const publicOrigin = 'https://arewethereyet.now';
const translatedHost = 'arewethereyet-now.translate.goog';
const providerLanguage = { iw: 'he', jw: 'jv', crh: 'crh-Cyrl' };
const collator = new Intl.Collator(undefined, { sensitivity: 'base' });
const languages = Object.entries(translationLanguages).sort((a, b) => collator.compare(a[1], b[1]));

function currentLanguage() {
  if (location.hostname !== translatedHost) return 'en';
  const target = new URL(location.href).searchParams.get('_x_tr_tl') || 'en';
  const match = languages.find(([code]) =>
    code.toLowerCase() === target.toLowerCase() || providerLanguage[code] === target
  );
  return match?.[0] ?? 'en';
}

function originalPage() {
  const page = new URL(document.querySelector('link[rel="canonical"]').href);
  const original = new URL(page.pathname, publicOrigin);
  for (const [key, value] of new URL(location.href).searchParams) {
    if (!key.startsWith('_x_tr_')) original.searchParams.append(key, value);
  }
  original.hash = location.hash;
  return original;
}

function pageInLanguage(code) {
  const original = originalPage();
  if (code === 'en') return original;
  const address = new URL('https://translate.google.com/translate');
  address.searchParams.set('sl', 'en');
  address.searchParams.set('tl', code);
  address.searchParams.set('u', original.href);
  return address;
}

class SiteLanguageMenu extends HTMLElement {
  connectedCallback() {
    if (this.firstElementChild) return;
    const label = document.createElement('label');
    label.append('Language');
    const select = document.createElement('select');
    select.name = 'language';
    select.setAttribute('aria-label', 'Change page language');
    select.title = 'Selecting a language opens a Google translation. Choose English for the original.';
    // Autonyms must retain their own language and script when the rest of the page changes.
    select.translate = false;
    select.className = 'notranslate';
    const active = currentLanguage();
    const original = new Option(translationLanguages.en, 'en');
    original.lang = 'en';
    select.append(original);
    const translations = document.createElement('optgroup');
    translations.label = 'Google Translate';
    for (const [code, name] of languages) {
      if (code === 'en') continue;
      const option = new Option(name, code);
      option.lang = providerLanguage[code] ?? code;
      option.dir = 'auto';
      translations.append(option);
    }
    select.append(translations);
    select.value = active;
    label.append(select);
    this.append(label);
    // The translation service may replace label contents. Listen on the host.
    this.onchange = (event) => {
      const choice = event.target;
      if (choice.matches('select[name="language"]') && choice.value !== currentLanguage()) {
        location.assign(pageInLanguage(choice.value).href);
      }
    };
  }
}

customElements.define('site-language-menu', SiteLanguageMenu);
