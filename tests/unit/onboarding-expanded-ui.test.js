import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const onboardingCss = readFileSync(resolve(root, "page-assets/css/styles-onboarding.css"), "utf8");

describe("expanded onboarding UI", () => {
  it("uses the existing focus layer for production, alliance, bounty and boost targets", () => {
    expect(onboardingCss).toContain('html[data-onboarding-step="production-choice"]');
    expect(onboardingCss).toContain('body.game-body[data-onboarding-step="production-choice"]');
    expect(onboardingCss).toContain("#building-shortcut-grid .building-shortcut-button.is-onboarding-focus-target");
    expect(onboardingCss).toContain('html[data-onboarding-step="alliance-guide"]');
    expect(onboardingCss).toContain("#alliance-chat-card.is-onboarding-focus-target");
    expect(onboardingCss).toContain("#alliance-btn.is-onboarding-focus-target");
    expect(onboardingCss).toContain('html[data-onboarding-step="bounty-boost-guide"]');
    expect(onboardingCss).toContain("[data-bounty-open-trigger].is-onboarding-focus-target");
    expect(onboardingCss).toContain("[data-boost-open-trigger].is-onboarding-focus-target");
    expect(onboardingCss).toMatch(/\[data-bounty-open-trigger\]\.is-onboarding-focus-target[\s\S]*rgba\(255, 52, 75, 0\.52\)/u);
    expect(onboardingCss).toMatch(/\[data-boost-open-trigger\]\.is-onboarding-focus-target[\s\S]*rgba\(84, 223, 245, 0\.5\)/u);
  });

  it("keeps the onboarding panel black-gold, glassy and reduced-motion safe", () => {
    expect(onboardingCss).toMatch(/\.empire-onboarding \{\r?\n\s*--onboarding-glass-bg: rgba\(2, 5, 10, 0\.86\);/u);
    expect(onboardingCss).toContain("--onboarding-gold: #f5cc66;");
    expect(onboardingCss).toContain("--onboarding-cyan: #54dff5;");
    expect(onboardingCss).toContain("backdrop-filter: blur(22px) saturate(126%);");
    expect(onboardingCss).toContain("linear-gradient(135deg, #ffe49a, #d4a638)");
    expect(onboardingCss).toMatch(/@media \(max-width: 900px\)[\s\S]*\.empire-onboarding__button \{[\s\S]*min-height: 44px;/u);
    expect(onboardingCss).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*\.empire-onboarding::after,[\s\S]*animation: none !important;/u);
  });
});
