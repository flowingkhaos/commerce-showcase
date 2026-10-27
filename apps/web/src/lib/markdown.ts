// Docs bodies are markdown (Payload `code` field). Rendered at build, and on /preview for drafts,
// which visitors can write: so raw HTML is escaped and only safe link and image URLs survive.
import { Marked, type Token, type TokensList } from 'marked'

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
// http(s), mailto, root-relative, #fragment or a plain relative path; never javascript: or data:.
const safeUrl = (href: string) => /^(https?:|mailto:|\/|#)/i.test(href) || !/^[a-z][a-z0-9+.-]*:/i.test(href)

function md(copyLabel: string) {
  return new Marked({
    gfm: true,
    renderer: {
      html: ({ text }) => esc(text),
      link({ href, title, tokens }) {
        const inner = this.parser.parseInline(tokens)
        return safeUrl(href) ? `<a href="${esc(href)}"${title ? ` title="${esc(title)}"` : ''}>${inner}</a>` : inner
      },
      image: ({ href, text }) => (safeUrl(href) ? `<img src="${esc(href)}" alt="${esc(text)}" loading="lazy">` : esc(text)),
      // Beam Room's instrument screen: a bar with the language and a copy button (the page's
      // script reveals it), numbered lines. No syntax colours: that would need a highlighter.
      code({ text, lang }) {
        const [language = '', file = ''] = (lang ?? '').split(/\s+/)
        const label = file || language || 'code'
        const lines = text.replace(/\n$/, '').split('\n').map((l) => `<span class="l">${esc(l) || ' '}</span>`).join('\n')
        return `<figure class="screen"><figcaption class="screen__bar"><span class="led led--green" aria-hidden="true"></span><span class="screen__file">${esc(label)}</span>${language ? `<span class="screen__lang">${esc(language)}</span>` : ''}<button class="copy" type="button" hidden><span class="led" aria-hidden="true"></span><span class="copy__t">${esc(copyLabel)}</span></button></figcaption><pre tabindex="0" aria-label="${esc(label)}"><code>${lines}</code></pre></figure>`
      },
    },
  })
}

const slug = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'section'

export type Section = { id: string; title: string; html: string }

/**
 * A doc body as the board lays it out: the text before the first `##` (its first paragraph is
 * the lede), then one numbered section per `##`. The body's own leading `#` title is dropped:
 * the page prints the title.
 */
export function renderDoc(body: string, copyLabel: string) {
  const parser = md(copyLabel)
  const tokens = parser.lexer(body.replace(/^\s*#\s+[^\n]*\n/, ''))
  const groups: { title?: string; tokens: Token[] }[] = [{ tokens: [] }]
  for (const tok of tokens) {
    if (tok.type === 'heading' && tok.depth === 2) groups.push({ title: tok.text, tokens: [] })
    else groups.at(-1)!.tokens.push(tok)
  }
  const html = (list: Token[]) =>
    parser
      .parser(Object.assign(list, { links: tokens.links }) as TokensList)
      .replace(/<table>/g, '<div class="tbl" role="region" tabindex="0"><table>')
      .replace(/<\/table>/g, '</table></div>')
  const used = new Set<string>()
  const sections: Section[] = groups.slice(1).map((g) => {
    let id = slug(g.title!)
    while (used.has(id)) id += '-2'
    used.add(id)
    return { id, title: g.title!, html: html(g.tokens) }
  })
  const words = body.split(/\s+/).filter(Boolean).length
  return { intro: html(groups[0]!.tokens), sections, minutes: Math.max(1, Math.round(words / 200)) }
}
