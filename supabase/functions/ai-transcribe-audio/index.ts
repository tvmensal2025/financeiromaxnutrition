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
    const googleApiKey = Deno.env.get('GOOGLE_API_KEY');
    if (!googleApiKey) {
      console.error('GOOGLE_API_KEY not configured');
      return new Response(JSON.stringify({ error: 'Google API key not configured' }), {
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

    // Log audio details for debugging
    const base64Size = audioBase64.length;
    console.log('Transcribing audio:', { mimeType, base64SizeBytes: Math.round(base64Size * 0.75) });

    // Reject unsupported formats (MP4/M4A/AAC) early with clear error
    if (mimeType?.includes('mp4') || mimeType?.includes('m4a') || mimeType?.includes('aac')) {
      console.error('Unsupported audio format for Google STT:', mimeType);
      return new Response(JSON.stringify({ 
        error: 'Unsupported audio format', 
        details: 'Google Speech-to-Text does not support MP4/M4A/AAC audio. The webhook should send audio in OGG/Opus or WebM format.',
        mimeType 
      }), {
        status: 415,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Clean base64 data
    const base64Data = audioBase64.replace(/^data:[^;]+;base64,/, '');

    // Determine encoding based on mimeType
    let encoding = 'OGG_OPUS';
    let sampleRateHertz: number = 48000;

    if (mimeType?.includes('mp3') || mimeType?.includes('mpeg')) {
      encoding = 'MP3';
      sampleRateHertz = 16000;
    } else if (mimeType?.includes('wav')) {
      encoding = 'LINEAR16';
      sampleRateHertz = 16000;
    } else if (mimeType?.includes('webm')) {
      encoding = 'WEBM_OPUS';
      sampleRateHertz = 48000;
    } else if (mimeType?.includes('ogg')) {
      encoding = 'OGG_OPUS';
      sampleRateHertz = 48000;
    }

    console.log('Using encoding:', encoding, 'sampleRate:', sampleRateHertz);

    // Build config object
    const config: any = {
      encoding: encoding,
      sampleRateHertz: sampleRateHertz,
      languageCode: 'pt-BR',
      enableAutomaticPunctuation: true,
      model: 'default',
    };

    // Google Speech-to-Text API request
    const response = await fetch(`https://speech.googleapis.com/v1/speech:recognize?key=${googleApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        config,
        audio: {
          content: base64Data,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Google Speech API error:', response.status, errorText);
      return new Response(JSON.stringify({ error: 'Transcription failed', details: errorText }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const result = await response.json();
    console.log('Google Speech API response:', JSON.stringify(result));

    // Extract transcription from Google's response format
    let transcription = '';
    if (result.results && result.results.length > 0) {
      transcription = result.results
        .map((r: any) => r.alternatives?.[0]?.transcript || '')
        .join(' ')
        .trim();
    }

    // Check if we got an empty transcription (no speech detected)
    if (!transcription) {
      console.log('No speech detected in audio (results empty or no transcript)');
      return new Response(JSON.stringify({ 
        error: 'no_speech_detected', 
        details: 'Não foi detectada fala no áudio ou o áudio não pôde ser reconhecido.',
        googleRequestId: result.requestId,
      }), {
        status: 422,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Transcription successful:', transcription.substring(0, 100));

    return new Response(JSON.stringify({ 
      transcription: transcription,
      confidence: result.results?.[0]?.alternatives?.[0]?.confidence,
      provider: 'google',
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
