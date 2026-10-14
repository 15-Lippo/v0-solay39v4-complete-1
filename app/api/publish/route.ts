// ════════════════════════════════════════════════════════════════
// SOLAY39 — Publish Audit API (GitHub Upload + Portfolio Store)
// ════════════════════════════════════════════════════════════════

const GITHUB_REPO = "sanettanammurata-max/Solay39-"
const GITHUB_API = "https://api.github.com"

export async function POST(req: Request) {
  try {
    const { project, pdfBase64, fileName, portfolioData } = await req.json()

    if (!project?.name || !pdfBase64 || !fileName) {
      return Response.json({ error: "Missing required fields" }, { status: 400 })
    }

    const token = process.env.GITHUB_TOKEN
    if (!token) {
      return Response.json(
        { success: false, error: "GITHUB_TOKEN not configured. PDF was not uploaded to GitHub." },
        { status: 503 },
      )
    }

    const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "-")
    const path = `audits/${safeFileName}`
    let lastError = "Unknown GitHub upload error"

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        let sha: string | undefined
        const checkRes = await fetch(`${GITHUB_API}/repos/${GITHUB_REPO}/contents/${path}`, {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github.v3+json" },
        })
        if (checkRes.ok) {
          const existing = (await checkRes.json()) as { sha?: string }
          sha = existing.sha
        } else if (checkRes.status !== 404) {
          const errorData = (await checkRes.json().catch(() => null)) as { message?: string } | null
          throw new Error(`GitHub lookup failed (${checkRes.status}): ${errorData?.message || "Unknown error"}`)
        }

        const body: Record<string, string> = {
          message: `[Solay39 Audit] ${project.name} - ${new Date().toISOString().slice(0, 10)}`,
          content: pdfBase64,
          branch: "main",
        }
        if (sha) body.sha = sha

        const uploadRes = await fetch(`${GITHUB_API}/repos/${GITHUB_REPO}/contents/${path}`, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github.v3+json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        })
        if (!uploadRes.ok) {
          const errorData = (await uploadRes.json().catch(() => null)) as { message?: string } | null
          throw new Error(`GitHub upload failed (${uploadRes.status}): ${errorData?.message || "Unknown error"}`)
        }

        const uploadData = (await uploadRes.json()) as { content?: { html_url?: string }; commit?: { sha?: string } }
        return Response.json({
          success: true,
          githubUrl: uploadData.content?.html_url || `https://github.com/${GITHUB_REPO}/blob/main/${path}`,
          commitSha: uploadData.commit?.sha,
          portfolioData,
        })
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error)
        console.error(`[v0] GitHub upload attempt ${attempt + 1}/3 failed:`, lastError)
        if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** attempt))
      }
    }

    return Response.json(
      { success: false, error: lastError, githubError: lastError, portfolioData },
      { status: 502 },
    )
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error("[v0] Publish error:", msg)
    return Response.json({ error: `Publish failed: ${msg}` }, { status: 500 })
  }
}
