package tests

import (
	"testing"
	"time"

	"github.com/tvmensal2025/financeiromaxnutrition/services/meowcaller-service/internal/calls"
	"github.com/tvmensal2025/financeiromaxnutrition/services/meowcaller-service/internal/events"
)

func TestCallLifecycle(t *testing.T) {
	bus := events.NewEventBus()
	mgr := calls.NewCallManager(60, bus)

	call := mgr.RegisterCall("BIZ-003", "AGT-20", "5511999998888@s.whatsapp.net", calls.DirectionInbound)
	if call == nil {
		t.Fatal("Esperado que a chamada não seja nula")
	}

	snap := call.GetSnapshot()
	if snap.Status != calls.StatusRinging {
		t.Fatalf("Esperado status RINGING, obtido %s", snap.Status)
	}

	// Atender
	err := mgr.AnswerCall(call.CallID)
	if err != nil {
		t.Fatalf("Erro ao atender chamada: %v", err)
	}

	snap = call.GetSnapshot()
	if snap.Status != calls.StatusAccepted {
		t.Fatalf("Esperado status ACCEPTED, obtido %s", snap.Status)
	}

	// Ready
	call.SetReady()
	snap = call.GetSnapshot()
	if snap.Status != calls.StatusActive {
		t.Fatalf("Esperado status ACTIVE, obtido %s", snap.Status)
	}

	// Desligar
	err = mgr.HangupCall(call.CallID, "TEST_COMPLETED")
	if err != nil {
		t.Fatalf("Erro ao desligar chamada: %v", err)
	}

	snap = call.GetSnapshot()
	if snap.Status != calls.StatusEnded {
		t.Fatalf("Esperado status ENDED, obtido %s", snap.Status)
	}
	if snap.EndedAt == nil {
		t.Fatal("EndedAt não deveria ser nulo")
	}
}

func TestCallMaxDurationTimeout(t *testing.T) {
	bus := events.NewEventBus()
	// Manager com timeout de 1 segundo para teste rápido
	mgr := calls.NewCallManager(1, bus)

	call := mgr.RegisterCall("BIZ-003", "AGT-15", "5511999997777@s.whatsapp.net", calls.DirectionOutbound)
	time.Sleep(1200 * time.Millisecond)

	snap := call.GetSnapshot()
	if snap.Status != calls.StatusEnded {
		t.Fatalf("Esperado que a chamada tenha finalizado por timeout, status atual: %s", snap.Status)
	}
}
