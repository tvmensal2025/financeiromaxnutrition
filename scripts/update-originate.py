with open('services/meowcaller-service/internal/voice/engine.go', 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
i = 0
while i < len(lines):
    line = lines[i]
    if 'call.OnReady(func() {' in line and 'Iniciando fala do atendente' in lines[i+2]:
        new_lines.append(line)
        new_lines.append(lines[i+1])
        new_lines.append('\t\t\tlog.Info().Str("call_id", callID).Msg("📞 Chamada conectada — mídia fluindo! Iniciando escuta conversacional e fala do Pedro...")\n')
        new_lines.append('\t\t\t// Conecta o sink conversacional contínuo para ouvir o cliente\n')
        new_lines.append('\t\t\tsink := e.registerConversationalSink(callID, call)\n')
        new_lines.append('\t\t\tcall.Receive(sink)\n')
        new_lines.append(lines[i+3])
        new_lines.append(lines[i+4])
        new_lines.append(lines[i+5]) # call.OnEnd...
        new_lines.append(lines[i+6]) # log.Info...
        new_lines.append(lines[i+7]) # snap.Status = ENDED
        new_lines.append('\t\t\te.callsMu.Lock()\n')
        new_lines.append('\t\t\tif sink, ok := e.callSinks[callID]; ok {\n')
        new_lines.append('\t\t\t\t_ = sink.Close()\n')
        new_lines.append('\t\t\t\tdelete(e.callSinks, callID)\n')
        new_lines.append('\t\t\t}\n')
        new_lines.append('\t\t\tdelete(e.callPlayers, callID)\n')
        new_lines.append('\t\t\te.callsMu.Unlock()\n')
        i += 8
    else:
        new_lines.append(line)
        i += 1

with open('services/meowcaller-service/internal/voice/engine.go', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)
print('Updated OriginateCall successfully!')
