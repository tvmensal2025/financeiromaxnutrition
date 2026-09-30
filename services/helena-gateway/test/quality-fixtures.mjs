import { readFileSync } from 'node:fs';
export function sampleDelivery(ref = 'MEM-HR-1') {
  return {schema_version:1,title:'Plano de trabalho da equipe',content:'Apresentar o projeto com clareza e orientar o próximo passo com base nas informações disponíveis.',next_steps:'Confira o público e aprove o material antes de utilizar.',limitations:'As condições comerciais ainda precisam de confirmação.',acceptance_checks:[{criterion:'Mensagem clara e sem promessa de renda',evidence_ref:ref,finding:'A mensagem final apresenta o projeto sem afirmar contratação, remuneração ou ganhos garantidos.'}]};
}
export function sampleQuality(delivery, refs = delivery.acceptance_checks.map(check=>check.evidence_ref)) {
  return {inspected_evidence_refs:refs,verified_criteria:delivery.acceptance_checks.map(check=>check.criterion),findings:'Li a evidência completa e comparei a mensagem com o pedido: apresenta o projeto, evita alegações sem fonte e indica o próximo passo.',requirements_met:true};
}
export function creativeContext(formats = ['post','story-1','story-2','story-3']) {
  const brand = {...JSON.parse(readFileSync(new URL('../../../src/data/humano-digital-brand.json',import.meta.url),'utf8')),status:'APPROVED',logo_approved:true};
  const creative = {business_id:'BIZ-003',brand:brand.name,brand_version:500,logo_asset:brand.logo_url,formats,imagery_method:'ORIGINAL_ILLUSTRATION',palette:brand.colors.map(c=>c.hex).join(', ')};
  for (const key of ['audience','objective','subject','scene','composition','typography','exact_copy','cta','constraints','review']) creative[key]='Instrução específica para orientar esta peça com clareza e contexto da empresa.';
  creative.verified_facts=['O projeto trabalha com oportunidades ligadas a tecnologia.']; creative.sources=['Ficha da empresa conferida pelo fundador.'];
  return {instruction:'```direcao-arte\n'+JSON.stringify(creative)+'\n```',business_id:'BIZ-003',company_identity:{business_id:'BIZ-003',row_version:500,brand_identity:brand}};
}
