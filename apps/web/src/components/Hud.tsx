// One X-ray callout (HUD X-ray board): the owner and the field, hidden until the switch is on.
// A plain Preact component: Astro renders it as static HTML, islands render it too.
const AT = { in: 'hud hud--in', below: 'hud hud--below', 'below-end': 'hud hud--below hud--end', end: 'hud hud--end' }
export type Owner = 'Payload' | 'Shopify' | 'Code'

export default function Hud({ o, f, at }: { o: Owner; f: string; at?: keyof typeof AT }) {
  return (
    <span class={at ? AT[at] : 'hud'} aria-hidden="true">
      <b>{o}</b>
      <span>{f}</span>
    </span>
  )
}
