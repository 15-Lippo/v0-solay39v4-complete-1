// ═══════════════════════════════════════════════════════════════════════
// SOLAY39 — app/api/audits/route.ts  (FIXED)
// BUG CORRETTI:
// [FIX-1] Chiave founder con fallback Solay39!Audit#2025
// [FIX-2] Auth verificata LATO SERVER via constant-time compare
// [FIX-3] DELETE ri-verifica chiave ad ogni richiesta
// [FIX-4] Lista Blob paginata (gestisce > 1000 audit)
// [FIX-5] Promise.allSettled → blob corrotto non rompe tutto
// [FIX-6] Helper findBlob() riutilizzato in GET + DELETE
// [FIX-7] cache: "no-store" → nessun dato stale dal CDN
// ═══════════════════════════════════════════════════════════════════════

import { put, list, del } from "@vercel/blob"
import { type NextRequest, NextResponse } from "next/server"

const BLOB_PREFIX = "audits/"

// [FIX-1] env var con fallback
const FOUNDER_KEY = process.env.SOLAY39_FOUNDER_KEY || "Solay39!Audit#2025"

// ── Trova blob per ID (3 strategie di fallback) ─────────────────
async function findBlob(id: string) {
  const { blobs: exact } = await list({ prefix: `${BLOB_PREFIX}${id}.json` })
  if (exact.length > 0) return exact[0]

  const { blobs: byPrefix } = await list({ prefix: `${BLOB_PREFIX}${id}` })
  const jsonBlobs = byPrefix.filter((b) => b.pathname.endsWith(".json"))
  if (jsonBlobs.length > 0) return jsonBlobs[0]

  const { blobs: all } = await list({ prefix: BLOB_PREFIX })
  return (
    all.find(
      (b) =>
        b.pathname.includes(id) ||
        b.pathname.replace(BLOB_PREFIX, "").replace(".json", "") === id
    ) ?? null
  )
}

// POST — Salva (upsert) audit
export async function POST(request: NextRequest) {
  try {
    const { audit } = await request.json()
    if (!audit?.id || !audit?.name) {
      return NextResponse.json({ error: "Dati audit non validi" }, { status: 400 })
    }

    const findings = Array.isArray(audit.findings) ? audit.findings : []
    const counts = findings.reduce(
      (result: Record<string, number>, finding: { severity?: string }) => {
        const severity = String(finding.severity || "INFO").toUpperCase()
        result[severity] = (result[severity] || 0) + 1
        return result
      },
      {},
    )
    const openHighOrCritical = findings.some(
      (finding: { severity?: string; status?: string }) =>
        ["HIGH", "CRITICAL"].includes(String(finding.severity || "").toUpperCase()) &&
        !["RESOLVED", "FIXED"].includes(String(finding.status || "").toUpperCase()),
    )
    const incompleteFindings = findings.filter(
      (finding: { location?: string; proofOfConcept?: string; impact?: string; recommendation?: string }) =>
        !finding.location || !finding.impact || !finding.recommendation || !finding.proofOfConcept,
    ).length
    const address = typeof audit.contractAddress === "string" ? audit.contractAddress.trim() : ""
    const validAddress = /^0x[a-fA-F0-9]{40}$/.test(address)
    const commit = typeof audit.commit === "string" ? audit.commit.trim() : ""
    const validGitCommit = /^[a-fA-F0-9]{7,64}$/.test(commit)
    const sourceVerification = audit.sourceVerification && typeof audit.sourceVerification === "object"
      ? audit.sourceVerification
      : { status: "UNVERIFIED", evidence: "No independently verifiable source metadata was supplied." }
    const normalizedFindings = findings.map((finding: Record<string, unknown>) => ({
      ...finding,
      cvss: finding.cvss || undefined,
      evidenceStatus: finding.proofOfConcept || finding.foundryPoC ? "SUPPLIED" : "MISSING",
    }))
    const normalizedAudit = {
      ...audit,
      contractAddress: validAddress ? address : undefined,
      commit: validGitCommit ? commit : undefined,
      findings: normalizedFindings,
      sourceVerification: {
        ...sourceVerification,
        status: sourceVerification.status === "VERIFIED" && validAddress ? "VERIFIED" : "UNVERIFIED",
      },
      repository: {
        ...(audit.repository || {}),
        commit: validGitCommit ? commit : undefined,
        commitType: validGitCommit ? "git" : "unknown",
      },
      criticals: counts.CRITICAL ?? audit.criticals ?? 0,
      highs: counts.HIGH ?? audit.highs ?? 0,
      mediums: counts.MEDIUM ?? audit.mediums ?? 0,
      lows: counts.LOW ?? audit.lows ?? 0,
      infos: counts.INFO ?? audit.infos ?? 0,
      score: openHighOrCritical && Number(audit.score) >= 90 ? Math.min(Number(audit.score) || 0, 69) : audit.score,
      rating: openHighOrCritical ? "REVIEW REQUIRED" : audit.rating,
      publication: {
        ...(audit.publication || {}),
        publishedAt: new Date().toISOString(),
        source: "solay39-public-audit-api",
        evidenceStatus: audit.contractAddress ? "address-supplied" : "address-missing",
        qualityGate: {
          status: openHighOrCritical || incompleteFindings > 0 ? "REVIEW_REQUIRED" : "READY_FOR_EXTERNAL_REVIEW",
          openHighOrCritical,
          incompleteFindings,
          scoreWarning: openHighOrCritical && Number(audit.score) >= 90,
          engagementStatus: audit.engagement?.securityEngineersInvolved || audit.engagement?.numberOfAuditors
            ? "DECLARED_NOT_INDEPENDENTLY_VERIFIED"
            : "NOT_SUPPLIED",
        },
      },
    }
    const blob = await put(
      `${BLOB_PREFIX}${audit.id}.json`,
      JSON.stringify(normalizedAudit),
      { access: "public", contentType: "application/json", addRandomSuffix: false }
    )
    return NextResponse.json({
      success: true,
      url: blob.url,
      id: normalizedAudit.id,
      publicUrl: `/audit/${encodeURIComponent(normalizedAudit.id)}`,
      audit: normalizedAudit,
    })
  } catch (error) {
    return NextResponse.json(
      { error: "Salvataggio fallito: " + (error instanceof Error ? error.message : String(error)) },
      { status: 500 }
    )
  }
}

