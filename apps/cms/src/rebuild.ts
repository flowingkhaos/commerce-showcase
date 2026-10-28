import type { CollectionAfterChangeHook, CollectionAfterDeleteHook, Payload, PayloadRequest } from 'payload'

// Sites that are prebuilt, by domain slug: a change to their published content asks GitHub to run
// their deploy workflow. The other demo sites read the CMS at request time and need nothing.
const prebuilt: Record<string, { repo: string; workflow: string }> = {
  store: { repo: 'flowingkhaos/commerce-showcase', workflow: 'deploy-web.yml' },
}

export type RebuildResult = 'requested' | 'failed' | 'skipped'

// Every change asks; no throttle here. GitHub's concurrency group keeps one build running and one
// waiting, so a burst joins the build that waits, and the last change is always built. If GitHub
// refuses the tail of a burst, the build that waits still starts after it and reads it.
// Never throws: a save or a Shopify call never fails because GitHub is slow or down; the nightly
// build catches up. 3 s, not more: Shopify gives its whole call 5 s, a cold start included.
export async function requestRebuild(payload: Payload, slug: string, reason: string): Promise<RebuildResult> {
  const token = process.env.GITHUB_DISPATCH_TOKEN
  const target = prebuilt[slug]
  if (!token || !target) return 'skipped'
  try {
    const res = await fetch(`https://api.github.com/repos/${target.repo}/actions/workflows/${target.workflow}/dispatches`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28' },
      body: JSON.stringify({ ref: 'main', inputs: { reason: reason.slice(0, 100) } }),
      signal: AbortSignal.timeout(3000),
    })
    if (res.ok) return 'requested'
    payload.logger.warn(`rebuild ${slug}: GitHub answered ${res.status}`)
  } catch (err) {
    payload.logger.warn(`rebuild ${slug}: ${(err as Error).message}`)
  }
  return 'failed'
}

// Only admins publish (visitors draft), so a dispatch is never a stranger's to trigger.
async function rebuildDomain(req: PayloadRequest, domain: unknown, reason: string) {
  if (!process.env.GITHUB_DISPATCH_TOKEN || domain == null) return
  const id = typeof domain === 'object' ? (domain as { id: number }).id : domain
  try {
    const { slug } = await req.payload.findByID({ collection: 'domains', id: id as number, depth: 0, overrideAccess: true, req })
    await requestRebuild(req.payload, slug, reason)
  } catch (err) {
    req.payload.logger.warn(`rebuild domain ${String(id)}: ${(err as Error).message}`)
  }
}

// A publish (or any save of a collection without drafts) rebuilds; draft autosaves change nothing
// live. ponytail: an unpublish waits for the nightly build; detect it here if that delay matters.
export const rebuildOnChange: CollectionAfterChangeHook = async ({ doc, collection, req }) => {
  if (doc._status === undefined || doc._status === 'published') {
    await rebuildDomain(req, doc.domain, `${collection.slug} ${doc.slug ?? doc.id}`)
  }
  return doc
}

export const rebuildOnDelete: CollectionAfterDeleteHook = async ({ doc, collection, req }) => {
  if (doc._status !== 'draft') await rebuildDomain(req, doc.domain, `${collection.slug} ${doc.slug ?? doc.id} deleted`)
  return doc
}
