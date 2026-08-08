// Severity comes from the YOLOv8-seg trash model, not from the reporter — a citizen
// can't game dispatch priority by ticking "HIGH". The model runs in a Python sidecar
// (ml/score.py); see its docstring for the coverage thresholds.
const SCORER_URL = process.env.SEVERITY_SCORER_URL ?? 'http://localhost:8100';
const TIMEOUT_MS = 15_000;

export type Severity = 'HIGH' | 'MEDIUM' | 'LOW';
// 'NONE' = model found no trash in any photo; the caller rejects the report.
export type ScoreResult = Severity | 'NONE' | null;

/**
 * Returns null when there is nothing to score or the scorer is unreachable —
 * a down sidecar must not block a citizen's report, it just leaves severity unset.
 */
export async function scoreSeverity(images: string[]): Promise<ScoreResult> {
    if (images.length === 0) return null;

    try {
        const res = await fetch(`${SCORER_URL}/score`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ images }),
            signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        if (!res.ok) throw new Error(`scorer returned ${res.status}`);

        const { severity } = (await res.json()) as { severity: Severity | 'NONE' };
        return severity;
    } catch (err) {
        console.error('severity scoring failed, leaving severity unset:', err);
        return null;
    }
}
