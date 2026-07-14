function toNonNegativeInteger(value, fallback = 0) {
  const normalized = Math.floor(Number(value));
  return Number.isFinite(normalized) ? Math.max(0, normalized) : Math.max(0, fallback);
}

function toPositiveInteger(value, fallback = 1) {
  return Math.max(1, toNonNegativeInteger(value, fallback));
}

function normalizeInputs(inputs = {}) {
  return Object.fromEntries(Object.entries(inputs || {}).map(([resourceKey, amount]) => [
    resourceKey,
    toNonNegativeInteger(amount)
  ]));
}

function createReservationUnit(cleanMoney = 0, inputs = {}) {
  return {
    cleanMoney: toNonNegativeInteger(cleanMoney),
    inputs: normalizeInputs(inputs)
  };
}

function buildLegacyReservationUnits(job, queuedAmount) {
  if (queuedAmount <= 0) return [];
  const cleanTotal = toNonNegativeInteger(job?.cleanMoneyCost);
  const inputTotals = normalizeInputs(job?.inputs);
  return Array.from({ length: queuedAmount }, (_, index) => createReservationUnit(
    Math.floor(cleanTotal / queuedAmount) + (index < cleanTotal % queuedAmount ? 1 : 0),
    Object.fromEntries(Object.entries(inputTotals).map(([resourceKey, amount]) => [
      resourceKey,
      Math.floor(amount / queuedAmount) + (index < amount % queuedAmount ? 1 : 0)
    ]))
  ));
}

function sumReservationUnits(units = []) {
  const inputs = {};
  let cleanMoney = 0;
  for (const unit of units) {
    cleanMoney += toNonNegativeInteger(unit?.cleanMoney);
    for (const [resourceKey, amount] of Object.entries(unit?.inputs || {})) {
      inputs[resourceKey] = toNonNegativeInteger(inputs[resourceKey]) + toNonNegativeInteger(amount);
    }
  }
  return { cleanMoney, inputs };
}

function resolveStatus(job) {
  if (job.queuedAmount > 0 && job.isProducing) return "running";
  if (job.queuedAmount > 0) return "waiting";
  if (job.producedAmount > 0) return "ready";
  return "idle";
}

function toPositiveMultiplier(value, fallback = 1) {
  const normalized = Number(value);
  return Number.isFinite(normalized) && normalized > 0 ? normalized : fallback;
}

function toOptionalTimestamp(value) {
  if (value === null || value === undefined || value === "") return null;
  const normalized = Number(value);
  return Number.isFinite(normalized) ? Math.max(0, normalized) : null;
}

function projectReadyAtMs(now, workRemainingMs, speedMultiplier, speedExpiresAtMs) {
  const work = Math.max(0, Number(workRemainingMs || 0));
  const speed = toPositiveMultiplier(speedMultiplier, 1);
  const expiresAt = toOptionalTimestamp(speedExpiresAtMs);
  if (work <= 0) return now;
  if (speed <= 1 || expiresAt === null || expiresAt <= now) {
    return now + work;
  }
  const boostedWindowMs = expiresAt - now;
  const boostedWork = boostedWindowMs * speed;
  return work <= boostedWork
    ? now + work / speed
    : expiresAt + (work - boostedWork);
}

