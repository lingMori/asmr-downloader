import { afterEach, expect } from "vitest";
import * as matchers from "@testing-library/jest-dom/matchers";
import { cleanup } from "@testing-library/react";
import { MotionGlobalConfig } from "framer-motion";

expect.extend(matchers);

// vitest 未开 globals,RTL 自动 cleanup 不生效,手动挂
afterEach(() => cleanup());

// jsdom 中跳过 framer-motion 动画,避免退出动画异步滞留 DOM
MotionGlobalConfig.skipAnimations = true;

class MockEventSource {
  constructor(public url: string) {}
  addEventListener() {}
  close() {}
}

// @ts-expect-error test shim
global.EventSource = MockEventSource;

// jsdom 不实现媒体播放:stub 掉,避免组件测试里 audio.play() 返回 undefined 炸 .catch
window.HTMLMediaElement.prototype.play = function () {
  return Promise.resolve();
};
window.HTMLMediaElement.prototype.pause = function () {};
window.HTMLMediaElement.prototype.load = function () {};

// TanStack Router 滚动恢复会调 scrollTo,jsdom 未实现
window.scrollTo = () => {};
