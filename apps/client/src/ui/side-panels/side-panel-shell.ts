import { escapeAttribute } from "../../shared-ui";

/**
 * Responsibility: Presentation shell for future side panel composition.
 * Belongs here: panel container selection and visibility boundaries.
 * Does not belong here: gameplay logic or transport concerns.
 */
export interface SidePanelShellProps {
  activePanel: string | null;
  contentHtml: string;
}

export const renderSidePanelShell = ({ activePanel, contentHtml }: SidePanelShellProps): string =>
  activePanel
    ? `<aside class="side-panel-shell mobile-sheet" data-panel="${escapeAttribute(activePanel)}"><div class="mobile-sheet__body">${contentHtml}</div></aside>`
    : "<aside class=\"side-panel-shell\" data-panel=\"none\"></aside>";
