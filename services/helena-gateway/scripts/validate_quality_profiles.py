"""Read-only profile contract checks. Never dispatches a model or prints tokens."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import urllib.request
from datetime import datetime, timezone

GATEWAY = 'https://helena-automation-helena-gateway.d9v63q.easypanel.host/mcp'

def run(home):
    home=home.resolve(strict=True)
    manifest=json.loads((home/'helena-runtime'/'quality-manifest.json').read_text(encoding='utf-8'))
    rows=[]
    for index,(profile,digest) in enumerate(manifest['soul_hashes'].items(),1):
        path=home/'profiles'/profile
        result={'profile':profile,'soul_matches':False,'contract_matches':False,'status':'FAIL'}
        try:
            result['soul_matches']=hashlib.sha256((path/'SOUL.md').read_bytes()).hexdigest()==digest
            env=(path/'.env').read_text(encoding='utf-8')
            match=re.search(r'^HELENA_GATEWAY_PROFILE_TOKEN=(.*)$',env,re.M)
            if not match:raise ValueError('TOKEN_ABSENT')
            token=match.group(1).strip().strip('\"\'')
            if not re.fullmatch(r'hhs_[A-Za-z0-9_-]{40,}',token):raise ValueError('TOKEN_FORMAT')
            body=json.dumps({'jsonrpc':'2.0','id':index,'method':'tools/call','params':{'name':'get_work_context','arguments':{}}}).encode()
            request=urllib.request.Request(GATEWAY,data=body,headers={'Authorization':'Bearer '+token,'Content-Type':'application/json'})
            with urllib.request.urlopen(request,timeout=20) as response:data=json.load(response)
            if data.get('error') or data.get('result',{}).get('isError'):raise ValueError('CONTEXT_REJECTED')
            context=json.loads(data['result']['content'][0]['text'])
            contract=context.get('agent_quality_contract') or {}
            result['agent_id']=context.get('profile',{}).get('agent_id')
            result['contract_matches']=contract.get('agent_id')==result['agent_id'] and bool(result['agent_id']) and context.get('quality_version')=='helena-delivery-quality-v1'
            result['status']='PASS' if result['soul_matches'] and result['contract_matches'] else 'FAIL'
        except Exception as error:
            result['error_type']=type(error).__name__
        rows.append(result)
        if index%5==0:print(json.dumps({'checked':index,'passed':sum(r['status']=='PASS' for r in rows),'ai_calls':0}),flush=True)
    report={'observed_at':datetime.now(timezone.utc).isoformat(),'quality_version':'helena-delivery-quality-v1','scope':'READ_ONLY_CONTEXT_AND_SOUL','profiles':rows,'passed':sum(r['status']=='PASS' for r in rows),'ai_calls':0,'real_business_tasks_tested':False}
    target=home/'helena-runtime'/'quality-validation.json'
    target.write_text(json.dumps(report,indent=2),encoding='utf-8')
    print(json.dumps({'status':'PASS' if report['passed']==21 else 'INCOMPLETE','profiles':len(rows),'passed':report['passed'],'ai_calls':0,'report':str(target),'failed_profiles':[r['profile'] for r in rows if r['status']!='PASS']}))
    if report['passed']!=21:raise SystemExit(1)

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--home',type=Path,default=Path('/data'))
    run(parser.parse_args().home)
