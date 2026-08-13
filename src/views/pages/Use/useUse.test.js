import { voiceCommandFromTranscript } from "./useUse";

describe("voiceCommandFromTranscript", () => {
  test("sends ordinary dictation directly", () => {
    expect(voiceCommandFromTranscript("  abra a câmera ", "dictation")).toBe("abra a câmera");
  });

  test("extracts a hands-free request after the wake word", () => {
    expect(voiceCommandFromTranscript("Atto, abra a câmera", "hands-free")).toBe("abra a câmera");
    expect(voiceCommandFromTranscript("ato faça isso", "hands-free")).toBe("faça isso");
  });

  test("ignores ambient speech without the wake word", () => {
    expect(voiceCommandFromTranscript("abra a câmera", "hands-free")).toBe("");
  });
});
