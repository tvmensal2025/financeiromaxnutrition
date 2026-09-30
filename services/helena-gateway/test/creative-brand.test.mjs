import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateCreativeBrief, validateBrandForDesign } from '../src/creative-brief.mjs';
import { validatePublication, validateVisualReview } from '../src/publication-contract.mjs';
const brand = JSON.parse(readFileSync(new URL('../../../src/data/humano-digital-brand.json',import.meta.url),'utf8'));
brand.status='APPROVED'; brand.logo_approved=true;
const detail={job:{business_id:'BIZ-003'},company_identity:{business_id:'BIZ-003',row_version:500,brand_identity:brand}};
const brief={business_id:'BIZ-003',brand:brand.name,brand_version:500,logo_asset:brand.logo_url,palette:brand.colors.map(c=>c.hex).join(', ')};
test('design deve usar a identidade aprovada da empresa e da versão correta',()=>{
  assert.equal(validateBrandForDesign(detail,brief),brand);
  for(const change of [{brand_version:499},{logo_asset:'/outra-marca.png'},{palette:'#FF0000'}]) assert.throws(()=>validateBrandForDesign(detail,{...brief,...change}));
  assert.throws(()=>validateBrandForDesign({...detail,job:{business_id:'BIZ-002'}},brief),/outro/);
  assert.throws(()=>validateBrandForDesign({...detail,company_identity:{...detail.company_identity,brand_identity:{...brand,status:'DRAFT'}}},brief),/aprovacao/);
});
test('briefing raso ou sem contrato de direção de arte não libera design',()=>{
  assert.throws(()=>validateCreativeBrief('Faça um post bonito','BIZ-003'),/direcao-arte/);
  assert.throws(()=>validateCreativeBrief('```direcao-arte\n{}\n```','BIZ-003'),/incompleta/);
});
test('revisão visual não aceita outros arquivos ou um item reprovado',()=>{
  const review={inspected_references:['ref-1'],findings:'Conferi o arquivo final em tamanho de celular: título, logo, imagem protagonista e chamada legíveis, coerentes com a marca e a copy.',text_readable:true,brand_matches:true,copy_matches:true,composition_approved:true};
  assert.equal(validateVisualReview(review,[{reference:'ref-1'}]).text_readable,true);
  assert.throws(()=>validateVisualReview(review,[{reference:'ref-2'}]),/exatamente/);
  assert.throws(()=>validateVisualReview({...review,text_readable:false},[{reference:'ref-1'}]),/reprovada/);
});
test('relatório técnico não pode ser a legenda para publicar',()=>{
  const p={title:'Humano Digital',caption:'Gateway retornou verified=true com SHA256.',strategy:'Apresentar o projeto com clareza para despertar interesse qualificado.',instructions:'Publique apenas após conferir o canal autorizado.',alt_text:'Pessoa trabalhando com apoio de inteligência artificial.'};
  assert.throws(()=>validatePublication(p),/tecnico/);
});
