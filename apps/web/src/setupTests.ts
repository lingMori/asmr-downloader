import { expect } from "vitest";
import * as matchers from "@testing-library/jest-dom/matchers";

expect.extend(matchers);

class MockEventSource {
  constructor(public url: string) {}
  addEventListener() {}
  close() {}
}

// @ts-expect-error test shim
global.EventSource = MockEventSource;
