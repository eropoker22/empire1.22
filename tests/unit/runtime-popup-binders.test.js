import { describe, expect, it, vi } from "vitest";
import { createRuntimePopupBinders } from "../../page-assets/js/app/ui/runtimePopupBinders.js";

describe("runtime popup binders", () => {
  it("does not crash when root is missing", () => {
    const binders = createRuntimePopupBinders();

    expect(() => binders.bindSettingsModal(null)).not.toThrow();
    expect(() => binders.bindPlayerProfilePopup(null)).not.toThrow();
    expect(() => binders.bindAlliancePopup(null)).not.toThrow();
    expect(() => binders.bindStoragePopup(null)).not.toThrow();
    expect(() => binders.bindLogoutActions(null)).not.toThrow();
    expect(() => binders.bindSpyResourceToggle(null)).not.toThrow();
  });

  it("binds logout through the extracted popup shell without changing the target URL", () => {
    const button = {
      listeners: {},
      addEventListener(type, callback) {
        this.listeners[type] = callback;
      }
    };
    const root = {
      ownerDocument: {
        querySelectorAll(selector) {
          return selector === "[data-nav-logout]" ? [button] : [];
        }
      }
    };
    const clearLegacyState = vi.fn();
    const windowRef = { location: { href: "" } };
    const binders = createRuntimePopupBinders({
      NAV_LOGOUT_SELECTOR: "[data-nav-logout]",
      clearLegacyState,
      getStoredRegistration: () => ({ serverMode: "free" }),
      windowRef
    });

    binders.bindLogoutActions(root);
    button.listeners.click();

    expect(clearLegacyState).toHaveBeenCalledTimes(1);
    expect(windowRef.location.href).toBe("./login.html?mode=free");
  });
});
