package voice

import (
	"testing"

	"github.com/purpshell/meowcaller"
)

func testVoiceSink() (*ConversationalSink, *meowcaller.Player) {
	player := meowcaller.NewPlayer()
	player.Play(nil) // No RTP/network: only exercise the actual playback state machine.
	engine := &Engine{callPlayers: map[string]*meowcaller.Player{"test": player}}
	return &ConversationalSink{
		callID: "test", engine: engine, noiseFloor: 0.00008,
		rmsThreshold: 0.003, silenceThreshold: 12, minSpeechSamples: 2400,
	}, player
}

func voiceFrame(level float32) []float32 {
	frame := make([]float32, 960)
	for i := range frame {
		frame[i] = level
	}
	return frame
}

func TestBargeInRequiresSustainedSpeechAndKeepsOnset(t *testing.T) {
	sink, player := testVoiceSink()
	for i := 0; i < 2; i++ {
		if err := sink.WriteFrame(voiceFrame(0.01)); err != nil {
			t.Fatal(err)
		}
		if player.State() != meowcaller.PlayerPlaying || sink.isSpeaking {
			t.Fatal("short sound must not interrupt playback or confirm speech")
		}
	}
	if err := sink.WriteFrame(voiceFrame(0.01)); err != nil {
		t.Fatal(err)
	}
	if player.State() != meowcaller.PlayerIdle || !sink.isSpeaking {
		t.Fatal("180ms of sustained speech must interrupt playback")
	}
	if len(sink.speechSamples) != 3*960 {
		t.Fatalf("lost initial speech samples: got %d", len(sink.speechSamples))
	}
}

func TestIsolatedSpikesAndQuietEchoDoNotInterrupt(t *testing.T) {
	sink, player := testVoiceSink()
	for _, level := range []float32{0.01, 0, 0.01, 0, 0.00025, 0.00025, 0.00025} {
		if err := sink.WriteFrame(voiceFrame(level)); err != nil {
			t.Fatal(err)
		}
	}
	if player.State() != meowcaller.PlayerPlaying || sink.isSpeaking {
		t.Fatal("isolated spikes or quiet playback echo interrupted the player")
	}
	if sink.noiseFloor != 0.00008 {
		t.Fatal("playback contaminated the noise floor")
	}
}

func TestSpeechWithoutPlaybackKeepsFirstFrame(t *testing.T) {
	sink, player := testVoiceSink()
	player.Stop()
	for i := 0; i < 2; i++ {
		if err := sink.WriteFrame(voiceFrame(0.01)); err != nil {
			t.Fatal(err)
		}
	}
	if !sink.isSpeaking || len(sink.speechSamples) != 1920 {
		t.Fatal("normal speech must preserve both onset frames")
	}
}

func TestListActiveCallsExcludesEnded(t *testing.T) {
	e := &Engine{activeCalls: map[string]*CallSnapshot{
		"done": {CallID: "done", Status: "ENDED"},
		"live": {CallID: "live", Status: "CONNECTED"},
	}}
	calls := e.ListActiveCalls()
	if len(calls) != 1 || calls[0].CallID != "live" {
		t.Fatalf("unexpected active calls: %+v", calls)
	}
}

func TestRoomNoiseDoesNotStartOrExtendSpeech(t *testing.T) {
	sink, player := testVoiceSink()
	player.Stop()
	for i := 0; i < 30; i++ {
		_ = sink.WriteFrame(voiceFrame(0.001))
	}
	if sink.isSpeaking {
		t.Fatal("room noise classified as speech")
	}
	for i := 0; i < 4; i++ {
		_ = sink.WriteFrame(voiceFrame(0.02))
	}
	if !sink.isSpeaking {
		t.Fatal("clear speech not detected")
	}
	// Stop before dispatch; verify background frames count toward the end pause.
	for i := 0; i < 10; i++ {
		_ = sink.WriteFrame(voiceFrame(0.001))
	}
	if sink.silenceFrames != 10 {
		t.Fatalf("noise prevented endpoint: %d", sink.silenceFrames)
	}
}

func TestShortClauseKeepsHalfSecondPauseInSameTurn(t *testing.T) {
	sink, player := testVoiceSink()
	player.Stop()
	for i := 0; i < 30; i++ {
		_ = sink.WriteFrame(voiceFrame(0.02))
	}
	epoch := sink.speechEpoch
	for i := 0; i < 8; i++ {
		_ = sink.WriteFrame(voiceFrame(0))
	}
	if !sink.isSpeaking {
		t.Fatal("half-second thinking pause ended the short clause")
	}
	for i := 0; i < 4; i++ {
		_ = sink.WriteFrame(voiceFrame(0.02))
	}
	if sink.speechEpoch != epoch || sink.silenceFrames != 0 {
		t.Fatal("continuation must stay in the same speech turn")
	}
}

func TestShortSpeechEndsAt720msAndContinuationAdvancesEpoch(t *testing.T) {
	sink, player := testVoiceSink()
	player.Stop()
	for i := 0; i < 5; i++ {
		_ = sink.WriteFrame(voiceFrame(0.02))
	}
	epoch := sink.speechEpoch
	// Complete dispatch in memory, without a live HTTP request.
	live := &liveSpeechStream{frames: make(chan []byte, 32), result: make(chan bool, 1), cancel: func() {}}
	live.result <- true
	sink.liveStream = live
	for i := 0; i < 11; i++ {
		_ = sink.WriteFrame(voiceFrame(0))
	}
	if !sink.isSpeaking {
		t.Fatal("ended before the 720ms pause")
	}
	_ = sink.WriteFrame(voiceFrame(0))
	if sink.isSpeaking {
		t.Fatal("still waiting after 720ms")
	}
	for i := 0; i < 2; i++ {
		_ = sink.WriteFrame(voiceFrame(0.02))
	}
	if !sink.isSpeaking || sink.speechEpoch != epoch+1 {
		t.Fatal("resumed speech did not invalidate the pending answer")
	}
}
