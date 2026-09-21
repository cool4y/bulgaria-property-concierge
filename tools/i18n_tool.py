#!/usr/bin/env python3
"""
Translation helper for the static pages (index.html, properties.html).

The English text in the HTML is the source of truth. Every translatable string carries a
`data-i18n="key"` attribute, and the Bulgarian text lives in js/i18n-bg.js under the same key.
This tool keeps the two in sync so nobody has to tag strings or edit the dictionary by hand.

  python tools/i18n_tool.py check              report untagged text, untranslated keys, orphans
  python tools/i18n_tool.py tag                tag new/untagged text in both pages and add the new
                                               keys to js/i18n-bg.js with an empty translation
  python tools/i18n_tool.py tag --pending F    ...and also write the untranslated entries to F (JSON)
  python tools/i18n_tool.py import F           fill translations from a JSON file {"key": "Български"}

Attribute reference (what the tool writes, what js/i18n.js reads):
  data-i18n="key"            replace the element's own text
  data-i18n-html             ...and treat the translation as HTML (for text with inline markup)
  data-i18n-alt / -title / -placeholder / -aria-label / -content="key"   translate that attribute
  data-i18n-words="key"      the hero headline: rebuilt word by word (see js/i18n.js)
  data-no-i18n               leave this element (and everything inside it) untranslated
"""
import html
import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PAGES = ['index.html', 'properties.html']
DICT_FILE = ROOT / 'js' / 'i18n-bg.js'

VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param',
        'source', 'track', 'wbr'}
SKIP_TAGS = {'script', 'style', 'svg', 'noscript', 'template'}
TEXT_ATTRS = ['alt', 'aria-label', 'title', 'placeholder']  # translated when they contain English

# Text set from JavaScript:  tr('key', 'English')   showStatus('key', 'English', ...)   { key: 'k', english: 'English' }
_STR = r"""(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")"""
JS_CALL_RE = re.compile(r"\b(?:tr|showStatus)\(\s*'([a-z0-9-]+)'\s*,\s*" + _STR)
JS_OBJ_RE = re.compile(r"key:\s*'([a-z0-9-]+)'\s*,\s*english:\s*" + _STR)


def js_unescape(text):
    return re.sub(r"\\(['\"\\])", r"\1", text)


DICT_HEADER = """/* Bulgarian translations. Loaded by js/i18n.js on every page.
 *
 * Format:  "key": "Bulgarian text",   (the `// EN:` line above each entry is the English original)
 * - Keys are attached to the HTML with data-i18n="key". Empty "" means "not translated yet"
 *   and falls back to English.
 * - Entries whose English contains markup (<span>, <br/>, ...) are HTML: keep the same tags.
 * - After adding or changing English text in a page run:  python tools/i18n_tool.py tag
 *   then translate the empty entries here, and finish with:  python tools/i18n_tool.py check
 */
window.I18N_BG = {
"""


# ─────────────────────────────── parsing ───────────────────────────────
class El:
    __slots__ = ('tag', 'attrs', 'start', 'open_end', 'close_start', 'close_end', 'parent', 'children')

    def __init__(self, tag, attrs, start, open_end, parent):
        self.tag, self.attrs = tag, dict(attrs)
        self.start, self.open_end = start, open_end
        self.close_start = self.close_end = None
        self.parent, self.children = parent, []

    def has(self, name):
        return name in self.attrs


