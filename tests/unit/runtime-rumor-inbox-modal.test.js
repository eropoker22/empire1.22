// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { openRumorInboxModal } from "../../page-assets/js/app/ui/rumorInboxModal.js";

afterEach(() => {
  document.querySelector("[data-rumor-inbox]")?.remove();
  document.body.className = "";
  document.documentElement.className = "";
});

describe("street rumor inbox modal", () => {
  it("shows the count, enables scrolling after eight entries, deletes rumors and closes from both controls", () => {
    const rumors = Array.from({ length: 9 }, (_, index) => ({
      id: `rumor:${index + 1}`,
      timeLabel: "TEĎ",
      resultPayload: {
        rows: [
          { label: "District", value: `District ${index + 1}` },
          { label: "Drb", value: `Drb číslo ${index + 1}` }
        ]
      }
    }));

    const deleted = [];
    expect(openRumorInboxModal({
      documentRef: document,
      rumors,
      onDeleteRumor: (entry, remaining) => {
        deleted.push(entry.id);
        return remaining;
      },
      onDeleteAll: (entries) => {
        deleted.push(...entries.map((entry) => entry.id));
        return [];
      }
    })).toBe(true);
    const shell = document.querySelector("[data-rumor-inbox]");
    expect(shell).not.toBeNull();
    const list = shell.querySelector("[data-rumor-inbox-list]");

    expect(shell.hidden).toBe(false);
    expect(shell.querySelector("[data-rumor-inbox-count]").textContent).toBe("9");
    expect(list.dataset.rumorScrollable).toBe("true");
    expect(list.querySelectorAll(".rumor-inbox-message")).toHaveLength(9);
    expect(list.textContent).toContain("District 1");
    expect(list.textContent).toContain("Drb číslo 1");
    shell.querySelector("[data-rumor-delete-id='rumor:1']").click();
    expect(deleted).toEqual(["rumor:1"]);
    expect(list.querySelectorAll(".rumor-inbox-message")).toHaveLength(8);
    shell.querySelector(".rumor-inbox-delete-all").click();
    expect(deleted).toHaveLength(9);
    expect(list.hidden).toBe(true);

    shell.querySelector(".rumor-inbox-close").click();
    expect(shell.hidden).toBe(true);

    expect(openRumorInboxModal({ documentRef: document, rumors })).toBe(true);
    shell.querySelector(".rumor-inbox-backdrop").click();
    expect(shell.hidden).toBe(true);
  });
});
