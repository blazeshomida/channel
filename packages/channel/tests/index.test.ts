import { expect, test } from "vite-plus/test";

import { createChannel } from "../src/index";

test("createChannel", () => {
  expect(createChannel()).toBe("channel");
});