export function normalizeLocalProductionJob(rawJob = null, defaults = {}) {
  if (!rawJob) return null;
  const durationMs = toPositiveInteger(rawJob.unitDurationMs ?? defaults.unitDurationMs ?? rawJob.durationMs, 1000);
  const localOutputCap = toPositiveInteger(rawJob.localOutputCap ?? defaults.localOutputCap, 1);
  const queueCapacity = toPositiveInteger(rawJob.queueCapacity ?? defaults.queueCapacity, 1);
  const isModern = Number(rawJob.version || 0) >= 2
    || Object.prototype.hasOwnProperty.call(rawJob, "queuedAmount")
    || Object.prototype.hasOwnProperty.call(rawJob, "producedAmount");
  const legacyQuantity = toNonNegativeInteger(rawJob.quantity ?? rawJob.output?.amount, rawJob.status === "ready" ? 0 : 1);
  const queuedAmount = isModern
    ? toNonNegativeInteger(rawJob.queuedAmount)
    : rawJob.status === "ready" ? 0 : legacyQuantity;
  const producedAmount = isModern
    ? toNonNegativeInteger(rawJob.producedAmount)
    : rawJob.status === "ready" ? toNonNegativeInteger(rawJob.output?.amount, 1) : 0;
  const sourceReservations = Array.isArray(rawJob.reservationUnits)
    ? rawJob.reservationUnits.slice(0, queuedAmount).map((unit) => createReservationUnit(unit?.cleanMoney, unit?.inputs))
    : buildLegacyReservationUnits(rawJob, queuedAmount);
  while (sourceReservations.length < queuedAmount) {
    sourceReservations.push(createReservationUnit(defaults.unitCleanMoneyCost, defaults.unitInputs));
  }
  const reservationTotals = sumReservationUnits(sourceReservations);
  const readyAtMs = Number.isFinite(Number(rawJob.readyAtMs))
    ? Number(rawJob.readyAtMs)
    : new Date(rawJob.readyAt || 0).getTime();
  const capHasSpace = producedAmount < localOutputCap;
  const isProducing = queuedAmount > 0
    && capHasSpace
    && rawJob.status !== "waiting"
    && rawJob.isProducing !== false;
  const productionSpeedMultiplier = toPositiveMultiplier(rawJob.productionSpeedMultiplier, 1);
  const productionSpeedExpiresAtMs = toOptionalTimestamp(rawJob.productionSpeedExpiresAtMs);
  const activeWorkRemainingMs = isProducing
    ? Math.max(1, Number(rawJob.activeWorkRemainingMs || durationMs))
    : null;
  const lastProgressAtMs = isProducing
    ? Number.isFinite(Number(rawJob.lastProgressAtMs))
      ? Number(rawJob.lastProgressAtMs)
      : Number.isFinite(readyAtMs)
        ? readyAtMs - durationMs / productionSpeedMultiplier
        : Date.now()
    : null;
  const projectedReadyAtMs = isProducing
    ? projectReadyAtMs(
        lastProgressAtMs,
        activeWorkRemainingMs,
        productionSpeedMultiplier,
        productionSpeedExpiresAtMs
      )
    : null;
  const normalized = {
    ...rawJob,
    version: 2,
    queuedAmount,
    producedAmount,
    quantity: queuedAmount,
    unitDurationMs: durationMs,
    durationMs,
    localOutputCap,
    queueCapacity,
    reservationUnits: sourceReservations,
    inputs: reservationTotals.inputs,
    cleanMoneyCost: reservationTotals.cleanMoney,
    isProducing,
    productionSpeedMultiplier,
    productionSpeedExpiresAtMs,
    activeWorkRemainingMs,
    lastProgressAtMs,
    readyAtMs: projectedReadyAtMs,
    output: {
      ...(defaults.output || {}),
      ...(rawJob.output || {}),
      amount: producedAmount
    }
  };
  normalized.status = resolveStatus(normalized);
  normalized.readyAt = normalized.readyAtMs ? new Date(normalized.readyAtMs).toISOString() : null;
  return normalized;
}

export function queueLocalProduction(job, order = {}) {
  const quantity = toPositiveInteger(order.quantity, 1);
  const now = Number.isFinite(Number(order.now)) ? Number(order.now) : Date.now();
  const current = normalizeLocalProductionJob(job, order) || normalizeLocalProductionJob({
    version: 2,
    queuedAmount: 0,
    producedAmount: 0,
    output: order.output
  }, order);
  if (current.producedAmount >= current.localOutputCap) {
    return { ok: false, reason: "output_full", job: current };
  }
  if (quantity > Math.max(0, current.queueCapacity - current.queuedAmount)) {
    return { ok: false, reason: "queue_full", job: current };
  }
  const reservation = createReservationUnit(order.unitCleanMoneyCost, order.unitInputs);
  const reservationUnits = [
    ...current.reservationUnits,
    ...Array.from({ length: quantity }, () => createReservationUnit(reservation.cleanMoney, reservation.inputs))
  ];
  const totals = sumReservationUnits(reservationUnits);
  const startsNow = !current.isProducing && current.queuedAmount === 0;
  const productionSpeedMultiplier = startsNow
    ? toPositiveMultiplier(order.productionSpeedMultiplier, 1)
    : current.productionSpeedMultiplier;
  const productionSpeedExpiresAtMs = startsNow
    ? toOptionalTimestamp(order.productionSpeedExpiresAtMs)
    : current.productionSpeedExpiresAtMs;
  const activeWorkRemainingMs = startsNow ? current.unitDurationMs : current.activeWorkRemainingMs;
  const next = {
    ...current,
    queuedAmount: current.queuedAmount + quantity,
    quantity: current.queuedAmount + quantity,
    reservationUnits,
    inputs: totals.inputs,
    cleanMoneyCost: totals.cleanMoney,
    isProducing: current.isProducing || startsNow,
    productionSpeedMultiplier,
    productionSpeedExpiresAtMs,
    activeWorkRemainingMs,
    lastProgressAtMs: startsNow ? now : current.lastProgressAtMs,
    readyAtMs: current.isProducing
      ? current.readyAtMs
      : projectReadyAtMs(now, activeWorkRemainingMs, productionSpeedMultiplier, productionSpeedExpiresAtMs)
  };
  next.status = resolveStatus(next);
  next.readyAt = next.readyAtMs ? new Date(next.readyAtMs).toISOString() : null;
  return { ok: true, job: next };
}

