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

    const { audioBase64, mimeType, durationSec } = await req.json();

    if (!audioBase64) {
      return new Response(JSON.stringify({ error: 'No audio data provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Clean base64 data
    const base64Data = audioBase64.replace(/^data:[^;]+;base64,/, '');
    const base64Size = base64Data.length;
    const estimatedBytes = Math.round(base64Size * 0.75);
    console.log('Transcribing audio with Lovable AI (Gemini):', { 
      mimeType, 
      base64SizeBytes: estimatedBytes,
      durationSec: durationSec || 'unknown'
    });

    // Determine audio format for Lovable AI - improved OPUS detection
    function getAudioFormat(mime: string): string {
      const lowerMime = (mime || '').toLowerCase();
      
      // WhatsApp voice notes are typically OGG with OPUS codec
      if (lowerMime.includes('opus')) return 'opus';
      if (lowerMime.includes('ogg')) return 'ogg';
      if (lowerMime.includes('webm')) return 'webm';
      if (lowerMime.includes('mp3') || lowerMime.includes('mpeg')) return 'mp3';
      if (lowerMime.includes('wav')) return 'wav';
      if (lowerMime.includes('m4a') || lowerMime.includes('mp4') || lowerMime.includes('aac')) return 'mp4';
      
      // Default to opus for WhatsApp (most common)
      return 'opus';
    }

    const audioFormat = getAudioFormat(mimeType || '');
    console.log('Using audio format:', audioFormat, 'from mimeType:', mimeType);

    // Anti-hallucination prompt - more strict
    const transcriptionPrompt = `Transcreva este áudio em português brasileiro.

REGRAS OBRIGATÓRIAS:
1. Retorne APENAS o texto transcrito exatamente como foi falado
2. NÃO invente, complete ou adicione palavras que não foram ditas
3. Preserve números como dígitos (ex: "1700" não "mil e setecentos")
4. Se o áudio estiver incompreensível, com muito ruído, ou sem fala clara, responda APENAS: [INCOMPREENSIVEL]
5. Se não houver fala no áudio, responda APENAS: [SEM_FALA]
6. NÃO adicione explicações, aspas, ou formatação
7. Transcreva SOMENTE o que está claramente audível`;

    // Call Lovable AI Gateway with Gemini multimodal
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        temperature: 0, // More deterministic output
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: transcriptionPrompt
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
    let transcription = result.choices?.[0]?.message?.content?.trim() || '';
    
    // Check for empty/no speech/incomprehensible markers
    const upperTranscription = transcription.toUpperCase();
    if (!transcription || 
        upperTranscription === '[SEM_FALA]' || 
        upperTranscription.includes('SEM FALA') ||
        upperTranscription === '[INCOMPREENSIVEL]' ||
        upperTranscription.includes('INCOMPREENSIVEL') ||
        upperTranscription.includes('INCOMPREENSÍVEL')) {
      console.log('No speech or incomprehensible audio detected');
      return new Response(JSON.stringify({ 
        error: 'no_speech_detected', 
        details: 'Não foi detectada fala clara no áudio.',
      }), {
        status: 422,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Plausibility check: if we have duration, check word count
    // Average speaking rate is 2-3 words/second, max ~4 words/second
    if (durationSec && durationSec > 0) {
      const wordCount = transcription.split(/\s+/).filter((w: string) => w.length > 0).length;
      const maxPlausibleWords = (durationSec * 5) + 10; // 5 words/sec + margin
      
      console.log('Plausibility check:', { 
        durationSec, 
        wordCount, 
        maxPlausibleWords,
        ratio: (wordCount / durationSec).toFixed(2) + ' words/sec'
      });
      
      if (wordCount > maxPlausibleWords) {
        console.warn('Transcription implausibly long for audio duration - likely hallucination');
        return new Response(JSON.stringify({ 
          error: 'low_confidence', 
          details: 'Transcrição com baixa confiança (texto muito longo para duração do áudio). Por favor, envie o texto manualmente.',
        }), {
          status: 422,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
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
