import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const liveSource = readFileSync(resolve(process.cwd(), "page-assets/js/login-live.js"), "utf8");
const pageSource = readFileSync(resolve(process.cwd(), "pages/login.html"), "utf8");

describe("login registration policy guard", () => {
  it("keeps registration closed until the public policy succeeds", () => {
    expect(pageSource).toContain("data-login-registration-open");
    expect(pageSource).toContain("data-login-registration-overlay");
    expect(pageSource).toMatch(/id="register-password-confirmation"[^>]+disabled/u);
    expect(pageSource).toMatch(/id="register-terms"[^>]+required[^>]+disabled/u);
    expect(pageSource).toMatch(/class="login-registration-submit"[^>]+disabled/u);
    expect(liveSource).toContain("loadAccountRegistrationPolicy");
    expect(liveSource).toContain("state.registrationEnabled = false");
    expect(liveSource).toContain("Stav registrace se nepodařilo ověřit");
    expect(liveSource).toContain("bindLoginRegistrationModal");
    expect(liveSource).toContain("passwordConfirmation");
    expect(liveSource).toContain("dateOfBirth");
    expect(liveSource).toContain("termsAccepted: true");
    expect(liveSource).toContain("termsVersion");
    expect(liveSource).not.toContain("inviteCode");
    expect(liveSource).not.toContain("EmpireConfigOverrides");
  });

  it("keeps account credentials out of a native GET before live handlers bind", () => {
    expect(pageSource).toMatch(/<form\s+id="login-form"[^>]+method="post"[^>]+action="\/pages\/login\.html"/u);
    expect(pageSource).toMatch(/id="login-username"[^>]+disabled/u);
    expect(pageSource).toMatch(/id="login-password"[^>]+disabled/u);
    expect(pageSource).toMatch(/type="submit"\s+class="enter-city-button"[^>]+disabled/u);
    expect(pageSource).toContain('data-login-ready="false"');

    const listenerIndex = liveSource.indexOf('loginForm?.addEventListener("submit"');
    const readyIndex = liveSource.indexOf("markLoginFormReady(loginForm)");
    expect(listenerIndex).toBeGreaterThanOrEqual(0);
    expect(readyIndex).toBeGreaterThan(listenerIndex);
    expect(liveSource).toContain('form.dataset.loginReady = "true"');
  });
});
