import { createChannel } from "@blazeshomida/channel";

import "./style.css";

const app = document.querySelector("#app");

if (!app) {
  throw new Error("Missing #app element.");
}

const result = createChannel();

app.textContent = result;
