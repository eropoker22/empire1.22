import { bootstrapPage, PAGE_ROOT_SELECTOR } from "./app/render-ui.js";

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootstrapPage, { once: true });
} else if (document.querySelector(PAGE_ROOT_SELECTOR)) {
  bootstrapPage();
}
