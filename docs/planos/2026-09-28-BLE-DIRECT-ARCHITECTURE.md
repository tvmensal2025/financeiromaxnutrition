# Wearables — Arquitetura de Conexão Direta BLE

> **Status:** Código implementado com testes unitários ✅. Validação em hardware físico: `HARDWARE_VALIDATION_PENDING`.

## Visão Geral

O MaxNutrition suporta três fontes de dados de saúde, em paralelo:

| Fonte | Dados | Requisito |
|-------|-------|-----------|
| **Health Connect** (Android) | Passos, HR, sono, calorias, distância, exercícios | App nativo Android |
| **Apple Health** (iOS) | Passos, HR, sono, calorias, distância, exercícios | App nativo iOS |
| **BLE Direto** (Android + iOS) | HR em tempo real, bateria, info do dispositivo | Relógio com GATT padrão |

A conexão BLE direta **não substitui** o Health Connect / Apple Health — ela é uma fonte adicional para dados em tempo real (ex.: batimentos cardíacos durante treino) que os hubs de saúde não fornecem com latência suficiente.

## Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                      React Components                       │
│  WearableConnectPage  │  WorkoutTracker  │  Dashboard       │
├─────────────────────────────────────────────────────────────┤
│                     useNativeBle (hook)                      │
│  scan • connect • disconnect • getSessionData               │
├─────────────────────────────────────────────────────────────┤
│                   BleDeviceManager                          │
│  lifecycle • reconnect • capabilities • state machine       │
├─────────────────────────────────────────────────────────────┤
│                     GattQueue                                │
│  serialização • timeout • retry • backoff                   │
├─────────────────────────────────────────────────────────────┤
│                   BleTransport (interface)                   │
│  ┌──────────────────┐  ┌──────────────────────┐             │
│  │ CapacitorBleTransp│  │ MockBleTransport     │             │
│  │ (produção real)   │  │ (testes/dev)         │             │
│  └──────────────────┘  └──────────────────────┘             │
├─────────────────────────────────────────────────────────────┤
│                    BleParser                                 │
│  HR Measurement • Battery Level • Device Information        │
└─────────────────────────────────────────────────────────────┘
```

## Arquivos

| Arquivo | Responsabilidade |
|---------|-----------------|
| `src/lib/ble/gattQueue.ts` | Fila serializada de operações GATT com timeout e backoff |
| `src/lib/ble/bleParser.ts` | Decodificadores GATT determinísticos (HR, Battery, DeviceInfo) |
| `src/lib/ble/bleDeviceManager.ts` | Ciclo de vida do dispositivo, scanner e reconexão automática |
| `src/lib/ble/capacitorBleTransport.ts` | Transporte real via Capacitor BLE v8 (`@capacitor-community/bluetooth-le`) |
| `src/lib/ble/mockBleTransport.ts` | Transporte simulado para testes unitários automatizados |
| `src/lib/ble/index.ts` | Barrel export estruturado e tipado |
| `src/hooks/useNativeBle.ts` | Hook React do motor BLE nativo direto com DI de transporte |
| `src/hooks/useBLEWearable.ts` | Hook canônico unificado (retrocompatível com dashboard e superfícies legadas) |
| `src/pages/WearableConnectPage.tsx` | Página canônica de conexão com radar Bluetooth e estatísticas em tempo real |
| `src/components/dashboard/WearableConnectionCard.tsx` | Card de dashboard integrado para wearables e BLE |
| `src/lib/ble/__tests__/bleModule.test.ts` | 38 testes unitários do motor BLE |
| `src/hooks/__tests__/useNativeBle.test.tsx` | 5 testes unitários do hook nativo React |
| `src/tests/certification/batch14-dr-vital-features.test.tsx` | 19 testes de certificação P1 (incluindo superfícies 18 e 19 de wearable) |

## Serviços BLE Suportados

Todos os serviços são **padrão Bluetooth SIG** (público, sem licenciamento):

| Serviço | UUID | Função |
|---------|------|--------|
| Heart Rate | `0x180D` | BPM em tempo real, sensor contact, RR intervals |
| Battery | `0x180F` | Nível de bateria (0-100%) |
| Device Information | `0x180A` | Fabricante, modelo, serial, firmware |
| Running Speed & Cadence | `0x1814` | Velocidade e cadência (discovery apenas) |

## Compatibilidade Esperada

### Conexão direta inteiramente interna (sem app externo)

Qualquer dispositivo BLE que exponha o serviço Heart Rate (0x180D) conforme a especificação GATT pode ser conectado diretamente. Isso inclui:

- **Cintas torácicas HR**: Polar H10, Garmin HRM-Dual, Wahoo TICKR, genéricos
- **Sensores ópticos**: Scosche Rhythm+, COROS HR Monitor
- **Relógios básicos** que expõem HR via GATT padrão

### Limitações documentadas

| Dispositivo | Limitação | Motivo |
|-------------|-----------|--------|
| Apple Watch | Não expõe HR via GATT BLE padrão | Dados só via Apple Health / HealthKit |
| Galaxy Watch (Wear OS) | HR não acessível via GATT direto | Dados via Samsung Health → Health Connect |
| Xiaomi Mi Band 7/8 | Requer chave de autenticação proprietária | Protocolo BLE proprietário além do GATT |
| Amazfit GTS 4 / T-Rex 2 | Requer chave de autenticação Huami | Protocolo proprietário |
| Fitbit | Dados não acessíveis via BLE GATT padrão | Ecossistema fechado, só via API web |

## Fluxo do Usuário

1. Abre "Meus dispositivos" (`/wearable-connect`)
2. Toca em "Conectar relógio ou sensor"
3. Autoriza permissões BLE (Android: `BLUETOOTH_SCAN`, `BLUETOOTH_CONNECT`)
4. Seleciona o aparelho na lista de dispositivos encontrados
5. Aguarda descoberta de serviços (< 5 segundos)
6. Se o dispositivo expõe HR: exibe BPM em tempo real
7. Se o dispositivo expõe Battery: exibe nível de bateria
8. Dados de HR da sessão são acumulados (min/avg/max) e persistidos

## Confiabilidade

| Mecanismo | Implementação |
|-----------|--------------|
| Operações GATT serializadas | `GattQueue` — uma operação por vez |
| Timeout por operação | 10s padrão, 15s para service discovery |
| Retry com backoff | 2 retentativas, delay exponencial (300ms, 600ms) |
| Erros permanentes | `not connected`, `device not found` — sem retry |
| Reconexão automática | Até 5 tentativas com backoff (2s, 4s, 8s, 16s, 32s) |
| Cleanup completo | `destroy()` limpa timers, listeners, fila e transportes |

## Licenciamento

- Todo o código de parsing BLE é **implementação original** baseada nas especificações públicas do Bluetooth SIG
- **Nenhum código do Gadgetbridge (AGPL)** foi incorporado ou adaptado
- O plugin `@capacitor-community/bluetooth-le` é licenciado sob MIT
- O componente `WearableCompatibilityGuide` menciona o Gadgetbridge apenas como **informação ao usuário** sobre uma alternativa open source instalável separadamente

## Validação Necessária (Hardware)

> ⚠️ **HARDWARE_VALIDATION_PENDING**

Os testes unitários cobrem:
- Parsing de todos os formatos de payload HR (8-bit, 16-bit, contact, energy, RR)
- Ciclo completo via MockBleTransport (scan → connect → HR → disconnect)
- Reconexão automática após desconexão involuntária
- Timeout, retry e cancelamento da GattQueue

**O que requer hardware físico:**
1. Radio BLE real com `CapacitorBleTransport` em Android/iOS
2. Estabilidade de background (CPU sleep, Doze mode)
3. Comportamento de reconexão com distância real
4. Parsing de payloads de dispositivos reais (variações de fabricante)
5. Latência entre notificação e renderização na UI
