import { describe, it, expect, vi, beforeEach } from "vitest";
import { playTone, isSoundEnabled, setSoundEnabled } from "../src/sound.js";

describe("sound settings", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("defaults to enabled", () => {
    expect(isSoundEnabled()).toBe(true);
  });

  it("persists the enabled flag across reads", () => {
    setSoundEnabled(false);
    expect(isSoundEnabled()).toBe(false);
    setSoundEnabled(true);
    expect(isSoundEnabled()).toBe(true);
  });
});

describe("playTone", () => {
  function installAudioContextMock() {
    const oscillator = {
      type: "sine",
      frequency: { value: 0 },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };
    const gainNode = { connect: vi.fn(), gain: { value: 1 } };
    const audioContext = {
      createOscillator: vi.fn(() => oscillator),
      createGain: vi.fn(() => gainNode),
      destination: {},
      currentTime: 0,
      close: vi.fn(),
    };
    // @ts-expect-error test double, not a full AudioContext
    globalThis.AudioContext = vi.fn(function AudioContextMock() {
      return audioContext;
    });
    return { audioContext, oscillator };
  }

  beforeEach(() => {
    localStorage.clear();
  });

  it("plays a tone when sound is enabled", () => {
    const { oscillator } = installAudioContextMock();
    setSoundEnabled(true);
    playTone("correct");
    expect(oscillator.start).toHaveBeenCalledTimes(1);
    expect(oscillator.stop).toHaveBeenCalledTimes(1);
  });

  it("does nothing when sound is disabled", () => {
    const { oscillator } = installAudioContextMock();
    setSoundEnabled(false);
    playTone("correct");
    expect(oscillator.start).not.toHaveBeenCalled();
  });
});
