import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(JSON.stringify({ error: 'Lovable API key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { audioBase64, mimeType } = await req.json();

    if (!audioBase64) {
      return new Response(JSON.stringify({ error: 'No audio data provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Clean base64 data
    const base64Data = audioBase64.replace(/^data:[^;]+;base64,/, '');
    const base64Size = base64Data.length;
    console.log('Transcribing audio with Lovable AI (Gemini):', { mimeType, base64SizeBytes: Math.round(base64Size * 0.75) });

    // Determine audio format for Lovable AI
    function getAudioFormat(mime: string): string {
      if (mime?.includes('ogg')) return 'ogg';
      if (mime?.includes('mp3') || mime?.includes('mpeg')) return 'mp3';
      if (mime?.includes('wav')) return 'wav';
      if (mime?.includes('webm')) return 'webm';
      if (mime?.includes('m4a') || mime?.includes('mp4') || mime?.includes('aac')) return 'mp4';
      return 'ogg'; // default for WhatsApp
    }

    const audioFormat = getAudioFormat(mimeType || '');
    console.log('Using audio format:', audioFormat);

    // Call Lovable AI Gateway with Gemini multimodal
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Transcreva este áudio em português brasileiro. Retorne APENAS o texto transcrito, sem explicações, sem aspas, sem formatação adicional. Se não houver fala ou o áudio estiver vazio, responda apenas: [SEM_FALA]"
              },
              {
                type: "input_audio",
                input_audio: {
                  data: base64Data,
                  format: audioFormat
                }
              }
            ]
          }
        ]
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Lovable AI error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ 
          error: 'rate_limit', 
          details: 'Limite de requisições excedido. Tente novamente em alguns segundos.' 
        }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      if (response.status === 402) {
        return new Response(JSON.stringify({ 
          error: 'payment_required', 
          details: 'Créditos insuficientes. Adicione créditos ao workspace Lovable.' 
        }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      return new Response(JSON.stringify({ error: 'Transcription failed', details: errorText }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const result = await response.json();
    console.log('Lovable AI response received');

    // Extract transcription from response
    const transcription = result.choices?.[0]?.message?.content?.trim() || '';
    
    // Check for empty/no speech markers
    if (!transcription || transcription === '[SEM_FALA]' || transcription.toLowerCase().includes('sem fala')) {
      console.log('No speech detected in audio');
      return new Response(JSON.stringify({ 
        error: 'no_speech_detected', 
        details: 'Não foi detectada fala no áudio.',
      }), {
        status: 422,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Transcription successful:', transcription.substring(0, 100));

    return new Response(JSON.stringify({ 
      transcription: transcription,
      provider: 'lovable-ai-gemini',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in ai-transcribe-audio:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
