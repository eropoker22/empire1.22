// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  describeLobbyMapDistrict,
  normalizeLobbyDistrictZone,
  renderLobbySpawnLegend,
  renderLobbySpawnMap
} from "../../page-assets/js/app/ui/lobbySpawnMapView.js";

const geometry = {
  width: 1600,
  height: 980,
  districts: [{
    id: 7,
    districtType: "park",
    centerX: 100,
    centerY: 100,
    polygon: [
      { x: 20, y: 20 },
      { x: 180, y: 20 },
      { x: 180, y: 180 },
      { x: 20, y: 180 }
    ]
  }]
};

const spawn = {
  districts: [{
    districtId: "district:7",
    zone: "park",
    label: "Neon Park",
    available: false,
    disabledReason: "OWNED"
  }],
  mapDistricts: [{
    districtId: "district:7",
    zone: "park",
    label: "Neon Park",
    status: "claimed",
    owner: {
      playerId: "player:one",
      displayName: "Erik",
      gangName: "Neon Wolves",
      color: "#12ab34"
    },
    reserved: true,
    spawnEligible: true,
    version: 2
  }]
};

describe("live lobby spawn map view", () => {
  beforeEach(() => {
    document.body.innerHTML = '<canvas data-map></canvas><div data-legend></div>';
  });

  it("renders the real map image and an owner-colored authoritative district", () => {
    const canvas = document.querySelector("[data-map]");
    const fills = [];
    const context = createContext(fills);
    canvas.getContext = vi.fn(() => context);

    renderLobbySpawnMap({
      canvas,
      geometry,
      spawn,
      selectedDistrictId: null,
      hoveredDistrictId: null,
      mapImage: { complete: true, naturalWidth: 1600, naturalHeight: 980 }
    });

    expect(context.drawImage).toHaveBeenCalledOnce();
    expect(fills).toContain("rgba(18, 171, 52, 0.42)");
    expect(context.arc).toHaveBeenCalledOnce();
    expect(canvas.getAttribute("aria-label")).toContain("území hráčů: 1");
  });

  it("renders canonical zone counts and explains occupied districts", () => {
    const legend = document.querySelector("[data-legend]");
    renderLobbySpawnLegend(legend, spawn, geometry);

    expect(normalizeLobbyDistrictZone("commercial")).toBe("economy");
    expect(legend.textContent).toContain("PARK");
    expect(legend.textContent).toContain("1");
    expect(describeLobbyMapDistrict(spawn, "district:7")).toBe(
      "Neon Park · PARK · ovládá Neon Wolves"
    );
  });
});

const createContext = (fills) => {
  const context = {
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    shadowBlur: 0,
    shadowColor: "",
    font: "",
    textAlign: "",
    textBaseline: "",
    clearRect: vi.fn(),
    drawImage: vi.fn(),
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(() => fills.push(context.fillStyle)),
    stroke: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    arc: vi.fn(),
    fillText: vi.fn(),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() }))
  };
  return context;
};
