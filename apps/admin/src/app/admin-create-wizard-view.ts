import { FREE_HOSTED_SERVER_LIFECYCLE_POLICY, resolveModeConfig } from "@empire/game-config";

const freeConfig = resolveModeConfig("free");
const minimumCapacity = FREE_HOSTED_SERVER_LIFECYCLE_POLICY.minimumReadyPlayersToStart;
const maximumCapacity = freeConfig.balance.maxPlayersPerServer;
const registrationMinutes = FREE_HOSTED_SERVER_LIFECYCLE_POLICY.registrationWindowMs / 60_000;

export const renderAdminCreateWizard = (step: number): string => `
  <form class="admin-wizard" data-admin-create-form>
    <div class="admin-wizard__steps" aria-label="Kroky vytvoření serveru">
      ${["Základ", "Mapa", "Přístup", "Kontrola"].map((label, index) => `<span class="${step === index + 1 ? "is-active" : ""}">${index + 1}. ${label}</span>`).join("")}
    </div>
    <fieldset data-admin-wizard-panel="1" ${step === 1 ? "" : "hidden"}>
      <legend>Základ</legend>
      <label><span>Název</span><input name="displayName" minlength="3" maxlength="80" required></label>
      <label><span>Mode</span><select name="mode"><option value="free">Free</option><option value="war" disabled>War (připravuje se)</option></select></label>
      <label><span>Region</span><select name="region"><option value="eu-central">EU Central</option></select></label>
      <label class="admin-template-selector"><span>Bezpečná Free šablona</span><select name="serverTemplate" data-admin-server-template>
        <option value="control">Kontrolní test · 2–20 hráčů · bez Očisty</option>
        <option value="full">Plnohodnotný server · 20 hráčů · canonical Očista</option>
      </select><small>Šablona určuje serverová lifecycle pravidla. Browser neposílá raw balance ani nastavení Očisty.</small></label>
      <label><span>Kapacita</span><input name="capacity" data-admin-server-capacity type="number" min="${minimumCapacity}" max="${maximumCapacity}" value="${minimumCapacity}" required></label>
      <button class="admin-button admin-button--primary" type="button" data-admin-wizard-next>Další</button>
    </fieldset>
    <fieldset data-admin-wizard-panel="2" ${step === 2 ? "" : "hidden"}>
      <legend>Mapa</legend><div class="admin-map-counts">
        <label><span>Downtown</span><input value="8" disabled></label>
        <label><span>Commercial</span><input name="commercial" data-admin-map-count type="number" min="0" value="40" required></label>
        <label><span>Residential</span><input name="residential" data-admin-map-count type="number" min="0" value="38" required></label>
        <label><span>Industrial</span><input name="industrial" data-admin-map-count type="number" min="0" value="38" required></label>
        <label><span>Park</span><input name="park" data-admin-map-count type="number" min="0" value="37" required></label>
      </div><p>Celkem: <output data-admin-map-total>161</output> / 161</p>
      <button class="admin-button" type="button" data-admin-wizard-back>Zpět</button>
      <button class="admin-button admin-button--primary" type="button" data-admin-wizard-next>Další</button>
    </fieldset>
    <fieldset data-admin-wizard-panel="3" ${step === 3 ? "" : "hidden"}>
      <legend>Přístup</legend><input type="hidden" name="joinPolicy" value="closed">
      <div class="admin-kv-grid admin-wizard__policy">
        ${kv("Kapacita", "Kontrolní 2–20 / plná 20")}
        ${kv("Minimum ke spuštění", minimumCapacity)}
        ${kv("Registrační okno", `${registrationMinutes} minut`)}
      </div>
      <p class="admin-notice">Kontrolní šablona je pro malý setup bez Očisty. Plnohodnotná šablona drží canonical kapacitu 20 a standardní Očistu. Server vznikne se zavřeným vstupem.</p>
      <button class="admin-button" type="button" data-admin-wizard-back>Zpět</button>
      <button class="admin-button admin-button--primary" type="button" data-admin-wizard-next>Další</button>
    </fieldset>
    <fieldset data-admin-wizard-panel="4" ${step === 4 ? "" : "hidden"}>
      <legend>Kontrola</legend><div class="admin-kv-grid" data-admin-create-review></div>
      <p class="admin-notice">Server vznikne jako REQUESTED a joins zůstanou zavřené do dokončení provisioningu.</p>
      <button class="admin-button" type="button" data-admin-wizard-back>Zpět</button>
      <button class="admin-button admin-button--primary" type="submit">Create Server</button>
    </fieldset>
    <button class="admin-button" type="button" data-admin-create-cancel>Zrušit</button>
    <p data-admin-create-error role="alert"></p>
  </form>`;

const kv = (label: string, value: unknown): string =>
  `<span><small>${escape(label)}</small><strong>${escape(value)}</strong></span>`;
const escape = (value: unknown): string => String(value).replace(/[&<>"']/gu, (char) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[char]!);
