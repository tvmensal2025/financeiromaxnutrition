"""Patch only release eligibility and role-aware instructions on the verified host."""
import ast
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import shutil
import sys

def install(target, source):
    before = target.read_bytes()
    original = before.decode('utf-8')
    incoming = source.read_text(encoding='utf-8')
    if hashlib.sha256(before).hexdigest() != 'bd7af9c7ec717025d0f368ad73616bea0c88edb2ae7be0b58c4c03c33694bff5':
        raise RuntimeError('Remote source changed; no write performed')
    helper = incoming[incoming.index('def has_current_release('):incoming.index('def dispatch_once(')]
    prompt_start = '        "Nao use complete_job, SQL direto, Terminal, web ou mensagens externas. "'
    prompt_end = '        "Nao prometa fatos comerciais nao confirmados.'
    prompt = incoming[incoming.index(prompt_start):incoming.index(prompt_end)]
    old_prompt = '        "Nao delegue, nao use complete_job, SQL direto, Terminal, web ou mensagens externas. "\n'
    old_gate = '            if requested:\n'
    for anchor in [old_prompt,old_gate,'def dispatch_once(']:
        if original.count(anchor) != 1: raise RuntimeError('Unexpected source anchor; no write performed')
    updated = original.replace(old_prompt,prompt).replace(old_gate,'            if requested or has_current_release(current):\n')
    updated = updated.replace('def dispatch_once(',helper+'def dispatch_once(',1)
    ast.parse(updated)
    old_ast, new_ast = ast.parse(original), ast.parse(updated)
    for node in old_ast.body:
        if isinstance(node,(ast.FunctionDef,ast.ClassDef)) and node.name not in {'run_profile','dispatch_once'}:
            other = next(n for n in new_ast.body if getattr(n,'name',None)==node.name)
            assert ast.dump(node)==ast.dump(other), node.name
    backup = target.with_name(target.name+'.release-backup-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ'))
    shutil.copy2(target,backup)
    target.write_text(updated,encoding='utf-8')
    receipt = {'status':'PATCHED','backup':str(backup),'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),
               'changes':['manager release activates READY job','role-aware coordination prompt'], 'model_calls':0}
    target.with_name('dispatch-release-patch-receipt.json').write_text(json.dumps(receipt),encoding='utf-8')
    print(json.dumps(receipt))

if __name__=='__main__': install(Path(sys.argv[1]),Path(sys.argv[2]))
