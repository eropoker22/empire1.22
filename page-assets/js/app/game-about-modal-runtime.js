import { bindLoginAboutModal } from "./login-about-modal.js";

export const initGameAboutModalRuntime = () => {
  bindLoginAboutModal(document);
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initGameAboutModalRuntime, { once: true });
} else {
  initGameAboutModalRuntime();
}
