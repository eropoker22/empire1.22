export const LOBBY_MAP_IMAGE_PATH = "../img/mapanoc.png";

const ZONE_ORDER = ["downtown", "economy", "industrial", "resident", "park"];

const ZONE_PRESENTATION = Object.freeze({
  downtown: Object.freeze({
    label: "DOWNTOWN",
    fill: "rgba(255, 78, 196, 0.2)",
    stroke: "rgba(255, 128, 220, 0.72)",
    glow: "rgba(255, 78, 196, 0.58)",
    text: "#ffe2f6"
  }),
  economy: Object.freeze({
    label: "COMMERCIAL",
    fill: "rgba(68, 172, 255, 0.24)",
    stroke: "rgba(144, 216, 255, 0.76)",
    glow: "rgba(68, 172, 255, 0.58)",
    text: "#e4f6ff"
  }),
  industrial: Object.freeze({
    label: "INDUSTRIAL",
    fill: "rgba(196, 203, 212, 0.2)",
    stroke: "rgba(221, 227, 234, 0.68)",
    glow: "rgba(196, 203, 212, 0.46)",
    text: "#f3f6fa"
  }),
  resident: Object.freeze({
    label: "RESIDENTIAL",
    fill: "rgba(244, 196, 48, 0.22)",
    stroke: "rgba(255, 226, 128, 0.76)",
    glow: "rgba(244, 196, 48, 0.58)",
    text: "#fff2c6"
  }),
  park: Object.freeze({
    label: "PARK",
    fill: "rgba(75, 214, 126, 0.24)",
    stroke: "rgba(144, 255, 184, 0.76)",
    glow: "rgba(75, 214, 126, 0.56)",
    text: "#e6ffe9"
  })
});

export const normalizeLobbyDistrictZone = (zone) => {
  const normalized = String(zone || "").trim().toLowerCase();
  if (normalized === "commercial") return "economy";
  if (normalized === "residential") return "resident";
  return ZONE_PRESENTATION[normalized] ? normalized : "resident";
};

export const findLobbyMapDistrict = (spawn, districtId) =>
  (spawn?.mapDistricts || []).find((district) => district.districtId === districtId) || null;

export const describeLobbyMapDistrict = (spawn, districtId) => {
  const district = findLobbyMapDistrict(spawn, districtId);
  const option = (spawn?.districts || []).find((entry) => entry.districtId === districtId);
  if (!district && !option) return "Vyber jeden serverem povolený district";
  const zone = ZONE_PRESENTATION[normalizeLobbyDistrictZone(district?.zone ?? option?.zone)];
  const label = district?.label ?? option?.label ?? districtId;
  if (district?.owner) {
    const owner = district.owner.gangName || district.owner.displayName || "Obsazeno";
    return `${label} · ${zone.label} · ovládá ${owner}`;
  }
  if (district?.reserved) return `${label} · ${zone.label} · rezervováno jiným hráčem`;
  if (district?.status === "destroyed") return `${label} · ${zone.label} · district je zničený`;
  if (option?.available) return `${label} · ${zone.label} · volný startovní district`;
  return `${label} · ${zone.label} · není dostupný pro start`;
};

export const renderLobbySpawnLegend = (container, spawn, geometry) => {
  if (!(container instanceof HTMLElement)) return;
  const districts = createMapDistrictModel(spawn, geometry);
  const counts = new Map(ZONE_ORDER.map((zone) => [zone, 0]));
  for (const district of districts) {
    counts.set(district.zone, Number(counts.get(district.zone) || 0) + 1);
  }
  container.innerHTML = ZONE_ORDER.map((zone) => {
    const presentation = ZONE_PRESENTATION[zone];
    return `<span class="server-detail-modal__type-count is-${zone}">
      <strong>${presentation.label}</strong>
      <b>${counts.get(zone) || 0}</b>
    </span>`;
  }).join("");
};

export const renderLobbySpawnMap = ({
  canvas,
  geometry,
  spawn,
  selectedDistrictId,
  hoveredDistrictId,
  mapImage
}) => {
  if (!(canvas instanceof HTMLCanvasElement)) return;
  const width = Number(geometry?.width || 1600);
  const height = Number(geometry?.height || 980);
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return;

  context.clearRect(0, 0, width, height);
  drawMapBackground(context, mapImage, width, height);
  const districts = createMapDistrictModel(spawn, geometry);
  for (const district of districts) {
    drawDistrict(context, district, {
      selected: district.districtId === selectedDistrictId,
      hovered: district.districtId === hoveredDistrictId
    });
  }

  const occupiedCount = districts.filter((district) => district.owner).length;
  canvas.setAttribute(
    "aria-label",
    `Mapa serveru: ${districts.length} districtů, území hráčů: ${occupiedCount}`
  );
};

