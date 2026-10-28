import type { CollectionAfterChangeHook, CollectionAfterDeleteHook, PayloadRequest } from 'payload'

// Sites that are prebuilt, by domain slug: a change to their published content asks GitHub to run
// their deploy workflow. The other demo sites read the CMS at request time and need nothing.
const prebuilt: Record<string, { repo: string; workflow: string }> = {
  store: { repo: 'flowingkhaos/commerce-showcase', workflow: 'deploy-web.yml' },
}

// Every publish asks; no throttle here. GitHub's concurrency group keeps one build running and one
// waiting, so a burst of publishes joins the build that waits, and the last one is always built.
// Only admins publish (visitors draft), so a dispatch is never a stranger's to trigger.
async function requestRebuild(req: PayloadRequest, domain: unknown, reason: string) {
  const token = process.env.GITHUB_DISPATCH_TOKEN
  if (!token || domain == null) return
  const id = typeof domain === 'object' ? (domain as { id: number }).id : domain
  let slug = String(id)
  try {
    slug = (await req.payload.findByID({ collection: 'domains', id: id as number, depth: 0, overrideAccess: true, req })).slug
    const target = prebuilt[slug]
    if (!target) return
    const res = await fetch(`https://api.github.com/repos/${target.repo}/actions/workflows/${target.workflow}/dispatches`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28' },
      body: JSON.stringify({ ref: 'main', inputs: { reason: reason.slice(0, 100) } }),
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) req.payload.logger.warn(`rebuild ${slug}: GitHub answered ${res.status}`)
  } catch (err) {
    // A publish never fails because GitHub is slow or down; the nightly build catches up.
    req.payload.logger.warn(`rebuild ${slug}: ${(err as Error).message}`)
  }
}

// A publish (or any save of a collection without drafts) rebuilds; draft autosaves change nothing
// live. ponytail: an unpublish waits for the nightly build; detect it here if that delay matters.
export const rebuildOnChange: CollectionAfterChangeHook = async ({ doc, collection, req }) => {
  if (doc._status === undefined || doc._status === 'published') {
    await requestRebuild(req, doc.domain, `${collection.slug} ${doc.slug ?? doc.id}`)
  }
  return doc
}

export const rebuildOnDelete: CollectionAfterDeleteHook = async ({ doc, collection, req }) => {
  if (doc._status !== 'draft') await requestRebuild(req, doc.domain, `${collection.slug} ${doc.slug ?? doc.id} deleted`)
  return doc
}