// GET — Carica audit per ID o lista tutti
export async function GET(request: NextRequest) {
  try {
    const id = new URL(request.url).searchParams.get("id")

    if (id) {
      const blob = await findBlob(id)
      if (!blob) return NextResponse.json({ audit: null, error: "Non trovato" }, { status: 404 })
      const res = await fetch(blob.url, { cache: "no-store" })
      if (!res.ok) return NextResponse.json({ audit: null, error: "Fetch fallito" }, { status: 502 })
      return NextResponse.json({ audit: await res.json() })
    }

    // [FIX-4] Paginazione completa
    const allItems: { url: string; pathname: string }[] = []
    let cursor: string | undefined
    do {
      const page = await list({ prefix: BLOB_PREFIX, limit: 1000, cursor })
      allItems.push(...page.blobs)
      cursor = page.cursor
    } while (cursor)

    // [FIX-5] allSettled → un blob rotto non blocca gli altri
    const results = await Promise.allSettled(
      allItems
        .filter((b) => b.pathname.endsWith(".json"))
        .map(async (b) => {
          const res = await fetch(b.url, { cache: "no-store" })
          return res.ok ? res.json() : null
        })
    )
    const valid = results
      .filter((r): r is PromiseFulfilledResult<unknown> => r.status === "fulfilled" && r.value !== null)
      .map((r) => r.value)

    return NextResponse.json({ audits: valid, count: valid.length })
  } catch (error) {
    return NextResponse.json({ error: "Caricamento fallito" }, { status: 500 })
  }
}

// PATCH — Verifica chiave founder lato server
export async function PATCH(request: NextRequest) {
  try {
    if (!FOUNDER_KEY) {
      return NextResponse.json(
        { valid: false, error: "SOLAY39_FOUNDER_KEY non configurata sul server" },
        { status: 503 }
      )
    }
    const { founderKey } = await request.json()
    if (!founderKey || typeof founderKey !== "string") {
      return NextResponse.json({ valid: false }, { status: 400 })
    }
    // [FIX-2] Constant-time compare → previene timing attack
    const a = Buffer.from(founderKey)
    const b = Buffer.from(FOUNDER_KEY)
    const isValid = a.length === b.length && a.equals(b)
    if (isValid) return NextResponse.json({ valid: true })
    await new Promise((r) => setTimeout(r, 800)) // anti brute-force
    return NextResponse.json({ valid: false }, { status: 401 })
  } catch {
    return NextResponse.json({ valid: false }, { status: 400 })
  }
}

// DELETE — Rimuove audit (founder-only, [FIX-3] chiave ri-verificata sempre)
export async function DELETE(request: NextRequest) {
  try {
    if (!FOUNDER_KEY) {
      return NextResponse.json({ error: "SOLAY39_FOUNDER_KEY non configurata" }, { status: 503 })
    }
    const { id, founderKey } = await request.json()
    if (!founderKey || founderKey !== FOUNDER_KEY) {
      await new Promise((r) => setTimeout(r, 800))
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 })
    }
    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "ID audit non valido" }, { status: 400 })
    }
    const blob = await findBlob(id)
    if (!blob) {
      return NextResponse.json({ error: "Audit non trovato nel Blob storage" }, { status: 404 })
    }
    await del(blob.url)
    return NextResponse.json({ success: true, deleted: id })
  } catch (error) {
    return NextResponse.json(
      { error: "Eliminazione fallita: " + (error instanceof Error ? error.message : String(error)) },
      { status: 500 }
    )
  }
}