const createMapDistrictModel = (spawn, geometry) => {
  const mapDistricts = new Map((spawn?.mapDistricts || []).map((district) => [district.districtId, district]));
  const options = new Map((spawn?.districts || []).map((district) => [district.districtId, district]));
  return (geometry?.districts || []).map((geometryDistrict) => {
    const districtId = `district:${geometryDistrict.id}`;
    const authoritative = mapDistricts.get(districtId);
    const option = options.get(districtId);
    return {
      districtId,
      geometry: geometryDistrict,
      label: authoritative?.label ?? option?.label ?? `District ${geometryDistrict.id}`,
      zone: normalizeLobbyDistrictZone(authoritative?.zone ?? option?.zone ?? geometryDistrict.districtType),
      status: authoritative?.status ?? (option?.available ? "neutral" : "unavailable"),
      owner: authoritative?.owner ?? null,
      reserved: Boolean(authoritative?.reserved || option?.disabledReason === "RESERVED"),
      spawnEligible: Boolean(authoritative?.spawnEligible ?? option),
      available: Boolean(option?.available)
    };
  });
};

const drawMapBackground = (context, image, width, height) => {
  if (image?.complete && Number(image.naturalWidth) > 0 && Number(image.naturalHeight) > 0) {
    const imageRatio = image.naturalWidth / image.naturalHeight;
    const canvasRatio = width / height;
    const drawWidth = imageRatio > canvasRatio ? height * imageRatio : width;
    const drawHeight = imageRatio > canvasRatio ? height : width / imageRatio;
    context.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
  } else {
    const gradient = context.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "#07111e");
    gradient.addColorStop(0.5, "#0c1b2f");
    gradient.addColorStop(1, "#050911");
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
  }
  context.fillStyle = "rgba(2, 6, 16, 0.42)";
  context.fillRect(0, 0, width, height);
};

const drawDistrict = (context, district, state) => {
  const presentation = ZONE_PRESENTATION[district.zone];
  const ownerColor = normalizeOwnerColor(district.owner?.color);
  drawPolygon(context, district.geometry.polygon);
  context.fillStyle = state.selected
    ? "rgba(255, 43, 214, 0.46)"
    : ownerColor
      ? colorWithAlpha(ownerColor, 0.42)
      : district.reserved
        ? "rgba(251, 146, 60, 0.28)"
        : presentation.fill;
  context.fill();

  drawPolygon(context, district.geometry.polygon);
  context.strokeStyle = state.selected
    ? "#ff2bd6"
    : state.hovered
      ? presentation.text
      : ownerColor
        ? ownerColor
        : district.reserved
          ? "#fb923c"
          : district.available
            ? "rgba(245, 250, 255, 0.86)"
            : presentation.stroke;
  context.lineWidth = state.selected ? 5 : state.hovered ? 3.5 : ownerColor ? 2.5 : district.available ? 2 : 1.1;
  context.shadowBlur = state.selected || state.hovered ? 18 : ownerColor ? 8 : 0;
  context.shadowColor = state.selected ? "rgba(255, 43, 214, 0.72)" : state.hovered ? presentation.glow : ownerColor || "transparent";
  context.stroke();
  context.shadowBlur = 0;

  if (ownerColor) drawOwnerMarker(context, district.geometry, ownerColor);
  if (state.selected || state.hovered) drawDistrictLabel(context, district, presentation, state.selected);
};

const drawPolygon = (context, polygon) => {
  if (!Array.isArray(polygon) || polygon.length < 3) return;
  context.beginPath();
  context.moveTo(polygon[0].x, polygon[0].y);
  for (let index = 1; index < polygon.length; index += 1) {
    context.lineTo(polygon[index].x, polygon[index].y);
  }
  context.closePath();
};

const drawOwnerMarker = (context, geometryDistrict, color) => {
  context.save();
  context.beginPath();
  context.arc(geometryDistrict.centerX, geometryDistrict.centerY, 6, 0, Math.PI * 2);
  context.fillStyle = color;
  context.shadowBlur = 12;
  context.shadowColor = color;
  context.fill();
  context.restore();
};

const drawDistrictLabel = (context, district, presentation, selected) => {
  context.save();
  context.font = "700 18px Bahnschrift, Segoe UI, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = presentation.text;
  context.shadowBlur = selected ? 18 : 12;
  context.shadowColor = selected ? "rgba(255, 43, 214, 0.72)" : presentation.glow;
  context.fillText(`D${district.geometry.id}`, district.geometry.centerX, district.geometry.centerY);
  context.restore();
};

const normalizeOwnerColor = (value) => /^#[0-9a-f]{6}$/iu.test(String(value || "")) ? String(value) : null;

const colorWithAlpha = (color, alpha) => {
  const red = Number.parseInt(color.slice(1, 3), 16);
  const green = Number.parseInt(color.slice(3, 5), 16);
  const blue = Number.parseInt(color.slice(5, 7), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
};
