/* Site language switcher: English <-> Bulgarian.
 *
 * How it works
 *  - The English text lives in the HTML (so crawlers and no-JS visitors see it). Elements that can be
 *    translated carry data-i18n="key"; the Bulgarian text is in js/i18n-bg.js under the same key.
 *  - Switching swaps the text in place (no reload). The English is remembered from the page itself,
 *    so switching back restores it exactly.
 *  - The choice is stored in localStorage; ?lang=bg / ?lang=en in the URL overrides it; on a first visit
 *    a Bulgarian browser gets Bulgarian, everyone else English.
 *  - Text set from JavaScript (form messages etc.) goes through i18n.t('key', 'English fallback').
 *
 * Attributes: see tools/i18n_tool.py (that tool adds them; you rarely need to write them by hand).
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'bpc_lang';
  var LANGS = ['en', 'bg'];
  var ATTRS = ['alt', 'title', 'placeholder', 'aria-label', 'content'];
  var dictionaries = { bg: window.I18N_BG || {} };

  var originals = new WeakMap();   // element -> the English it started with
  var current = 'en';
  var buttons = [];

  // ── choosing the language ────────────────────────────────────────────────
  function stored() {
    try { return localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
  }

  function remember(lang) {
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) { /* private mode: fine, just not remembered */ }
  }

  // Keep in sync with the tiny inline snippet in each page's <head> (it hides the page while a
  // Bulgarian visitor's text is being swapped in, to avoid a flash of English).
  function detect() {
    var fromUrl = new URLSearchParams(location.search).get('lang');
    if (LANGS.indexOf(fromUrl) !== -1) { remember(fromUrl); return fromUrl; }
    if (LANGS.indexOf(stored()) !== -1) return stored();
    return 'bg';
  }

  // ── translating ──────────────────────────────────────────────────────────
  function record(el) {
    var rec = originals.get(el);
    if (!rec) { rec = {}; originals.set(el, rec); }
    return rec;
  }

  function translation(lang, key) {
    var dict = dictionaries[lang];
    return lang !== 'en' && dict && dict[key] ? dict[key] : null;
  }

  function firstTextNode(el) {
    for (var n = el.firstChild; n; n = n.nextSibling) {
      if (n.nodeType === 3 && n.nodeValue.trim()) return n;
    }
    return null;
  }

  // keep the original indentation/spaces around the text, so inline layout doesn't shift
  function keepSpacing(original, text) {
    return original.match(/^\s*/)[0] + text + original.match(/\s*$/)[0];
  }

  // Bulgarian typesetting: never leave a one- or two-letter word (в, с, на, за, от, до...) hanging at the
  // end of a line. Such a word is joined to the next one with a non-breaking space.
  function tidy(text) {
    var words = text.split(' ');
    var out = words[0];
    for (var i = 1; i < words.length; i++) {
      out += (/^[\u0400-\u04FF]{1,2}$/.test(words[i - 1]) ? '\u00a0' : ' ') + words[i];
    }
    return out;
  }

  // .reveal elements start at opacity 0 and fade in when they get the "in" class
  function reveal(root) {
    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () {
        root.querySelectorAll('.reveal').forEach(function (n) { n.classList.add('in'); });
      });
    });
  }

  function translateText(el, lang) {
    var text = translation(lang, el.getAttribute('data-i18n'));
    var rec = record(el);
    if (el.hasAttribute('data-i18n-html')) {
      if (rec.html === undefined) rec.html = el.innerHTML;
      el.innerHTML = text || rec.html;
      return;
    }
    var node = firstTextNode(el);   // looked up every time: a script may have replaced the text node
    if (!node) return;
    if (rec.text === undefined) rec.text = node.nodeValue;
    node.nodeValue = text ? keepSpacing(rec.text, tidy(text)) : rec.text;
  }

  // The hero headline is animated word by word, so it is rebuilt from the translated sentence.
  function translateWords(el, lang) {
    var text = translation(lang, el.getAttribute('data-i18n-words'));
    var rec = record(el);
    if (rec.html === undefined) rec.html = el.innerHTML;
    if (!text) {
      el.innerHTML = rec.html;
      reveal(el);
      return;
    }
    var words = tidy(text).split(' ');
    var wordClass = el.getAttribute('data-words-class') || '';
    el.textContent = '';
    words.forEach(function (word, i) {
      var span = document.createElement('span');
      span.className = wordClass + ' delay-' + Math.min(3 + Math.floor(i / 2), 6);
      span.textContent = word;
      el.appendChild(span);
      if (i < words.length - 1) el.appendChild(document.createTextNode(' '));
    });
    reveal(el);
  }

  function translateAttribute(el, attr, lang) {
    var rec = record(el);
    rec.attrs = rec.attrs || {};
    if (!(attr in rec.attrs)) rec.attrs[attr] = el.getAttribute(attr);
    var text = translation(lang, el.getAttribute('data-i18n-' + attr));
    el.setAttribute(attr, text || rec.attrs[attr]);
  }

  function apply(lang) {
    document.querySelectorAll('[data-i18n]').forEach(function (el) { translateText(el, lang); });
    document.querySelectorAll('[data-i18n-words]').forEach(function (el) { translateWords(el, lang); });
    ATTRS.forEach(function (attr) {
      document.querySelectorAll('[data-i18n-' + attr + ']').forEach(function (el) { translateAttribute(el, attr, lang); });
    });
    // Links to content that exists as a separate page per language (the blog articles): data-href-bg / data-href-en.
    document.querySelectorAll('[data-href-bg][data-href-en]').forEach(function (el) {
      el.setAttribute('href', el.getAttribute('data-href-' + lang));
    });
  }

  // ── public API ───────────────────────────────────────────────────────────
  function setLang(lang, persist) {
    if (LANGS.indexOf(lang) === -1) return;
    current = lang;
    apply(lang);
    document.documentElement.lang = lang;
    document.documentElement.setAttribute('data-lang', lang);
    buttons.forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-lang') === lang));
    });
    if (persist) remember(lang);
    document.dispatchEvent(new CustomEvent('bpc:languagechange', { detail: { lang: lang } }));
  }

  // For text produced by scripts: i18n.t('key', 'English text'). Falls back to the English given.
  function t(key, fallback) {
    return translation(current, key) || fallback;
  }

  // Dev helper: keys used on this page that have no Bulgarian yet.   >>> i18n.missing()
  function missing() {
    var found = {};
    document.querySelectorAll('*').forEach(function (el) {
      Array.prototype.forEach.call(el.attributes, function (a) {
        if (a.name.indexOf('data-i18n') === 0 && a.name !== 'data-i18n-html') found[a.value] = true;
      });
    });
    return Object.keys(found).filter(function (k) { return !dictionaries.bg[k]; });
  }

  function init() {
    buttons = Array.prototype.slice.call(document.querySelectorAll('.lang-btn[data-lang]'));
    buttons.forEach(function (b) {
      b.addEventListener('click', function () { setLang(b.getAttribute('data-lang'), true); });
    });
    setLang(detect(), false);
    document.documentElement.classList.remove('i18n-loading');
  }

  window.i18n = { t: t, getLang: function () { return current; }, setLang: function (l) { setLang(l, true); }, missing: missing };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
