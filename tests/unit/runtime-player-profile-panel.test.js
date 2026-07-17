import { describe, expect, it } from "vitest";
import { createPlayerProfileViewModel } from "../../page-assets/js/app/runtime/playerProfileViewModel.js";
import { renderPlayerProfilePanel } from "../../page-assets/js/app/ui/playerProfilePanel.js";

class FakeClassList {
  constructor(tokens = []) {
    this.tokens = new Set(tokens);
  }

  add(...tokens) {
    for (const token of tokens) {
      this.tokens.add(token);
    }
  }

  remove(...tokens) {
    for (const token of tokens) {
      this.tokens.delete(token);
    }
  }

  contains(token) {
    return this.tokens.has(token);
  }
}

class FakeElement {
  constructor(tagName = "div") {
    this.tagName = tagName.toUpperCase();
    this.dataset = {};
    this.textContent = "";
    this.src = "";
    this.attributes = new Map();
    this.classList = new FakeClassList();
    this.styleValues = new Map();
    this.style = {
      setProperty: (property, value) => {
        this.styleValues.set(property, String(value));
      }
    };
  }

  removeAttribute(name) {
    this.attributes.delete(name);
    if (name === "src") {
      this.src = "";
    }
  }
}

const createElements = () => ({
  openButton: new FakeElement("button"),
  card: new FakeElement("div"),
  avatar: new FakeElement("img"),
  avatarFallback: new FakeElement("span"),
  name: new FakeElement("strong"),
  identity: new FakeElement("strong"),
  faction: new FakeElement("strong"),
  server: new FakeElement("strong"),
  empireScore: new FakeElement("strong"),
  cleanMoney: new FakeElement("strong"),
  dirtyMoney: new FakeElement("strong"),
  influence: new FakeElement("strong"),
  heat: new FakeElement("strong"),
  protection: new FakeElement("strong"),
  gang: new FakeElement("strong"),
  alliance: new FakeElement("strong"),
  districts: new FakeElement("strong")
});

describe("player profile panel renderer", () => {
  it("builds player profile view-model labels from read-only state", () => {
    const model = createPlayerProfileViewModel({
      registration: {
        identity: "Smoke Boss",
        factionId: "hackeri",
        serverLabel: "Free EU"
      },
      faction: { name: "Hackeři" },
      displaySnapshot: {
        cleanMoney: 1200,
        dirtyMoney: 300,
        influence: 8
      },
      gangState: {
        heat: 12
      },
      districtCount: 3,
      empireScore: 12345,
      allianceLabel: "Neon Pact",
      avatarSrc: "../img/avatar.png",
      accentColor: "#3b82f6",
      assetResolver: (value) => `/assets/${value}`,
      protectionLabel: "4 min"
    });

    expect(model).toMatchObject({
      avatarSrc: "/assets/../img/avatar.png",
      avatarFallback: "Smoke Boss",
      accentRgb: "59, 130, 246",
      factionId: "hackeri",
      identityLabel: "Smoke Boss",
      factionLabel: "Hackeři",
      serverLabel: "Free EU",
      empireScoreLabel: "12 345",
      cleanMoneyLabel: "$1 200",
      dirtyMoneyLabel: "$300",
      influenceLabel: "8",
      gangLabel: "Smoke Boss Crew",
      allianceLabel: "Neon Pact",
      districtCountLabel: "3",
      heatLabel: "12",
      protectionLabel: "4 min"
    });
  });

  it("renders avatar background, accent and text fields", () => {
    const elements = createElements();
    elements.avatar.classList.add("is-empty");

    renderPlayerProfilePanel(elements, {
      avatarSrc: "../img/avatar.png",
      accentColor: "#3b82f6",
      accentRgb: "59, 130, 246",
      factionId: "hackeri",
      identityLabel: "Smoke Boss",
      factionLabel: "Hackeři",
      serverLabel: "War EU",
      empireScoreLabel: "12 345",
      cleanMoneyLabel: "$1 200",
      dirtyMoneyLabel: "$300",
      influenceLabel: "8",
      heatLabel: "12",
      protectionLabel: "4 min",
      gangLabel: "Smoke Crew",
      allianceLabel: "Neon Pact",
      districtCountLabel: "3"
    });

    expect(elements.card.dataset.playerAvatarBg).toBe("ready");
    expect(elements.card.styleValues.get("--player-popup-avatar-url")).toBe('url("../img/avatar.png")');
    expect(elements.card.styleValues.get("--player-popup-avatar-opacity")).toBe("1");
    expect(elements.card.styleValues.get("--player-popup-border-color")).toBe("#3b82f6");
    expect(elements.avatar.src).toBe("../img/avatar.png");
    expect(elements.avatar.classList.contains("is-empty")).toBe(false);
    expect(elements.avatarFallback.textContent).toBe("S");
    expect(elements.openButton.dataset.playerFaction).toBe("hackeri");
    expect(elements.openButton.styleValues.get("--player-profile-accent-rgb")).toBe("59, 130, 246");
    expect(elements.name.textContent).toBe("Smoke Boss");
    expect(elements.faction.textContent).toBe("Hackeři");
    expect(elements.server.textContent).toBe("War EU");
    expect(elements.empireScore.textContent).toBe("12 345");
    expect(elements.cleanMoney.textContent).toBe("$1 200");
    expect(elements.dirtyMoney.textContent).toBe("$300");
    expect(elements.influence.textContent).toBe("8");
    expect(elements.heat.textContent).toBe("12");
    expect(elements.protection.textContent).toBe("4 min");
    expect(elements.gang.textContent).toBe("Smoke Crew");
    expect(elements.alliance.textContent).toBe("Neon Pact");
    expect(elements.districts.textContent).toBe("3");
  });

  it("clears avatar styles and uses safe defaults when avatar is missing", () => {
    const elements = createElements();
    elements.card.dataset.playerAvatarBg = "ready";
    elements.avatar.src = "../img/avatar.png";

    renderPlayerProfilePanel(elements, {
      identityLabel: "Host"
    });

    expect(elements.card.dataset.playerAvatarBg).toBeUndefined();
    expect(elements.card.styleValues.get("--player-popup-avatar-url")).toBe("none");
    expect(elements.card.styleValues.get("--player-popup-avatar-opacity")).toBe("0");
    expect(elements.avatar.src).toBe("");
    expect(elements.avatar.classList.contains("is-empty")).toBe(true);
    expect(elements.avatarFallback.textContent).toBe("H");
    expect(elements.faction.textContent).toBe("-");
    expect(elements.server.textContent).toBe("-");
    expect(elements.gang.textContent).toBe("Guest Crew");
    expect(elements.alliance.textContent).toBe("Žádná");
  });

  it("does not throw when optional elements are missing", () => {
    expect(() => {
      renderPlayerProfilePanel({}, {
        identityLabel: "Partial",
        avatarSrc: "../img/avatar.png"
      });
    }).not.toThrow();
  });
});
