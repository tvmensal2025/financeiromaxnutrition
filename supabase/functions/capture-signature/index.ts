import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SignatureRequest {
  contrato_id: string;
  assinatura_id: string;
  signatario_nome: string;
  signatario_cpf_cnpj: string;
  signatario_email: string;
  aceite_termos: boolean;
  codigo_verificacao?: string;
  action: 'send_code' | 'verify_and_sign';
}

// Gera hash SHA-256 do documento
async function generateHash(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Gera código de verificação de 6 dígitos
function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Obtém geolocalização do IP
async function getGeoLocation(ip: string): Promise<object | null> {
  try {
    // Usar IP-API (gratuito, sem necessidade de chave)
    const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,countryCode,region,regionName,city,lat,lon,timezone,isp`);
    if (response.ok) {
      const data = await response.json();
      if (data.status === 'success') {
        return {
          country: data.country,
          countryCode: data.countryCode,
          region: data.region,
          regionName: data.regionName,
          city: data.city,
          lat: data.lat,
          lon: data.lon,
          timezone: data.timezone,
          isp: data.isp
        };
      }
    }
    return null;
  } catch (error) {
    console.error('Error getting geolocation:', error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: SignatureRequest = await req.json();
    const { contrato_id, assinatura_id, signatario_nome, signatario_cpf_cnpj, signatario_email, aceite_termos, codigo_verificacao, action } = body;

    // Capturar IP do cliente
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
                     req.headers.get("cf-connecting-ip") ||
                     req.headers.get("x-real-ip") ||
                     "unknown";

    const userAgent = req.headers.get("user-agent") || "unknown";

    if (action === 'send_code') {
      // Gerar código de verificação
      const code = generateVerificationCode();

      // Atualizar assinatura com o código
      const { error: updateError } = await supabase
        .from('assinaturas_contrato')
        .update({
          codigo_verificacao: code,
          signatario_nome,
          signatario_cpf_cnpj,
          signatario_email
        })
        .eq('id', assinatura_id);

      if (updateError) {
        throw new Error(`Erro ao salvar código: ${updateError.message}`);
      }

      // Registrar log de auditoria
      await supabase.from('contratos_audit_log').insert({
        contrato_id,
        acao: 'envio_codigo',
        descricao: `Código de verificação enviado para ${signatario_email}`,
        ip_address: clientIp,
        user_agent: userAgent,
        metadata: { email: signatario_email }
      });

      // TODO: Implementar envio de email/SMS com o código
      // Por enquanto, retornamos o código para teste (em produção, remover isso)
      console.log(`Código de verificação para ${signatario_email}: ${code}`);

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Código de verificação enviado',
          // Em desenvolvimento, retornamos o código. Em produção, remover esta linha
          code: code
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === 'verify_and_sign') {
      if (!aceite_termos) {
        return new Response(
          JSON.stringify({ success: false, error: 'É necessário aceitar os termos' }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verificar o código
      const { data: assinatura, error: fetchError } = await supabase
        .from('assinaturas_contrato')
        .select('codigo_verificacao')
        .eq('id', assinatura_id)
        .single();

      if (fetchError || !assinatura) {
        throw new Error('Assinatura não encontrada');
      }

      if (assinatura.codigo_verificacao !== codigo_verificacao) {
        return new Response(
          JSON.stringify({ success: false, error: 'Código de verificação inválido' }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Buscar contrato para gerar hash
      const { data: contrato, error: contratoError } = await supabase
        .from('contratos_digitais')
        .select('conteudo, titulo')
        .eq('id', contrato_id)
        .single();

      if (contratoError || !contrato) {
        throw new Error('Contrato não encontrado');
      }

      // Gerar hash do documento
      const documentHash = await generateHash(contrato.conteudo + contrato.titulo + new Date().toISOString());

      // Obter geolocalização
      const geoLocation = await getGeoLocation(clientIp);

      // Atualizar assinatura com todos os dados
      const { error: signError } = await supabase
        .from('assinaturas_contrato')
        .update({
          signatario_nome,
          signatario_cpf_cnpj,
          signatario_email,
          ip_address: clientIp,
          ip_geolocation: geoLocation,
          user_agent: userAgent,
          assinado_em: new Date().toISOString(),
          hash_documento: documentHash,
          codigo_verificado: true,
          aceite_termos: true,
          status: 'assinado'
        })
        .eq('id', assinatura_id);

      if (signError) {
        throw new Error(`Erro ao registrar assinatura: ${signError.message}`);
      }

      // Verificar se todas as assinaturas foram concluídas
      const { data: todasAssinaturas, error: allSignError } = await supabase
        .from('assinaturas_contrato')
        .select('status')
        .eq('contrato_id', contrato_id);

      if (!allSignError && todasAssinaturas) {
        const todasAssinadas = todasAssinaturas.every(a => a.status === 'assinado');
        if (todasAssinadas) {
          await supabase
            .from('contratos_digitais')
            .update({ status: 'assinado' })
            .eq('id', contrato_id);
        }
      }

      // Registrar log de auditoria
      await supabase.from('contratos_audit_log').insert({
        contrato_id,
        acao: 'assinatura',
        descricao: `Contrato assinado por ${signatario_nome} (${signatario_cpf_cnpj})`,
        ip_address: clientIp,
        user_agent: userAgent,
        metadata: {
          signatario_nome,
          signatario_cpf_cnpj,
          signatario_email,
          hash_documento: documentHash,
          geoLocation
        }
      });

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Contrato assinado com sucesso',
          data: {
            assinado_em: new Date().toISOString(),
            ip_address: clientIp,
            hash_documento: documentHash,
            geoLocation
          }
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Ação inválida' }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error?.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
