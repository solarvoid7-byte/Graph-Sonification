import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach } from "vitest";

class MockParam {
  value = 0;
  setValueAtTime(value: number) {
    this.value = value;
  }
  linearRampToValueAtTime(value: number) {
    this.value = value;
  }
  exponentialRampToValueAtTime(value: number) {
    this.value = value;
  }
  cancelScheduledValues() {}
}

function mockAudioNode() {
  return {
    connect() {
      return this;
    },
    disconnect() {},
    start() {},
    stop() {},
  };
}

class MockAudioContext {
  state: AudioContextState = "suspended";
  currentTime = 0;
  destination = mockAudioNode();
  resume = async () => {
    this.state = "running";
  };
  createGain() {
    return { ...mockAudioNode(), gain: new MockParam() };
  }
  createOscillator() {
    const node = {
      ...mockAudioNode(),
      type: "sine" as OscillatorType,
      frequency: new MockParam(),
      onended: null as null | (() => void),
    };
    const start = node.start;
    node.start = () => {
      start();
      window.setTimeout(() => node.onended?.(), 0);
    };
    return node;
  }
  createStereoPanner() {
    return { ...mockAudioNode(), pan: new MockParam() };
  }
  createDynamicsCompressor() {
    return {
      ...mockAudioNode(),
      threshold: new MockParam(),
      knee: new MockParam(),
      ratio: new MockParam(),
      attack: new MockParam(),
      release: new MockParam(),
    };
  }
}

beforeEach(() => {
  localStorage.clear();
  Object.defineProperty(window, "AudioContext", { writable: true, configurable: true, value: MockAudioContext });
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function showModal() {
      this.open = true;
    };
  }
  if (!HTMLDialogElement.prototype.close) {
    HTMLDialogElement.prototype.close = function close() {
      this.open = false;
      this.dispatchEvent(new Event("close"));
    };
  }
});

afterEach(() => {
  cleanup();
});
