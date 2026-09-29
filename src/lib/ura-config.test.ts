import { beforeEach, describe, it, expect, vi } from "vitest";
const mock = vi.hoisted(() => ({ from: vi.fn(), read: vi.fn(), write: vi.fn(), upsert: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ supabase: { from: mock.from } }));
import { carregarUra, salvarUra, URA_PADRAO } from "./ura-config";
beforeEach(() => {
  vi.clearAllMocks();
  mock.read.mockResolvedValue({ data: { settings: { model: "preservado" } }, error: null });
  mock.write.mockResolvedValue({ data: { profile_id: "VP-URA-BIZ-001", business_id: "BIZ-001" }, error: null });
  mock.upsert.mockImplementation(() => ({ select: () => ({ single: mock.write }) }));
  mock.from.mockImplementation(() => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: mock.read }) }) }), upsert: mock.upsert }));
});
describe("URA persistente por empresa", () => {
  it("grava todos os controles no Supabase preservando outras configurações", async () => {
    await salvarUra("BIZ-001", URA_PADRAO, { id: "voz", provider: "KOKORO" });
    expect(mock.upsert.mock.calls[0][0]).toMatchObject({ profile_id: "VP-URA-BIZ-001", business_id: "BIZ-001", is_default: false, settings: { model: "preservado", ura: URA_PADRAO } });
  });
  it("recupera a voz e o provedor salvos para a empresa", async () => {
    mock.read.mockResolvedValue({ data: {
      first_message: "Olá",
      provider: "ELEVENLABS",
      voice_id: "voz-escolhida",
      settings: { ura: { ...URA_PADRAO, auto_answer: true } },
    }, error: null });
    await expect(carregarUra("BIZ-001")).resolves.toMatchObject({
      greeting: "Olá", auto_answer: true,
      voice: { provider: "ELEVENLABS", id: "voz-escolhida" },
    });
  });
  it("propaga a falha da gravação e não confirma sucesso", async () => {
    mock.write.mockResolvedValue({ data: null, error: { message: "negado" } });
    await expect(salvarUra("BIZ-001", URA_PADRAO, { id: "voz", provider: "KOKORO" })).rejects.toThrow("não confirmou");
  });
  it("não mistura a configuração do grupo com uma empresa", async () => {
    await expect(carregarUra("GRUPO")).rejects.toThrow("Selecione uma empresa");
    expect(mock.read).not.toHaveBeenCalled();
  });
});
