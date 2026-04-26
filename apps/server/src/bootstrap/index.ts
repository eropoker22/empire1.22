import { createServerApp } from "../app";

/**
 * Responsibility: Authoritative server bootstrap entry point.
 * Belongs here: app creation and top-level composition root wiring.
 * Does not belong here: gameplay logic, transport parsing, or admin UI concerns.
 */
export const serverBootstrap = () => createServerApp();
