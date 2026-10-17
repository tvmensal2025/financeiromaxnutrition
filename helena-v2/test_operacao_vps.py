"""Exercita o passo real do workflow com SSH e instalador locais, sem tocar na VPS."""
import os
from pathlib import Path
import subprocess

import pytest
import yaml


RAIZ = Path(__file__).resolve().parents[1]


@pytest.mark.parametrize("codigo", [0, 7, 42])
def test_workflow_preserva_a_falha_do_instalador_e_limpa_o_ambiente(tmp_path, codigo):
    workflow = yaml.safe_load((RAIZ / ".github/workflows/helena-vps-motor.yml").read_text())
    passo = next(p for p in workflow["jobs"]["vps"]["steps"]
                 if p.get("name") == "Rodar: ${{ inputs.etapa }}")
    servidor = tmp_path / "vps-falsa"
    servidor.mkdir()
    instalador = servidor / "instalar-motor.sh"
    instalador.write_text(f'#!/bin/bash\nprintf "etapa=%s\\n" "$1"\nexit {codigo}\n')
    ssh = tmp_path / "ssh-falso"
    ssh.write_text(
        '#!/usr/bin/env python3\n'
        'import os, sys\n'
        'comando = sys.argv[-1].replace("/root/", os.environ["VPS_FALSA"] + "/")\n'
        'os.execv("/bin/bash", ["bash", "-c", comando])\n'
    )
    ssh.chmod(0o700)
    resultado = subprocess.run(
        ["bash", "-c", passo["run"]], capture_output=True, text=True,
        env={"PATH": os.environ["PATH"], "SSH_CMD": str(ssh),
             "VPS_HOST": "vps.invalid", "VPS_FALSA": str(servidor),
             "RUNNER_TEMP": str(tmp_path), "ETAPA": "conferir"},
    )
    assert resultado.returncode == codigo, resultado.stderr
    assert "etapa=conferir" in resultado.stdout
    assert f"SAIDA={codigo}" in resultado.stdout
    assert not (servidor / ".helena-ambiente.sh").exists()
    assert not list(tmp_path.glob("helena-vps-ambiente.*"))
