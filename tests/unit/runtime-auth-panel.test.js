import { afterEach, describe, expect, it } from "vitest";
import {
  createCompletedRegistrationStatusViewModel,
  createExistingRegistrationViewModel,
  createFactionPreviewViewModel,
  createLockedRegistrationStatusViewModel
} from "../../page-assets/js/app/runtime/authRegistrationViewModel.js";
import {
  renderAuthStatus,
  renderFactionPreviewPanel
} from "../../page-assets/js/app/ui/authPanel.js";

const originalDocument = globalThis.document;

class FakeElement {
  constructor() {
    this.children = [];
    this.textContent = "";
    this.className = "";
  }

  replaceChildren(...children) {
    this.children = children;
  }
}

function setupDocument() {
  globalThis.document = {
    createElement: () => new FakeElement()
  };
}

afterEach(() => {
  globalThis.document = originalDocument;
});

describe("auth panel UI module", () => {
  it("builds auth registration view models without DOM", () => {
    const factionCatalog = {
      mafian: { name: "Mafie" },
      hackeri: { name: "Hackeři" }
    };

    expect(createExistingRegistrationViewModel(null, factionCatalog)).toMatchObject({
      locked: false,
      activeFactionId: "mafian",
      statusTitle: "Výběr frakce"
    });

    expect(createExistingRegistrationViewModel({ identity: "Ada", factionId: "hackeri" }, factionCatalog)).toMatchObject({
      locked: true,
      activeFactionId: "hackeri",
      identityValue: "Ada",
      statusTitle: "Frakce uzamčena"
    });

    expect(createLockedRegistrationStatusViewModel({ identity: "Ada", factionId: "hackeri" }, factionCatalog).note).toContain("Hackeři");
    expect(createCompletedRegistrationStatusViewModel({ identity: "Ada", factionId: "hackeri", lockedAt: "now", factionCatalog }).note).toContain("now");
  });

  it("renders auth status and no-crashes without a mount", () => {
    setupDocument();
    const mount = new FakeElement();

    expect(renderAuthStatus(null, "Missing", "Mount")).toBe(false);
    expect(renderAuthStatus(mount, "Výběr frakce", "Vyber frakci.")).toBe(true);
    expect(mount.children).toHaveLength(3);
    expect(mount.children[0].textContent).toBe("Registrace");
    expect(mount.children[1].textContent).toBe("Výběr frakce");
  });

  it("renders faction preview with partial root support", () => {
    setupDocument();
    const elements = new Map();
    const root = {
      querySelector: (selector) => {
        if (!elements.has(selector)) {
          elements.set(selector, new FakeElement());
        }
        return elements.get(selector);
      }
    };

    const viewModel = createFactionPreviewViewModel({
      name: "Mafie",
      tagline: "Tichá kontrola",
      description: "Popis.",
      startingPackage: {
        cleanMoney: 100,
        dirtyMoney: 50,
        influence: 2,
        heat: 1
      },
      advantages: ["Bonus"],
      disadvantages: ["Riziko"]
    });

    expect(renderFactionPreviewPanel(root, viewModel, { formatCurrency: (value) => `$${value}` })).toBe(true);

    expect(elements.get("[data-faction-name]").textContent).toBe("Mafie");
    expect(elements.get("[data-faction-clean-money]").textContent).toBe("$100");
    expect(elements.get("[data-faction-advantages]").children[0].textContent).toBe("Bonus");
  });
});
