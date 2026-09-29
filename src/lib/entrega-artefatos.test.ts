import { describe, expect, it } from "vitest";
import { deliveryArtifacts, isTrustedDeliveryUrl } from "./entrega-artefatos";

describe("artefatos de entrega", () => {
  const job = "JOB-HR-49eff2ead7674d06b4b59bc796f08873";
  const own = `storage://helena-deliveries/BIZ-003/${job}/post-v1.png`;

  it("exibe apenas arquivos do job e da empresa selecionados", () => {
    const refs = [own, own, own.replace("BIZ-003", "BIZ-001"), own.replace(job, "JOB-HR-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")];
    expect(deliveryArtifacts(refs, "BIZ-003", job)).toEqual([{ reference: own, path: `BIZ-003/${job}/post-v1.png`, slot: "post", version: 1 }]);
  });

  it("aceita apenas links assinados pelo projeto Supabase", () => {
    const base = "https://wxkgrykduqtsgmjkzlou.supabase.co";
    expect(isTrustedDeliveryUrl(`${base}/storage/v1/object/sign/helena-deliveries/BIZ-003/file.png?token=x`, base)).toBe(true);
    expect(isTrustedDeliveryUrl("https://evil.example/storage/v1/object/sign/helena-deliveries/file.png", base)).toBe(false);
    expect(isTrustedDeliveryUrl("javascript:alert(1)", base)).toBe(false);
  });
});
