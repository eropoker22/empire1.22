import {
  FREE_HOSTED_SERVER_LIFECYCLE_POLICY,
  FREE_HOSTED_STARTING_MATERIAL_GROUPS,
  FREE_HOSTED_STARTING_PLAYER_STATE,
  resolveModeConfig
} from "@empire/game-config";

const freeConfig = resolveModeConfig("free");
const minimumCapacity = FREE_HOSTED_SERVER_LIFECYCLE_POLICY.minimumReadyPlayersToStart;
const maximumCapacity = freeConfig.balance.maxPlayersPerServer;
const registrationMinutes = FREE_HOSTED_SERVER_LIFECYCLE_POLICY.registrationWindowMs / 60_000;

export const renderAdminCreateWizard = (step: number): string => `
  <div class="admin-modal-backdrop" data-admin-create-backdrop>
    <section class="admin-modal" role="dialog" aria-modal="true" aria-labelledby="admin-create-title">
      <header class="admin-modal__head"><div><span>Provisioning</span><h2 id="admin-create-title">Vytvořit nový server</h2>
        <p>Bezpečný pětikrokový workflow s canonical Free pravidly.</p></div>
        <button class="admin-button admin-button--ghost admin-button--close" type="button" data-admin-create-cancel aria-label="Zavřít dialog">×</button>
      </header>
      <form class="admin-wizard" data-admin-create-form>
        <div class="admin-wizard__steps" aria-label="Kroky vytvoření serveru">
          ${["Základ", "Mapa", "Start hráče", "Přístup", "Kontrola"].map((label, index) => `<span class="${step === index + 1 ? "is-active" : ""}"><b>${index + 1}</b>${label}</span>`).join("")}
        </div>
        <fieldset data-admin-wizard-panel="1" ${step === 1 ? "" : "hidden"}>
          <legend>Základ serveru</legend>
          <label><span>Název</span><input name="displayName" minlength="3" maxlength="80" required></label>
          <label><span>Mode</span><select name="mode"><option value="free">Free</option><option value="war" disabled>War (připravuje se)</option></select></label>
          <label><span>Region</span><select name="region"><option value="eu-central">EU Central</option></select></label>
          <label class="admin-template-selector"><span>Bezpečná Free šablona</span><select name="serverTemplate" data-admin-server-template>
            <option value="control">Flexibilní server · 1–20 hráčů · Očista po Startu</option>
            <option value="full">Plnohodnotný server · 20 hráčů · canonical Očista</option>
          </select><small>Šablona určuje serverová lifecycle pravidla. Browser neposílá raw balance ani nastavení Očisty.</small></label>
          <label><span>Kapacita</span><input name="capacity" data-admin-server-capacity type="number" min="${minimumCapacity}" max="${maximumCapacity}" value="${minimumCapacity}" required></label>
          <div class="admin-wizard__actions"><button class="admin-button admin-button--primary" type="button" data-admin-wizard-next>Pokračovat</button></div>
        </fieldset>
        <fieldset data-admin-wizard-panel="2" ${step === 2 ? "" : "hidden"}>
          <legend>Složení mapy</legend><div class="admin-map-counts">
            <label><span>Downtown</span><input value="8" disabled></label>
            <label><span>Commercial</span><input name="commercial" data-admin-map-count type="number" min="0" value="40" required></label>
            <label><span>Residential</span><input name="residential" data-admin-map-count type="number" min="0" value="38" required></label>
            <label><span>Industrial</span><input name="industrial" data-admin-map-count type="number" min="0" value="38" required></label>
            <label><span>Park</span><input name="park" data-admin-map-count type="number" min="0" value="37" required></label>
          </div><p class="admin-wizard__total">Celkem <output data-admin-map-total>161</output> / 161 districtů</p>
          <div class="admin-wizard__actions"><button class="admin-button" type="button" data-admin-wizard-back>Zpět</button>
            <button class="admin-button admin-button--primary" type="button" data-admin-wizard-next>Pokračovat</button></div>
        </fieldset>
        <fieldset data-admin-wizard-panel="3" ${step === 3 ? "" : "hidden"}>
          <legend>Počáteční stav každého hráče</legend>
          <div class="admin-starting-state">
            ${numberField("Clean cash", "startingCleanCash", FREE_HOSTED_STARTING_PLAYER_STATE.cleanCash, 1_000_000_000)}
            ${numberField("Dirty cash", "startingDirtyCash", FREE_HOSTED_STARTING_PLAYER_STATE.dirtyCash, 1_000_000_000)}
            ${numberField("Populace", "startingPopulation", FREE_HOSTED_STARTING_PLAYER_STATE.population, 1_000_000)}
            ${numberField("Vliv", "startingInfluence", FREE_HOSTED_STARTING_PLAYER_STATE.influence, 1_000_000)}
            <label><span>Špehové</span><input value="2" type="number" disabled><small>Každý hráč má vždy přesně 2 špionážní sloty.</small></label>
          </div>
          <div class="admin-starting-materials">
            ${FREE_HOSTED_STARTING_MATERIAL_GROUPS.map((group) => `
              <section class="admin-starting-material-group">
                <h3>${escape(group.label)}</h3>
                <div>${group.materials.map((material) => numberField(
                  material.label,
                  `startingMaterial:${material.id}`,
                  FREE_HOSTED_STARTING_PLAYER_STATE.materials[material.id],
                  1_000_000
                )).join("")}</div>
              </section>`).join("")}
          </div>
          <p class="admin-notice">Hodnoty se uloží k serveru a worker je použije při autoritativním vytvoření každého nového hráče.</p>
          <div class="admin-wizard__actions"><button class="admin-button" type="button" data-admin-wizard-back>Zpět</button>
            <button class="admin-button admin-button--primary" type="button" data-admin-wizard-next>Pokračovat</button></div>
        </fieldset>
        <fieldset data-admin-wizard-panel="4" ${step === 4 ? "" : "hidden"}>
          <legend>Přístup a registrace</legend><input type="hidden" name="joinPolicy" value="closed">
          <div class="admin-kv-grid admin-wizard__policy">
            ${kv("Kapacita", "Kontrolní 2–20 / plná 20")}
            ${kv("Minimum ke spuštění", minimumCapacity)}
            ${kv("Registrační okno", `${registrationMinutes} minut`)}
          </div>
          <p class="admin-notice">Obě šablony spustí osmihodinovou Očistu až po kliknutí na Start. Flexibilní server dovoluje menší kapacitu, plnohodnotná šablona drží canonical kapacitu 20. Server vznikne se zavřeným vstupem.</p>
          <div class="admin-wizard__actions"><button class="admin-button" type="button" data-admin-wizard-back>Zpět</button>
            <button class="admin-button admin-button--primary" type="button" data-admin-wizard-next>Pokračovat</button></div>
        </fieldset>
        <fieldset data-admin-wizard-panel="5" ${step === 5 ? "" : "hidden"}>
          <legend>Kontrola před vytvořením</legend><div class="admin-kv-grid" data-admin-create-review></div>
          <p class="admin-notice">Server vznikne jako REQUESTED a joins zůstanou zavřené do dokončení provisioningu.</p>
          <div class="admin-wizard__actions"><button class="admin-button" type="button" data-admin-wizard-back>Zpět</button>
            <button class="admin-button admin-button--primary" type="submit">Vytvořit server</button></div>
        </fieldset>
        <p class="admin-form-error" data-admin-create-error role="alert"></p>
      </form>
    </section>
  </div>`;

const kv = (label: string, value: unknown): string =>
  `<span><small>${escape(label)}</small><strong>${escape(value)}</strong></span>`;
const numberField = (label: string, name: string, value: number, maximum: number): string =>
  `<label><span>${escape(label)}</span><input name="${escape(name)}" type="number" min="0" max="${maximum}" step="1" value="${value}" required></label>`;
const escape = (value: unknown): string => String(value).replace(/[&<>"']/gu, (char) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[char]!);
