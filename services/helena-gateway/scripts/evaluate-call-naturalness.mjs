// Explicit opt-in live-provider evaluation; synthetic conversations, no customer calls/data writes.
import fs from 'node:fs/promises';
import path from 'node:path';
import { streamReplyToCall } from '../src/integrations/call-streaming.mjs';
import { buildCallInstruction } from '../src/integrations/caller-context.mjs';
import { recentConversationMarkers } from '../src/integrations/conversation-naturalness.mjs';
import { openChirp3CallStream } from '../src/integrations/google-chirp3-hd.mjs';

if (process.env.RUN_LIVE_VOICE_EVAL !== 'true') throw new Error('Set RUN_LIVE_VOICE_EVAL=true explicitly');
const out=path.resolve(process.env.VOICE_EVAL_OUTPUT || 'voice-evaluation');
await fs.mkdir(out,{recursive:true});
const base=process.env.VOICE_EVAL_GATEWAY || 'https://helena-automation-helena-gateway.d9v63q.easypanel.host';
const profiles=(await (await fetch(base+'/api/integrations/call-engine/profiles')).json()).profiles;
const settings=(await (await fetch(base+'/api/integrations/voice-agent/settings')).json()).config;
if(!settings.ai_model || !Array.isArray(profiles))throw new Error('Missing live model/profile configuration');
const common=['Pode explicar de forma mais simples?','Ah, entendi. E se eu mudar o horário?',
  'Espera, deixa eu terminar.','Eu trabalho à noite e durmo pela manhã.',
  'Não quero uma lista; me diga só o primeiro passo.','Certo, vou tentar.',
  'Mudei de ideia. Quero uma opção mais prática.','Você tem certeza ou precisa de mais informações?',
  'Não entendi essa parte.','O que você precisa saber de mim?',
  'Só tenho quinze minutos disponíveis.','Pode resumir em uma frase?',
  'Não quero fazer isso agora.','Obrigado. Podemos continuar amanhã?',
  'Antes de ir, explique por que essa mudança ajuda.', 'Está bem. Até amanhã.'];
const inputs={
  vital:['Estou sentindo tontura desde ontem.','Acontece quando me levanto.','Meu exame consta como realizado, mas não mandei o laudo.','Você sabe o resultado desse exame?',...common],
  sirlene:['Estou usando Mounjaro e quase não tenho fome.','Consigo comer pequenas porções.','Esqueci de dizer que também sinto enjoo.','Não tenho resultado de exame disponível.',...common],
  alex:['Não fui treinar hoje de novo.','Foi a segunda vez nesta semana.','Quero compensar treinando o dobro amanhã.','Posso tomar café antes do treino?',...common]
};
function wav(pcm){const h=Buffer.alloc(44);h.write('RIFF');h.writeUInt32LE(pcm.length+36,4);h.write('WAVEfmt ',8);h.writeUInt32LE(16,16);h.writeUInt16LE(1,20);h.writeUInt16LE(1,22);h.writeUInt32LE(16000,24);h.writeUInt32LE(32000,28);h.writeUInt16LE(2,32);h.writeUInt16LE(16,34);h.write('data',36);h.writeUInt32LE(pcm.length,40);return Buffer.concat([h,pcm]);}
const results=[];
for(const [character,turns] of Object.entries(inputs)){
  const profile=profiles.find(p=>p.character_id===character && p.mode==='normal');
  if(!profile)throw new Error('Missing profile '+character);
  // Matched SYNTHETIC context cache uses the same prompt builder, never the customer backend.
  const call={callerContexts:new Map([[`:${character}`,{at:Date.now(),promise:Promise.resolve({status:'matched',fetched_at:'simulação',context:{synthetic:true,exams:[{status:'completed',result:null}],measurements:[]}})}]]),accessToken:'synthetic-not-transmitted'};
  const envUrl=process.env.MAX_VOICE_CONTEXT_URL,envToken=process.env.MAX_VOICE_CONTEXT_TOKEN;
  process.env.MAX_VOICE_CONTEXT_URL='http://never-contact';process.env.MAX_VOICE_CONTEXT_TOKEN='synthetic';
  const instruction=await buildCallInstruction(call,profile);
  if(envUrl===undefined)delete process.env.MAX_VOICE_CONTEXT_URL;else process.env.MAX_VOICE_CONTEXT_URL=envUrl;
  if(envToken===undefined)delete process.env.MAX_VOICE_CONTEXT_TOKEN;else process.env.MAX_VOICE_CONTEXT_TOKEN=envToken;
  const history=[];
  for(let i=0;i<turns.length;i++){
    const pcm=[];
    try{
      const response=await streamReplyToCall({callId:`synthetic-${character}`,speechEpoch:i+1,apiKey:process.env.OPENAI_API_KEY,
        model:settings.ai_model,systemInstruction:instruction,profile,userPrompt:turns[i],history,voice:profile.voice_id,
        baseUrl:'http://capture-only',token:'fake',fetchImpl:async(url,opts)=>{
          if(!url.startsWith('http://capture-only'))return fetch(url,opts);
          for await(const bytes of opts.body)pcm.push(bytes);
          return Response.json({ok:true,metrics:{synthetic_transport:true}});
        }});
      const filename=`${character}-${String(i+1).padStart(2,'0')}.wav`;
      await fs.writeFile(path.join(out,filename),wav(Buffer.concat(pcm)));
      const marker=recentConversationMarkers([{role:'assistant',text:response.text}])[0] || null;
      results.push({character,turn:i+1,voice:profile.voice_id,model:settings.ai_model,user:turns[i],reply:response.text,marker,
        audio:filename,bytes:response.audioBytes,metrics:response.metrics,ok:true});
      history.push({role:'user',text:turns[i]},{role:'assistant',text:response.text});
      console.log(JSON.stringify({character,turn:i+1,ok:true,marker,first_audio_ms:response.metrics.first_audio_to_transport_ms}));
    }catch(error){results.push({character,turn:i+1,ok:false,error:error.message});console.log(JSON.stringify(results.at(-1)));}
    await fs.writeFile(path.join(out,'results.json'),JSON.stringify(results,null,2));
  }
}
const phrases=['Hmm deixa eu ver','Hmm… deixa eu ver.','Certo vamos analisar isso','Certo. Vamos analisar isso.',
  'Ah, agora entendi.','Entendi. Nesse caso, muda um pouco.','Um minutinho… deixa eu juntar essas informações.'];
for(const character of Object.keys(inputs)){
  const voice=profiles.find(p=>p.character_id===character&&p.mode==='normal').voice_id;
  for(let i=0;i<phrases.length;i++){
    const stream=openChirp3CallStream({voice,signal:AbortSignal.timeout(15000)});stream.end({input:{text:phrases[i]}});
    const chunks=[];for await(const message of stream)if(message.audioContent)chunks.push(Buffer.from(message.audioContent));
    await fs.writeFile(path.join(out,`${character}-punctuation-${i+1}.wav`),wav(Buffer.concat(chunks)));
  }
}
console.log(JSON.stringify({completed:true,turns:results.length,passed:results.filter(x=>x.ok).length,out}));
if(results.some(x=>!x.ok))process.exitCode=1;
