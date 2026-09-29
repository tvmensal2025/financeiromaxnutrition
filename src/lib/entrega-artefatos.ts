export const DELIVERY_BUCKET = "helena-deliveries";

export type DeliveryArtifact = { reference: string; path: string; slot: "post" | "story-1" | "story-2" | "story-3"; version: number };

const ARTIFACT_PATTERN = /^storage:\/\/helena-deliveries\/(BIZ-[0-9]{3})\/(JOB-HR-[a-f0-9]{32})\/(post|story-[1-3])-v([1-5])\.png$/i;

export function deliveryArtifacts(references: unknown, businessId: string, jobId: string): DeliveryArtifact[] {
  if (!Array.isArray(references)) return [];
  const unique = new Set<string>();
  return references.flatMap(reference => {
    if (typeof reference !== "string" || unique.has(reference)) return [];
    const match = ARTIFACT_PATTERN.exec(reference);
    if (!match || match[1] !== businessId || match[2] !== jobId) return [];
    unique.add(reference);
    return [{ reference, path: `${match[1]}/${match[2]}/${match[3]}-v${match[4]}.png`, slot: match[3] as DeliveryArtifact["slot"], version: Number(match[4]) }];
  });
}

export function isTrustedDeliveryUrl(value: unknown, projectUrl: string): value is string {
  if (typeof value !== "string") return false;
  try {
    const signed = new URL(value);
    const project = new URL(projectUrl);
    return signed.protocol === "https:" && signed.origin === project.origin
      && signed.pathname.startsWith(`/storage/v1/object/sign/${DELIVERY_BUCKET}/`);
  } catch { return false; }
}