class TreeBuilder(HTMLParser):
    """Builds an element tree that remembers exact source offsets, so attributes can be
    inserted into the original text without re-serialising (and disturbing) the HTML."""

    def __init__(self, src):
        super().__init__(convert_charrefs=False)
        self.src = src
        self.line_starts = [0] + [m.end() for m in re.finditer('\n', src)]
        self.root = El('#root', [], 0, 0, None)
        self.root.close_start = self.root.close_end = len(src)
        self.stack = [self.root]
        self.comments = []

    def pos(self):
        line, col = self.getpos()
        return self.line_starts[line - 1] + col

    def handle_starttag(self, tag, attrs, self_closing=False):
        start = self.pos()
        raw = self.get_starttag_text()
        el = El(tag, attrs, start, start + len(raw), self.stack[-1])
        self.stack[-1].children.append(el)
        if tag in VOID or self_closing:
            el.close_start = el.close_end = el.open_end
        else:
            self.stack.append(el)

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs, self_closing=True)

    def handle_endtag(self, tag):
        start = self.pos()
        end = self.src.index('>', start) + 1
        for i in range(len(self.stack) - 1, 0, -1):
            if self.stack[i].tag == tag:
                for el in self.stack[i + 1:]:
                    el.close_start = el.close_end = start
                self.stack[i].close_start, self.stack[i].close_end = start, end
                del self.stack[i:]
                return

    def handle_comment(self, data):
        start = self.pos()
        self.comments.append((start, self.src.index('-->', start) + 3))

    def handle_decl(self, decl):
        start = self.pos()
        self.comments.append((start, self.src.index('>', start) + 1))

    def finish(self):
        for el in self.stack[1:]:
            el.close_start = el.close_end = len(self.src)


def parse(src):
    tb = TreeBuilder(src)
    tb.feed(src)
    tb.close()
    tb.finish()
    return tb


def norm(s):
    return re.sub(r'\s+', ' ', s).strip()


def has_letters(raw):
    return re.search(r'[A-Za-z]', html.unescape(raw)) is not None


def text_gaps(el, comments):
    """The stretches of source directly inside `el` that are not child elements or comments."""
    lo, hi = el.open_end, el.close_start
    busy = [(c.start, c.close_end) for c in el.children]
    busy += [(a, b) for a, b in comments if lo <= a and b <= hi]
    busy.sort()
    out, cur = [], lo
    for a, b in busy:
        if a > cur:
            out.append((cur, a))
        cur = max(cur, b)
    if cur < hi:
        out.append((cur, hi))
    return out


# ─────────────────────────────── analysis ───────────────────────────────
class Unit:
    """One translatable thing: an element's text, or one of its attributes."""

    def __init__(self, kind, el, key=None, en=None, attr=None, mode='plain'):
        self.kind, self.el, self.key, self.en, self.attr, self.mode = kind, el, key, en, attr, mode
        self.tagged = key is not None


