import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ReleaseNotes } from './ReleaseNotes'

const render = (markdown: string): string =>
  renderToStaticMarkup(createElement(ReleaseNotes, { markdown }))

describe('release notes', () => {
  it('renders a bold Markdown link followed by a comma and preserves URL underscores', () => {
    const html = render('**[UAC Registry](https://registry.uac-soft.online/my_page)**, and more.')
    expect(html).toContain('href="https://registry.uac-soft.online/my_page"')
    expect(html).toContain('target="_blank"')
    expect(html).toContain('</a></strong>, and more.')
  })

  it('handles balanced parentheses in link destinations', () => {
    expect(render('[Details](https://example.com/notes_(v1))')).toContain(
      'href="https://example.com/notes_(v1)"'
    )
  })

  it('supports both Markdown images and existing HTML image tags', () => {
    const html = render(
      '![Screenshot](https://example.com/shot.png)\n\n<img src="https://example.com/other.png" alt="Other" width="800">'
    )
    expect(html).toContain('src="https://example.com/shot.png"')
    expect(html).toContain('src="https://example.com/other.png"')
  })

  it('preserves formatting and leaves link syntax inside code literal', () => {
    const html = render('## Changes\n\n- **Bold** and _italic_\n\n`[example](https://example.com)`')
    expect(html).toContain('<h3')
    expect(html).toContain('<ul')
    expect(html).toContain('<strong>Bold</strong>')
    expect(html).toContain('<em>italic</em>')
    expect(html).not.toContain('<a ')
    expect(html).toContain('[example](https://example.com)')
  })

  it('removes executable HTML and unsafe link/image protocols', () => {
    const html = render(
      '<script>alert(1)</script>\n\n<a href="javascript:alert(1)">Bad</a>\n\n<img src="https://example.com/a.png" onerror="alert(1)">\n\n[Local](file:///etc/passwd)'
    )
    expect(html).not.toMatch(/<script|onerror|javascript:|file:\/\//)
    expect(html).not.toContain('<a ')
    expect(html).toContain('Bad')
    expect(html).toContain('Local')
  })
})
