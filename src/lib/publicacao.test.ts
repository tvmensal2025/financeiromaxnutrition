import { describe,it,expect } from 'vitest';
import { deliveryFor,publicationFor,hasVisualApproval,isFinalDelivery,isFounderDecision } from './publicacao';
describe('material do fundador',()=>{
  it('mantem parecer aprovado interno e preserva decisoes explicitas do fundador',()=>{
    const delivery={schema_version:1,title:'Parecer de Nina',content:'Corrigir a assinatura e variar as cenas.',next_steps:'Encaminhar para a equipe.',limitations:'Não é a campanha final.',acceptance_checks:[{criterion:'Relatório completo',evidence_ref:'ref',finding:'Achados consolidados'}]};
    const job={status:'COMPLETED',result_payload:{delivery,review_pending:false,reviewed_by:'AGT-01'}};
    expect(isFinalDelivery(job,[])).toBe(false);
    expect(isFinalDelivery({...job,result_payload:{...job.result_payload,delivery_audience:'FOUNDER',delivery_stage:'FINAL'}},[])).toBe(true);
    expect(isFinalDelivery({...job,result_payload:{...job.result_payload,delivery_audience:'INTERNAL',delivery_stage:'FINAL'}},[])).toBe(false);
    expect(isFounderDecision({status:'WAITING_HELENA',result_payload:{review_pending:true,reviewer_agent_id:'AGT-01'}})).toBe(false);
    expect(isFounderDecision({status:'WAITING_HELENA',result_payload:{review_pending:true,reviewer_agent_id:'FOUNDER'}})).toBe(true);
  });
  it('nao transforma relatorio interno em legenda nem conteudo pronto',()=>{
    expect(deliveryFor({result_summary:'Arquivo verificado com SHA256.'})).toBeNull();
    const publication={title:'Humano Digital',caption:'Gateway verified=true com SHA256.',strategy:'Apresentação do projeto',instructions:'Leia e confira antes de publicar',alt_text:'Pessoa com computador'};
    expect(publicationFor({publication})).toBeNull();
  });
  it('exige inspecao da versao exata para chamar arte de aprovada',()=>{
    const publication={title:'Humano Digital',caption:'Conheça novas formas de trabalhar com tecnologia.',strategy:'Apresentação do projeto',instructions:'Leia e confira antes de publicar',alt_text:'Pessoa com computador'};
    const review={inspected_references:['ref-v1'],findings:'Conferi o material completo em tamanho de celular, com logo, título legível, protagonista, cenário e chamada coerentes com a marca.',text_readable:true,brand_matches:true,copy_matches:true,composition_approved:true};
    expect(hasVisualApproval({publication,visual_review:review},['ref-v1'])).toBe(true);
    expect(hasVisualApproval({publication,visual_review:review},['ref-v2'])).toBe(false);
    expect(hasVisualApproval({publication},['ref-v1'])).toBe(false);
  });
});