def analyse(tb):
    src, comments = tb.src, tb.comments
    units, inserts, notes = [], [], []
    cache = {}

    def skipped(el):
        return el.tag in SKIP_TAGS or el.has('data-no-i18n')

    def has_text(el):
        if el in cache:
            return cache[el]
        found = False
        if not skipped(el):
            found = any(has_letters(src[a:b]) for a, b in text_gaps(el, comments)) or \
                any(has_text(c) for c in el.children)
        cache[el] = found
        return found

    def attr_units(el, auto):
        for name in TEXT_ATTRS + ['content']:
            if name == 'content' and not el.has('data-i18n-content'):
                continue
            tag_attr = 'data-i18n-' + name
            value = el.attrs.get(name)
            if el.has(tag_attr):
                units.append(Unit('attr', el, key=el.attrs[tag_attr], en=norm(html.unescape(value or '')), attr=name))
            elif auto and value and has_letters(value):
                units.append(Unit('attr', el, en=norm(html.unescape(value)), attr=name))

    def attrs_only(el, auto):
        if skipped(el):
            return
        attr_units(el, auto)
        for c in el.children:
            attrs_only(c, auto)

    def walk(el, auto):
        if skipped(el):
            return
        if el.tag == 'head':
            auto = False
        attr_units(el, auto)
        if el.has('data-i18n-words'):
            inner = re.sub(r'<[^>]*>', ' ', src[el.open_end:el.close_start])
            units.append(Unit('words', el, key=el.attrs['data-i18n-words'], en=norm(html.unescape(inner)), mode='plain'))
            return
        if el.has('data-i18n'):
            mode = 'html' if el.has('data-i18n-html') else 'plain'
            runs = [src[a:b] for a, b in text_gaps(el, comments) if has_letters(src[a:b])]
            en = norm(src[el.open_end:el.close_start]) if mode == 'html' else norm(html.unescape(runs[0] if runs else ''))
            units.append(Unit('text', el, key=el.attrs['data-i18n'], en=en, mode=mode))
            for c in el.children:
                attrs_only(c, auto)
            return
        runs = [(a, b) for a, b in text_gaps(el, comments) if has_letters(src[a:b])] if auto else []
        if runs:
            mixed = len(runs) > 1 or any(has_text(c) for c in el.children) or any(c.tag == 'br' for c in el.children)
            if mixed:
                inner = src[el.open_end:el.close_start]
                if re.search(r'class="[^"]*\breveal\b', inner):
                    notes.append(f'WARNING: <{el.tag}> "{norm(inner)[:50]}" contains .reveal children; '
                                 'they would lose their animation state when translated')
                units.append(Unit('text', el, en=norm(inner), mode='html'))
            else:
                a, b = runs[0]
                units.append(Unit('text', el, en=norm(html.unescape(src[a:b])), mode='plain'))
            for c in el.children:
                attrs_only(c, auto)
            return
        if el.tag == 'option' and auto:
            return
        for c in el.children:
            walk(c, auto)

    for top in tb.root.children:
        walk(top, True)

    # <option> without a value: submit/filter on the English text, whatever language is shown
    def options(el):
        if skipped(el):
            return
        if el.tag == 'option' and not el.has('value'):
            inner = norm(src[el.open_end:el.close_start])
            if has_letters(inner):
                assert '"' not in inner, f'option text contains a quote: {inner}'
                inserts.append((el.start + 1 + len(el.tag), f' value="{inner}"', 'option-value'))
        for c in el.children:
            options(c)

    options(tb.root)
    return units, inserts, notes


# ─────────────────────────────── dictionary ───────────────────────────────
ENTRY_RE = re.compile(r'^\s*("(?:[^"\\]|\\.)*")\s*:\s*("(?:[^"\\]|\\.)*")\s*,?\s*$')


def read_dict():
    entries = {}
    if DICT_FILE.exists():
        for line in DICT_FILE.read_text(encoding='utf-8').splitlines():
            m = ENTRY_RE.match(line)
            if m:
                entries[json.loads(m.group(1))] = json.loads(m.group(2))
    return entries


def write_dict(order, entries, english):
    parts = [DICT_HEADER]
    for key in order:
        parts.append(f'  // EN: {english.get(key, "")}\n  {json.dumps(key)}: {json.dumps(entries.get(key, ""), ensure_ascii=False)},\n\n')
    parts.append('};\n')
    DICT_FILE.parent.mkdir(parents=True, exist_ok=True)
    DICT_FILE.write_text(''.join(parts), encoding='utf-8', newline='\n')


def slug(en):
    s = html.unescape(re.sub(r'<[^>]*>', ' ', en)).lower().replace('&', ' and ')
    return '-'.join(re.findall(r'[a-z0-9]+', s)[:6]) or 'text'


# ─────────────────────────────── commands ───────────────────────────────
def load_pages():
    pages = {}
    for name in PAGES:
        path = ROOT / name
        src = path.read_text(encoding='utf-8', newline='')
        tb = parse(src)
        pages[name] = (path, src, *analyse(tb))
    return pages