export function advanceLocalProductionJob(job, now = Date.now()) {
  const current = normalizeLocalProductionJob(job);
  if (!current || !current.isProducing || !current.readyAtMs) {
    return { changed: false, completedAmount: 0, job: current };
  }
  const nowMs = Number.isFinite(Number(now)) ? Number(now) : Date.now();
  const storedProgressAtMs = Number(current.lastProgressAtMs);
  let cursor = Math.min(nowMs, Number.isFinite(storedProgressAtMs) ? storedProgressAtMs : nowMs);
  let workRemainingMs = Math.max(1, Number(current.activeWorkRemainingMs || current.unitDurationMs));
  let speedMultiplier = toPositiveMultiplier(current.productionSpeedMultiplier, 1);
  let speedExpiresAtMs = toOptionalTimestamp(current.productionSpeedExpiresAtMs);
  let queuedAmount = current.queuedAmount;
  let producedAmount = current.producedAmount;
  let completedAmount = 0;

  while (cursor < nowMs && queuedAmount > 0 && producedAmount < current.localOutputCap) {
    if (speedExpiresAtMs !== null && cursor >= speedExpiresAtMs) {
      speedMultiplier = 1;
      speedExpiresAtMs = null;
    }
    const segmentEnd = speedExpiresAtMs !== null && speedExpiresAtMs > cursor
      ? Math.min(nowMs, speedExpiresAtMs)
      : nowMs;
    const availableWorkMs = Math.max(0, segmentEnd - cursor) * speedMultiplier;
    if (availableWorkMs + Number.EPSILON < workRemainingMs) {
      workRemainingMs -= availableWorkMs;
      cursor = segmentEnd;
      continue;
    }
    cursor += workRemainingMs / speedMultiplier;
    queuedAmount -= 1;
    producedAmount += 1;
    completedAmount += 1;
    if (queuedAmount <= 0 || producedAmount >= current.localOutputCap) {
      workRemainingMs = 0;
      break;
    }
    workRemainingMs = current.unitDurationMs;
  }

  const reservationUnits = current.reservationUnits.slice(completedAmount);
  const totals = sumReservationUnits(reservationUnits);
  const canContinue = queuedAmount > 0 && producedAmount < current.localOutputCap;
  if (speedExpiresAtMs !== null && nowMs >= speedExpiresAtMs) {
    speedMultiplier = 1;
    speedExpiresAtMs = null;
  }
  const nextReadyAtMs = canContinue
    ? projectReadyAtMs(nowMs, workRemainingMs, speedMultiplier, speedExpiresAtMs)
    : null;
  const next = {
    ...current,
    queuedAmount,
    producedAmount,
    quantity: queuedAmount,
    reservationUnits,
    inputs: totals.inputs,
    cleanMoneyCost: totals.cleanMoney,
    isProducing: canContinue,
    productionSpeedMultiplier: speedMultiplier,
    productionSpeedExpiresAtMs: speedExpiresAtMs,
    activeWorkRemainingMs: canContinue ? workRemainingMs : null,
    lastProgressAtMs: canContinue ? nowMs : null,
    readyAtMs: nextReadyAtMs,
    readyAt: nextReadyAtMs ? new Date(nextReadyAtMs).toISOString() : null,
    output: { ...current.output, amount: producedAmount }
  };
  next.status = resolveStatus(next);
  const changed = completedAmount > 0
    || next.readyAtMs !== current.readyAtMs
    || next.productionSpeedMultiplier !== current.productionSpeedMultiplier
    || next.productionSpeedExpiresAtMs !== current.productionSpeedExpiresAtMs;
  return { changed, completedAmount, job: next };
}

