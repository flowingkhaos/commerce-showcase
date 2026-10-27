'use client'

import { Button, useTranslation } from '@payloadcms/ui'
import { useEffect, useRef, useState } from 'react'

// « Enter as visitor » under the sign-in form (src/visitor.ts does the rest). Turnstile is
// rendered explicitly, because the admin reaches this page by client navigation too.

type Turnstile = { render: (el: HTMLElement, o: { sitekey: string; callback: () => void }) => string; remove: (id: string) => void }
declare global {
  interface Window {
    turnstile?: Turnstile
  }
}

const SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

const copy = {
  en: {
    title: 'Just looking?',
    text: 'Try the editor without an account. Make drafts in the OVRLD store and the blog demo, and watch them in the live preview. Nothing is published, and your drafts are deleted after 24 hours.',
    button: 'Enter as visitor',
  },
  fr: {
    title: 'Simple curiosité ?',
    text: "Essayez l'éditeur sans compte. Créez des brouillons dans la boutique OVRLD et le blogue démo, et regardez-les dans l'aperçu en direct. Rien n'est publié, et vos brouillons sont effacés après 24 heures.",
    button: 'Entrer comme visiteur',
  },
}

export function VisitorDoor({ siteKey }: { siteKey?: string }) {
  const { i18n } = useTranslation()
  const box = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)
  const c = i18n.language === 'fr' ? copy.fr : copy.en

  useEffect(() => {
    if (!siteKey) return
    let id: string | undefined
    const mount = () => {
      if (box.current && window.turnstile) id = window.turnstile.render(box.current, { sitekey: siteKey, callback: () => setReady(true) })
    }
    if (window.turnstile) mount()
    else {
      let s = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT}"]`)
      if (!s) {
        s = Object.assign(document.createElement('script'), { src: SCRIPT, async: true })
        document.head.append(s)
      }
      s.addEventListener('load', mount, { once: true })
    }
    return () => {
      if (id) window.turnstile?.remove(id)
    }
  }, [siteKey])

  if (!siteKey) return null
  return (
    <form action="/api/visitor/enter" className="visitor-door" method="post">
      <h3>{c.title}</h3>
      <p>{c.text}</p>
      <div ref={box} />
      <Button buttonStyle="secondary" disabled={!ready} size="large" type="submit">
        {c.button}
      </Button>
    </form>
  )
}