def run(command, args):
    pages = load_pages()
    entries = read_dict()

    by_key, by_text = {}, {}          # key -> (class, en); (class, en) -> key
    order, english = list(entries), {}
    for name, (path, src, units, inserts, notes) in pages.items():
        for u in units:
            if u.tagged:
                cls = 'html' if u.mode == 'html' else 'plain'
                by_key.setdefault(u.key, (cls, u.en))
                by_text.setdefault((cls, u.en), u.key)
    for key, (cls, en) in by_key.items():
        english[key] = en

    js_used = {}
    for name, (path, src, *_rest) in pages.items():
        for rx in (JS_CALL_RE, JS_OBJ_RE):
            for m in rx.finditer(src):
                text = m.group(2) if m.group(2) is not None else m.group(3)
                js_used[m.group(1)] = js_unescape(text)
    for key, en in js_used.items():
        by_key.setdefault(key, ('plain', en))
        english.setdefault(key, en)

    new_keys, tagged_now, warnings = [], 0, []
    for name, (path, src, units, inserts, notes) in pages.items():
        warnings += [f'{name}: {n}' for n in notes]
        edits = list(inserts)
        for u in units:
            if u.tagged:
                continue
            cls = 'html' if u.mode == 'html' else 'plain'
            key = by_text.get((cls, u.en))
            if key is None:
                base, key, n = slug(u.en), None, 1
                key = base
                while key in by_key:
                    n += 1
                    key = f'{base}-{n}'
                by_key[key] = (cls, u.en)
                by_text[(cls, u.en)] = key
                english[key] = u.en
                new_keys.append(key)
            u.key = key
            at = u.el.start + 1 + len(u.el.tag)
            if u.kind == 'attr':
                edits.append((at, f' data-i18n-{u.attr}="{key}"', 'attr'))
            else:
                edits.append((at, f' data-i18n="{key}"' + (' data-i18n-html' if u.mode == 'html' else ''), 'text'))
            tagged_now += 1
        if command == 'tag' and edits:
            out = src
            for at, text, _ in sorted(edits, key=lambda e: -e[0]):
                out = out[:at] + text + out[at:]
            path.write_text(out, encoding='utf-8', newline='')
        untagged = sum(1 for u in units if not u.tagged)
        missing_values = sum(1 for e in inserts)
        print(f'{name}: {len(units)} units, {untagged} untagged, {missing_values} options without value'
              + (' (written)' if command == 'tag' and edits else ''))

    used = {u.key for _, (_, _, units, _, _) in pages.items() for u in units if u.key} | set(js_used)
    for key in by_key:
        if key not in order:
            order.append(key)
    pending = [k for k in order if k in used and not entries.get(k)]
    orphans = [k for k in order if k not in used]

    if command == 'tag':
        write_dict(order, entries, english)
        print(f'tagged {tagged_now} strings, {len(new_keys)} new keys added to {DICT_FILE.relative_to(ROOT)}')
    if command == 'import':
        data = json.loads(Path(args[0]).read_text(encoding='utf-8'))
        unknown = [k for k in data if k not in by_key and k not in entries]
        for k, v in data.items():
            entries[k] = v
        write_dict(order, entries, english)
        pending = [k for k in order if k in used and not entries.get(k)]
        print(f'imported {len(data)} translations; unknown keys: {unknown}')

    if '--pending' in args:
        target = Path(args[args.index('--pending') + 1])
        target.write_text(json.dumps([{'key': k, 'html': by_key[k][0] == 'html', 'en': english[k]} for k in pending],
                                     ensure_ascii=False, indent=1), encoding='utf-8')
    for w in warnings:
        print(w)
    print(f'untranslated: {len(pending)}   orphan keys (in dictionary, unused by any page): {len(orphans)}')
    if command == 'check':
        for k in pending[:40]:
            print(f'  needs translation: {k}  ->  {english[k][:70]}')
        for k in orphans[:40]:
            print(f'  orphan: {k}')
    return 0


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    if len(sys.argv) < 2 or sys.argv[1] not in ('check', 'tag', 'import'):
        print(__doc__)
        sys.exit(1)
    sys.exit(run(sys.argv[1], sys.argv[2:]))