export function setLocalProductionSpeedMultiplier(
  job,
  productionSpeedMultiplier,
  now = Date.now(),
  productionSpeedExpiresAtMs = null
) {
  const advanced = advanceLocalProductionJob(job, now);
  const current = advanced.job;
  if (!current?.isProducing) return { ...advanced, job: current };
  const speedMultiplier = toPositiveMultiplier(productionSpeedMultiplier, 1);
  const expiresAtMs = toOptionalTimestamp(productionSpeedExpiresAtMs);
  const next = {
    ...current,
    productionSpeedMultiplier: speedMultiplier,
    productionSpeedExpiresAtMs: expiresAtMs,
    lastProgressAtMs: Number(now),
    readyAtMs: projectReadyAtMs(
      Number(now),
      current.activeWorkRemainingMs,
      speedMultiplier,
      expiresAtMs
    )
  };
  next.readyAt = new Date(next.readyAtMs).toISOString();
  return { changed: true, completedAmount: advanced.completedAmount, job: next };
}

export function cancelWaitingLocalProduction(job) {
  const current = normalizeLocalProductionJob(job);
  if (!current) return { ok: false, reason: "empty", job: current, refund: createReservationUnit() };
  const activeAmount = current.isProducing && current.queuedAmount > 0 ? 1 : 0;
  const waitingAmount = Math.max(0, current.queuedAmount - activeAmount);
  if (waitingAmount <= 0) {
    return { ok: false, reason: "no_waiting", job: current, refund: createReservationUnit() };
  }
  const keptReservations = current.reservationUnits.slice(0, activeAmount);
  const refundedReservations = current.reservationUnits.slice(activeAmount);
  const keptTotals = sumReservationUnits(keptReservations);
  const refund = sumReservationUnits(refundedReservations);
  const next = {
    ...current,
    queuedAmount: activeAmount,
    quantity: activeAmount,
    reservationUnits: keptReservations,
    inputs: keptTotals.inputs,
    cleanMoneyCost: keptTotals.cleanMoney,
    isProducing: activeAmount > 0,
    readyAtMs: activeAmount > 0 ? current.readyAtMs : null,
    readyAt: activeAmount > 0 && current.readyAtMs ? new Date(current.readyAtMs).toISOString() : null
  };
  next.status = resolveStatus(next);
  return { ok: true, waitingAmount, refund, job: next };
}

export function collectLocalProduction(job, receivableAmount, now = Date.now(), options = {}) {
  const current = normalizeLocalProductionJob(job);
  if (!current) return { collectedAmount: 0, remainingAmount: 0, job: current };
  const collectedAmount = Math.min(current.producedAmount, toNonNegativeInteger(receivableAmount));
  const producedAmount = current.producedAmount - collectedAmount;
  const shouldResume = current.queuedAmount > 0 && producedAmount < current.localOutputCap && !current.isProducing;
  const speedMultiplier = shouldResume
    ? toPositiveMultiplier(options.productionSpeedMultiplier, 1)
    : current.productionSpeedMultiplier;
  const speedExpiresAtMs = shouldResume && Number.isFinite(Number(options.productionSpeedExpiresAtMs))
    ? Number(options.productionSpeedExpiresAtMs)
    : current.productionSpeedExpiresAtMs;
  const next = {
    ...current,
    producedAmount,
    isProducing: current.isProducing || shouldResume,
    productionSpeedMultiplier: speedMultiplier,
    productionSpeedExpiresAtMs: speedExpiresAtMs,
    activeWorkRemainingMs: shouldResume ? current.unitDurationMs : current.activeWorkRemainingMs,
    lastProgressAtMs: shouldResume ? now : current.lastProgressAtMs,
    readyAtMs: shouldResume
      ? projectReadyAtMs(now, current.unitDurationMs, speedMultiplier, speedExpiresAtMs)
      : current.readyAtMs,
    output: { ...current.output, amount: producedAmount }
  };
  next.readyAt = next.readyAtMs ? new Date(next.readyAtMs).toISOString() : null;
  next.status = resolveStatus(next);
  return { collectedAmount, remainingAmount: producedAmount, job: next };
}
