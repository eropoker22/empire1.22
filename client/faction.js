document.addEventListener("DOMContentLoaded", () => {
  const matrixCanvas = document.getElementById("matrix-canvas");
  if (matrixCanvas) {
    const ctx = matrixCanvas.getContext("2d");
    const letters = "アカサタナハマヤラワ0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    let width = 0;
    let height = 0;
    let columns = 0;
    let drops = [];
    let animationId = null;
    let lastTime = 0;

    const setSize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      matrixCanvas.width = Math.floor(width * window.devicePixelRatio);
      matrixCanvas.height = Math.floor(height * window.devicePixelRatio);
      ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
      const fontSize = 14;
      columns = Math.floor(width / fontSize);
      drops = Array.from({ length: columns }, () => Math.random() * height);
    };

    const draw = (time) => {
      if (time - lastTime < 50) {
        animationId = requestAnimationFrame(draw);
        return;
      }
      lastTime = time;
      ctx.fillStyle = "rgba(7, 8, 15, 0.15)";
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = "rgba(34, 211, 238, 0.85)";
      ctx.font = "14px 'IBM Plex Mono', monospace";
      for (let i = 0; i < drops.length; i += 1) {
        const text = letters[Math.floor(Math.random() * letters.length)];
        const x = i * 14;
        const y = drops[i];
        ctx.fillText(text, x, y);
        drops[i] += 16;
        if (drops[i] > height + Math.random() * 200) {
          drops[i] = -Math.random() * 200;
        }
      }
      animationId = requestAnimationFrame(draw);
    };

    setSize();
    animationId = requestAnimationFrame(draw);
    window.addEventListener("resize", setSize);

    document.addEventListener("visibilitychange", () => {
      if (document.hidden && animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
        return;
      }
      if (!document.hidden && !animationId) {
        lastTime = 0;
        animationId = requestAnimationFrame(draw);
      }
    });
  }

  const API_BASE = "http://localhost:3000";
  const currentMode = window.Empire?.mode || "war";
  const resolveGameEntryHref = (mode) => {
    const normalizedMode = window.Empire?.GameModes?.normalizeMode?.(mode) || "war";
    return `index.html?mode=${normalizedMode}`;
  };
  const backToLogin = document.querySelector('.faction-link--secondary[href="login.html"]');
  let authToken = localStorage.getItem("empire_token");

  const grid = document.getElementById("structure-grid");
  const note = document.getElementById("structure-note");
  const detail = document.getElementById("faction-detail");
  const factionShell = document.querySelector(".auth-card--faction");
  const title = document.getElementById("faction-title");
  const desc = document.getElementById("faction-desc");
  const bonus = document.getElementById("faction-bonus");
  const goGame = document.getElementById("go-game");
  const avatarGrid = document.getElementById("avatar-grid");
  const avatarLeft = document.getElementById("avatar-left");
  const avatarRight = document.getElementById("avatar-right");
  const gangColorGrid = document.getElementById("gang-color-grid");
  const gangColorValue = document.getElementById("gang-color-value");
  const lightbox = document.getElementById("avatar-lightbox");
  const lightboxImg = document.getElementById("avatar-lightbox-img");
  const lightboxCaption = document.getElementById("avatar-lightbox-caption");
  const lightboxPrev = document.getElementById("avatar-lightbox-prev");
  const lightboxNext = document.getElementById("avatar-lightbox-next");
  const lightboxConfirm = document.getElementById("avatar-lightbox-confirm");
  const lightboxClose = document.getElementById("avatar-lightbox-close");
  const lightboxBackdrop = document.querySelector("#avatar-lightbox .avatar-lightbox__backdrop");
  const isCoarsePointer = window.matchMedia("(pointer: coarse)").matches;
  const marquee = avatarGrid?.closest(".avatar-marquee") || null;

  let selectedStructure = localStorage.getItem("empire_structure");
  let selectedAvatar = localStorage.getItem("empire_avatar");
  let selectedGangColor = localStorage.getItem("empire_gang_color");
  let hoverPause = false;
  let marqueeTouchState = {
    active: false,
    moved: false,
    startX: 0
  };
  let marqueeLoopWidth = 0;
  let gangColorSyncRevision = 0;
  let mobileStructureTapState = {
    structure: null,
    at: 0
  };
  const selectionConfirmed = {
    structure: false,
    avatar: false,
    gangColor: false
  };
  const MOBILE_STRUCTURE_DOUBLE_TAP_MS = 360;

  const factionAvatarPools = {
    "mafián": [
      "../img/avatars/Mafia/2854d1df-0f7c-4fe4-aa85-7a70dfe299db.jpg",
      "../img/avatars/Mafia/8d2dcbe6-00d3-4b6f-98a0-53dc914346c5.jpg",
      "../img/avatars/Mafia/c06f4c9b-2f01-43bc-a085-cd614f5435a9.jpg",
      "../img/avatars/Mafia/cc2273ef-9175-4422-80ae-3c790f05e233.jpg",
      "../img/avatars/Mafia/grok_image_1773619750005.jpg",
      "../img/avatars/Mafia/grok_image_1773619862866.jpg",
      "../img/avatars/Mafia/grok_image_1773620311309.jpg",
      "../img/avatars/Mafia/grok_image_1773620518258.jpg",
      "../img/avatars/Mafia/u6568429269_ultra_realistic_photo_of_a_middle-aged_mafia_boss_6ea45063-7161-4bc9-a6fc-d6272093bdfd_2.png",
      "../img/avatars/Mafia/u6568429269_ultra_realistic_photo_of_a_middle-aged_mafia_boss_75858821-6f00-4d5d-b505-f4c4718f6793_3.png"
    ],
    kartel: [
      "../img/avatars/Kartel/0f3d68b6-79b0-4bdd-9856-2491cd66cb78.jpg",
      "../img/avatars/Kartel/37b9a32a-4710-4060-a1a9-5cf2e2c924c7.jpg",
      "../img/avatars/Kartel/4106b8e4-5832-4e06-80bc-41a8c7f338ba.jpg",
      "../img/avatars/Kartel/43141dc5-2250-4074-8579-a112abd5e038.jpg",
      "../img/avatars/Kartel/493a9297-ee18-49ca-a81e-aeca0a214a2b.jpg",
      "../img/avatars/Kartel/5c31615c-6e38-408c-8d88-b8aea5af6a26.jpg",
      "../img/avatars/Kartel/6a744996-f511-461a-9921-3cb3df3ad166.jpg",
      "../img/avatars/Kartel/a02833cd-b493-41aa-b784-b28ae35124b3.jpg",
      "../img/avatars/Kartel/f1a482b8-44c2-41f1-9e3c-1d4c4cff5d7d.jpg",
      "../img/avatars/Kartel/f7281b4a-f79f-4d76-b975-5153d414208f.jpg"
    ],
    "pouliční gang": [
      "../img/avatars/polucnigang/5f1bbe02-e437-43b6-b9ed-c453e34ca622.jpg",
      "../img/avatars/polucnigang/f9b2211e-30fb-46ab-aa4c-16913d8a92c6.jpg",
      "../img/avatars/polucnigang/grok_image_1773620275790.jpg",
      "../img/avatars/polucnigang/grok_image_1773620321599.jpg",
      "../img/avatars/polucnigang/u6568429269_ultra_realistic_photo_of_a_female_underground_dea_52cbb8d9-f907-4f76-95c5-608796e1408f_2.png",
      "../img/avatars/polucnigang/u6568429269_ultra_realistic_photo_of_a_hacker_real_human_eye__0febf5a6-2d94-462e-8273-7f75ebc9702f_2.png",
      "../img/avatars/polucnigang/u6568429269_ultra_realistic_photo_of_a_man_standing_in_a_dark_414698ba-5d74-445c-aff4-08db501c9559_1.png",
      "../img/avatars/polucnigang/u6568429269_ultra_realistic_photo_of_a_young_street_gangster__b24ce8ec-0dd1-4655-9a10-903bd799329b_0.png",
      "../img/avatars/polucnigang/u6568429269_underground_drug_dealer_shady_look_neon_pills_glo_eb67ef23-8107-4e80-a2b4-5e761a9707a9_0.png",
      "../img/avatars/polucnigang/u6568429269_underground_drug_dealer_shady_look_neon_pills_glo_eb67ef23-8107-4e80-a2b4-5e761a9707a9_3.png"
    ],
    "tajná organizace": [
      "../img/avatars/Tajnaorganizace/0099fc13-4774-459a-b1a9-ea507a6c0526.jpg",
      "../img/avatars/Tajnaorganizace/0870f362-b2ce-4607-ad3f-a96b59afcc8d.jpg",
      "../img/avatars/Tajnaorganizace/0bd44b08-ad68-4404-9530-0522aae3ec60.jpg",
      "../img/avatars/Tajnaorganizace/66c17176-42d3-4647-8c06-fc6e91f3957f.jpg",
      "../img/avatars/Tajnaorganizace/90387802-ab09-43dd-b1be-e513584fc020.jpg",
      "../img/avatars/Tajnaorganizace/9201ecf3-9210-4769-b500-37186590748a.jpg",
      "../img/avatars/Tajnaorganizace/9d63f447-a2aa-484c-9f5c-6c81f7e164c0.jpg",
      "../img/avatars/Tajnaorganizace/c145e5c4-81e4-4681-a316-1a4976cf3549.jpg",
      "../img/avatars/Tajnaorganizace/da2df45b-cb96-4d83-b18c-2c91946bc817.jpg",
      "../img/avatars/Tajnaorganizace/u6568429269_ultra_realistic_photo_of_an_elegant_man_outside_a_188a7cff-400b-454a-850d-5b64750e328f_0.png"
    ],
    "hackeři": [
      "../img/avatars/Hacker/379f566a-18b8-457e-83ee-ee9ee114cb7a.jpg",
      "../img/avatars/Hacker/53867e7d-cc7e-4f92-b391-88f44bf7e349.jpg",
      "../img/avatars/Hacker/b2ca251d-ddc6-43ac-9001-d9b9d2f28203.jpg",
      "../img/avatars/Hacker/d50c31d1-c395-4f21-8dae-9088c65926cb.jpg",
      "../img/avatars/Hacker/grok_image_1773620608055.jpg",
      "../img/avatars/Hacker/grok_image_1773621424855.jpg",
      "../img/avatars/Hacker/grok_image_1773621797044.jpg",
      "../img/avatars/Hacker/u6568429269_ultra_realistic_photo_of_a_hacker_real_human_eye__7dc8e46f-f8fc-4957-8366-b556a1cf2dc4_1.png",
      "../img/avatars/Hacker/u6568429269_ultra_realistic_photo_of_a_hacker_real_human_eye__f876b11b-aba1-4c29-944c-02fa3f726770_2.png",
      "../img/avatars/Hacker/u6568429269_ultra_realistic_photo_of_a_young_hacker_real_huma_f3554d32-77a2-4073-affb-616f3353f331_1.png"
    ],
    "motorkářský gang": [
      "../img/avatars/Motogang/grok_image_1773621173474.jpg",
      "../img/avatars/Motogang/grok_image_1773621230721.jpg",
      "../img/avatars/Motogang/grok_image_1773621252715.jpg",
      "../img/avatars/Motogang/u6568429269_cyberpunk_biker_leather_jacket_glowing_bike_behin_1da05b1a-019b-4a6a-97d7-8485dff3dc93_3.png",
      "../img/avatars/Motogang/u6568429269_ultra_realistic_photo_of_a_biker_real_human_imper_5d544f44-0abd-471c-982e-7131336ebe6f_1.png",
      "../img/avatars/Motogang/u6568429269_ultra_realistic_photo_of_a_biker_real_human_imper_5d544f44-0abd-471c-982e-7131336ebe6f_2.png",
      "../img/avatars/Motogang/u6568429269_ultra_realistic_photo_of_a_biker_real_human_skin__fa51ff6a-3bb8-4ca1-a43e-9d60d8bc2824_3.png",
      "../img/avatars/Motogang/u6568429269_ultra_realistic_photo_of_a_female_biker_real_huma_2b692954-b73f-49e4-91d8-dddc78867254_0.png",
      "../img/avatars/Motogang/u6568429269_ultra_realistic_photo_of_a_female_biker_real_huma_2b692954-b73f-49e4-91d8-dddc78867254_3.png",
      "../img/avatars/Motogang/u6568429269_ultra_realistic_portrait_of_a_cyberpunk_biker_sym_22eb676a-3364-4a3b-a9f6-48cdad9c87c5_2.png"
    ],
    "soukromá armáda": [
      "../img/avatars/SoukromaArmada/17912d57-dfc8-49fc-9a90-44121c298975.jpg",
      "../img/avatars/SoukromaArmada/bbe6342a-cf92-4459-af42-dbb7beba19f6.jpg",
      "../img/avatars/SoukromaArmada/c4f384d2-9cd2-4f78-9145-a8e98dbc02dc.jpg",
      "../img/avatars/SoukromaArmada/grok_image_1773620629687.jpg",
      "../img/avatars/SoukromaArmada/grok_image_1773620667715.jpg",
      "../img/avatars/SoukromaArmada/grok_image_1773620914229.jpg",
      "../img/avatars/SoukromaArmada/u6568429269_private_military_soldier_futuristic_armor_scars_h_26d14473-69e5-46d8-baf2-e237305257ba_0.png",
      "../img/avatars/SoukromaArmada/u6568429269_private_military_soldier_futuristic_armor_scars_h_26d14473-69e5-46d8-baf2-e237305257ba_1.png",
      "../img/avatars/SoukromaArmada/u6568429269_private_military_soldier_futuristic_armor_scars_h_945f0251-cd43-4191-a97a-4997c480ef9e_1.png",
      "../img/avatars/SoukromaArmada/u6568429269_ultra_realistic_photo_of_a_mercenary_real_human_s_07ad1129-e85f-48b2-b807-b68d3fe0b68d_3.png"
    ],
    korporace: [
      "../img/avatars/Korporat/094f576f-646f-4ec9-9786-63019d07cdfe.jpg",
      "../img/avatars/Korporat/2ef61d31-c01c-44a3-bca5-6171166352b0.jpg",
      "../img/avatars/Korporat/350d79e5-06fb-45d4-a5c4-82e0a4c21e51.jpg",
      "../img/avatars/Korporat/42f30467-a673-4be8-9720-e221144c6286.jpg",
      "../img/avatars/Korporat/a621b41e-363c-47a5-bbbf-421418d19db1.jpg",
      "../img/avatars/Korporat/b4f8031a-aa5e-4944-9e35-fc6b666e5f2b.jpg",
      "../img/avatars/Korporat/daf4be3b-ed24-48ac-baa7-862a08d33a6e.jpg",
      "../img/avatars/Korporat/e4286e80-0587-4e0e-afe4-70c348ee59dd.jpg",
      "../img/avatars/Korporat/u6568429269_ultra_realistic_photo_of_a_corporate_businesswoma_346a0601-d784-4262-b627-06f3cd778022_0.png",
      "../img/avatars/Korporat/u6568429269_ultra_realistic_photo_of_an_elegant_man_outside_a_4264b4bb-afb0-4c14-ab21-81929710b8d4_2.png"
    ]
  };

  const data = {
    "mafián": {
      title: "Mafián",
      desc:
        "Staré rodiny už dávno nevládnou jen násilím. Drží bary, kluby, účetní stopy i lidi, co rozhodují za zataženými závěsy. Kde mafie zapustí kořeny, tam se chaos mění v disciplinovaný tok peněz a loajality.",
      bonus: '<span class="faction-bonus__icon" aria-hidden="true">✦</span><span class="faction-bonus__copy"><strong>Protection Network</strong> Podniky v jejich sektorech generují o 25 % více peněz.</span>'
    },
    "kartel": {
      title: "Kartel",
      desc:
        "Kartel netlačí moc na odiv. Protéká městem tunelem, přístavem a nočním transportem, dokud se černý trh nezačne točit jen podle jeho pravidel. Když jde o logistiku, nikdo ve Vortex City nehraje větší hru.",
      bonus: '<span class="faction-bonus__icon" aria-hidden="true">✦</span><span class="faction-bonus__copy"><strong>Smuggling Routes</strong> Každou herní hodinu získávají pasivní příjem z černého trhu.</span>'
    },
    "pouliční gang": {
      title: "Pouliční gang",
      desc:
        "Narodili se mezi neonem, graffiti a rozbitými sirénami. Nemají lesk korporace ani staré vazby mafie. Mají hlad, počet a ochotu vzít si blok dřív, než rival stihne zavřít dveře.",
      bonus: '<span class="faction-bonus__icon" aria-hidden="true">✦</span><span class="faction-bonus__copy"><strong>Street Takeover</strong> Obsazování sektorů je o 30 % rychlejší.</span>'
    },
    "tajná organizace": {
      title: "Tajná organizace",
      desc:
        "Nikdo je nevidí přicházet. Jen po nich zůstávají ztracené záznamy, přepsaná moc a sektory, které náhle přestanou poslouchat původní majitele. Tahle frakce nebojuje nahlas. Přepisuje město ze stínu.",
      bonus: '<span class="faction-bonus__icon" aria-hidden="true">✦</span><span class="faction-bonus__copy"><strong>Shadow Control</strong> Dokážou převzít oslabený sektor bez přímého útoku.</span>'
    },
    "hackeři": {
      title: "Hackeři",
      desc:
        "Vortex City dýchá přes síť, kamery, grid a účty. Hackeři nevstupují dveřmi. Vypínají zabezpečení, přesměrovávají finance a nechávají protivníka stát v mrtvé zóně bez dat, bez přehledu a bez reakce.",
      bonus: '<span class="faction-bonus__icon" aria-hidden="true">✦</span><span class="faction-bonus__copy"><strong>System Breach</strong> Mohou krást peníze nebo dočasně vypnout celý sektor.</span>'
    },
    "motorkářský gang": {
      title: "Motorkářský gang",
      desc:
        "Silnice jsou jejich krevní oběh a hluk motorů jejich varování. Přijedou rychle, udeří tvrdě a zmizí dřív, než se město stihne srovnat. Tam, kde ostatní plánují, oni už projíždějí cílem.",
      bonus: '<span class="faction-bonus__icon" aria-hidden="true">✦</span><span class="faction-bonus__copy"><strong>Road Dominance</strong> Jednotky se pohybují po mapě o 35 % rychleji.</span>'
    },
    "soukromá armáda": {
      title: "Soukromá armáda",
      desc:
        "Tohle nejsou gangsteři. Tohle jsou kontraktoři války. Každý vstup, každý tah a každá obrana má řád. Jsou dražší, chladnější a přesnější než kdokoliv jiný. Když drží sektor oni, působí jako pevnost.",
      bonus: '<span class="faction-bonus__icon" aria-hidden="true">✦</span><span class="faction-bonus__copy"><strong>Elite Training</strong> Jejich jednotky mají nejvyšší obrannou efektivitu ve hře.</span>'
    },
    "korporace": {
      title: "Korporace",
      desc:
        "Korporace nevypadají jako válka. Vypadají jako smlouva, audit a převod vlastnictví. Kupují vliv, přetáčejí politiku a z oslabených čtvrtí dělají aktiva. Nevyhrávají ulici hlukem, ale tlakem kapitálu.",
      bonus: '<span class="faction-bonus__icon" aria-hidden="true">✦</span><span class="faction-bonus__copy"><strong>Corporate Buyout</strong> Oslabený sektor mohou převzít nákupem místo útoku.</span>'
    }
  };

  const factionOrder = [
    "mafián",
    "kartel",
    "pouliční gang",
    "tajná organizace",
    "hackeři",
    "motorkářský gang",
    "soukromá armáda",
    "korporace"
  ];

  const factionLegendNamePrefix = {
    "mafián": "Don Umbra",
    "kartel": "El Circuito",
    "pouliční gang": "Street Wolf",
    "tajná organizace": "Shade Proxy",
    "hackeři": "Null Ghost",
    "motorkářský gang": "Road Viper",
    "soukromá armáda": "Iron Unit",
    "korporace": "Executive Prime"
  };

  const factionLegendBios = {
    "mafián": [
      "Tichý vyjednavač, který kupuje loajalitu dřív, než padne první výstřel.",
      "Pouliční účetní rodiny, co mění dluhy ve zbraň proti rivalům.",
      "Pravá ruka dona, specialista na vydírání klubů a barů.",
      "Nenápadný stratég, co řídí výpalné síť po celé čtvrti."
    ],
    "kartel": [
      "Logistický mozek pašerácké trasy mezi přístavem a nočními sklady.",
      "Chemik kartelu, který hlídá kvalitu i strach na ulici.",
      "Polní velitel konvojů, co nikdy nenechá zásilku bez krytí.",
      "Náborář kartelu, který ztracené duše mění v disciplinované jezdce."
    ],
    "pouliční gang": [
      "První do útoku, poslední na ústup. Ulice ho respektují i nenávidí.",
      "Graffiti taktik, který značkuje sektory dřív než přijede policie.",
      "Rychlý runner, co zná každou zadní uličku ve Vortex City.",
      "Charismatický provokatér, který dokáže z davu udělat armádu."
    ],
    "tajná organizace": [
      "Operativní stín, který sbírá kompromitující data na politiky.",
      "Mistr infiltrace, co mění cizí pevnosti ve vlastní spící buňky.",
      "Analytik chaosu, který předvídá pohyb gangů o dva kroky dopředu.",
      "Nenápadný manipulátor, který tahá za nitky přes prostředníky."
    ],
    "hackeři": [
      "Síťový predátor, co láme zabezpečení městské infrastruktury v reálném čase.",
      "Specialistka na finanční průniky, která čistí účty rivalů na dálku.",
      "Architekt malwaru, co vypíná kamery přesně před útokem.",
      "Datový kurýr, který přenáší tajemství mezi gangy za nejvyšší nabídku."
    ],
    "motorkářský gang": [
      "Velitel kolon, který proměňuje dálnice v nepřátelské území.",
      "Mechanik-válečník, co staví rychlé stroje i mobilní obranné pasti.",
      "Průzkumník hranic, který první mapuje nové sektory pro gang.",
      "Noční jezdkyně, co koordinuje útoky mezi přístavem a průmyslem."
    ],
    "soukromá armáda": [
      "Bývalý instruktor elit, co vede městské operace s vojenskou přesností.",
      "Specialista na obranné linie, který mění sektor v pevnost.",
      "Taktická spojka, co synchronizuje útoky dronů a pozemních jednotek.",
      "Kontraktor bez emocí, který měří hodnotu cíle čistě výsledkem."
    ],
    "korporace": [
      "Firemní vyjednavač, který kupuje radnice i policejní ticho.",
      "Investiční predátor, co převádí krizové zóny do portfolia korporace.",
      "Manažer vlivu, který vyrábí reputaci i skandály na objednávku.",
      "Ředitel expanze, co mění město v tabulku aktiv a ztrát."
    ]
  };

  const factionLegendMotivations = {
    "mafián": [
      "Chce sjednotit podsvětí pod jednu rodinu a vybírat desátek z každé ulice Vortex City.",
      "Touží ovládnout radnici přes dluhy a udělat z města soukromý trezor rodiny.",
      "Věří, že jen pevná ruka mafie udrží v chaosu pořádek a zisk."
    ],
    "kartel": [
      "Chce ovládnout přístav a letiště, aby každý tok zboží vedl přes kartel.",
      "Touží proměnit Vortex City v hlavní uzel černého trhu celého regionu.",
      "Vítězství znamená kontrolu cen drog, zbraní i tras bez cizího zásahu."
    ],
    "pouliční gang": [
      "Chce dokázat, že ulice patří těm, kdo je brání, ne těm, kdo je kupují.",
      "Touží sjednotit rozdělené bloky pod jednu barvu a jednu vlajku.",
      "Ovládnutím města chce dát své partě respekt, který jim byl vždy upírán."
    ],
    "tajná organizace": [
      "Chce ovládnout Vortex City ze stínu a rozhodovat o válkách bez otevřeného boje.",
      "Touží držet kompromitující materiály na každého mocného hráče ve městě.",
      "Kontrola města je cesta k absolutní informační převaze."
    ],
    "hackeři": [
      "Chce přepsat digitální pravidla města a přesměrovat jeho finance pod vlastní kontrolu.",
      "Touží vypnout infrastrukturu rivalům jediným příkazem.",
      "Ovládnutí Vortex City znamená mít přístup ke každému systému i tajemství."
    ],
    "motorkářský gang": [
      "Chce držet všechny dopravní tepny města a rozhodovat, kdo projede a kdo zmizí.",
      "Touží udělat z Vortex City teritorium, kde rychlost znamená moc.",
      "Kontrola města je pro gang svoboda bez hranic a bez cizích pravidel."
    ],
    "soukromá armáda": [
      "Chce proměnit město v pevnost řízenou disciplínou a vojenským řádem.",
      "Touží ovládnout klíčovou infrastrukturu a prodávat bezpečí za vlastní podmínky.",
      "Vítězství ve Vortex City je důkaz, že profesionální síla porazí každý gang."
    ],
    "korporace": [
      "Chce převzít město ekonomicky a změnit gangy v dodavatele korporátní moci.",
      "Touží ovládnout média, burzu i politiku a přepsat pravidla ve svůj prospěch.",
      "Kontrola Vortex City je pro korporaci vstupenka k regionálnímu monopolu."
    ]
  };

  const gangColorOptions = [
    { name: "Červená", value: "#ef4444" },
    { name: "Modrá", value: "#3b82f6" },
    { name: "Zelená", value: "#22c55e" },
    { name: "Žlutá", value: "#eab308" },
    { name: "Oranžová", value: "#f97316" },
    { name: "Fialová", value: "#8b5cf6" },
    { name: "Růžová", value: "#ec4899" },
    { name: "Tyrkysová", value: "#14b8a6" },
    { name: "Azurová", value: "#06b6d4" },
    { name: "Purpurová", value: "#a21caf" },
    { name: "Vínová", value: "#7f1d1d" },
    { name: "Olivová", value: "#6b8e23" },
    { name: "Limetková", value: "#84cc16" },
    { name: "Mentolová", value: "#a7f3d0" },
    { name: "Lososová", value: "#fa8072" },
    { name: "Korálová", value: "#ff7f50" },
    { name: "Zlatá", value: "#ffd700" },
    { name: "Stříbrná", value: "#c0c0c0" },
    { name: "Béžová", value: "#f5f5dc" },
    { name: "Hnědá", value: "#8b4513" },
    { name: "Černá", value: "#111111" },
    { name: "Bílá", value: "#ffffff" },
    { name: "Šedá", value: "#9ca3af" },
    { name: "Indigo", value: "#4f46e5" },
    { name: "Safírová", value: "#0f52ba" },
    { name: "Smaragdová", value: "#50c878" },
    { name: "Karmínová", value: "#dc143c" },
    { name: "Levandulová", value: "#e6e6fa" },
    { name: "Broskvová", value: "#ffdab9" },
    { name: "Antracitová", value: "#36454f" }
  ];
  const gangColorValueSet = new Set(gangColorOptions.map((item) => item.value));
  const gangColorByValue = new Map(gangColorOptions.map((item) => [item.value, item.name]));

  selectedGangColor = normalizeHexColor(selectedGangColor);
  if (selectedGangColor && !gangColorValueSet.has(selectedGangColor)) {
    selectedGangColor = null;
    localStorage.removeItem("empire_gang_color");
  }

  function normalizeHexColor(value) {
    const raw = String(value || "").trim().toLowerCase();
    if (!raw) return null;
    if (/^#[0-9a-f]{3}$/.test(raw)) {
      return `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`;
    }
    if (/^#[0-9a-f]{6}$/.test(raw)) return raw;
    return null;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function getAvailableAvatars() {
    if (!selectedStructure) return [];
    const avatars = factionAvatarPools[selectedStructure];
    return Array.isArray(avatars) ? avatars : [];
  }

  function resolveGangColorName(color) {
    const normalized = normalizeHexColor(color);
    if (!normalized) return "Nevybráno";
    return gangColorByValue.get(normalized) || normalized.toUpperCase();
  }

  function renderGangColorOptions() {
    if (!gangColorGrid) return;
    gangColorGrid.innerHTML = gangColorOptions
      .map(
        ({ name, value }) => `
          <button
            class="gang-color-swatch"
            type="button"
            data-gang-color="${value}"
            style="--swatch:${value}"
            aria-label="${name}"
            title="${name}"
          ></button>
        `
      )
      .join("");
  }

  function updateContinueState() {
    if (!goGame) return;
    if (
      selectedStructure
      && selectedAvatar
      && selectedGangColor
      && selectionConfirmed.structure
      && selectionConfirmed.avatar
      && selectionConfirmed.gangColor
    ) {
      goGame.classList.remove("faction-link--disabled");
      goGame.setAttribute("aria-disabled", "false");
      goGame.tabIndex = 0;
    } else {
      goGame.classList.add("faction-link--disabled");
      goGame.setAttribute("aria-disabled", "true");
      goGame.tabIndex = -1;
    }
  }

  function updateNote() {
    if (!note) return;
    if (
      selectedStructure
      && selectedAvatar
      && selectedGangColor
      && selectionConfirmed.structure
      && selectionConfirmed.avatar
      && selectionConfirmed.gangColor
    ) {
      note.textContent = `Vybráno: ${selectedStructure} • ${resolveGangColorName(selectedGangColor)} • avatar.`;
      return;
    }
    const missing = [];
    if (!selectedStructure || !selectionConfirmed.structure) missing.push("frakci");
    if (!selectedGangColor || !selectionConfirmed.gangColor) missing.push("barvu gangu");
    if (!selectedAvatar || !selectionConfirmed.avatar) missing.push("avatara");
    note.textContent = `Chybí vybrat: ${missing.join(", ")}.`;
  }

  function applyAuthToken(nextToken) {
    const safeToken = String(nextToken || "").trim();
    if (!safeToken) return;
    authToken = safeToken;
    localStorage.setItem("empire_token", safeToken);
  }

  async function postAuthed(path, body) {
    if (!authToken) return { error: "missing_token" };
    try {
      const res = await fetch(`${API_BASE}${path}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body || {})
      });
      return res.json();
    } catch {
      return { error: "network_error" };
    }
  }

  function renderGangColorSelectionState(normalizedColor) {
    if (gangColorGrid) {
      gangColorGrid.querySelectorAll("[data-gang-color]").forEach((button) => {
        const buttonColor = normalizeHexColor(button.dataset.gangColor);
        button.classList.toggle("is-selected", buttonColor === normalizedColor);
      });
    }
    if (!gangColorValue) return;
    if (normalizedColor) {
      const colorName = resolveGangColorName(normalizedColor);
      gangColorValue.textContent = colorName;
      gangColorValue.style.color = normalizedColor;
      return;
    }
    gangColorValue.textContent = "Nevybráno";
    gangColorValue.style.color = "";
  }

  function clearGangColorSelection() {
    selectedGangColor = null;
    localStorage.removeItem("empire_gang_color");
    renderGangColorSelectionState(null);
    updateContinueState();
  }

  function getAvatarLabel(src) {
    if (!src) return "Neznámý agent";
    const match = src.match(/(\d{6,})/);
    if (match) {
      const id = match[1].slice(-4);
      return `Agent ${id}`;
    }
    return "Neznámý agent";
  }

  function resolveAvatarLegend(src) {
    const avatars = getAvailableAvatars();
    const index = avatars.indexOf(src);
    const idx = index >= 0 ? index : 0;
    const factionKey = selectedStructure && data[selectedStructure] ? selectedStructure : null;
    const prefix = factionLegendNamePrefix[factionKey] || "Agent";
    const bioPool = factionLegendBios[factionKey] || ["Neznámá postava, která čeká na svůj příběh."];
    const motivePool = factionLegendMotivations[factionKey] || [
      "Chce přežít ve Vortex City a získat vlastní místo u moci."
    ];
    return {
      name: `${prefix} ${idx + 1}`,
      bio: bioPool[idx % bioPool.length],
      motivation: motivePool[idx % motivePool.length]
    };
  }

  function isLightboxOpen() {
    return Boolean(lightbox && !lightbox.classList.contains("hidden"));
  }

  function updateLightboxNavigation() {
    if (!lightboxPrev || !lightboxNext) return;
    const canNavigate = getAvailableAvatars().length > 1;
    lightboxPrev.disabled = !canNavigate;
    lightboxNext.disabled = !canNavigate;
  }

  function openLightbox(src) {
    if (!lightbox || !lightboxImg) return;
    lightboxImg.src = src;
    lightboxImg.dataset.avatar = src || "";
    if (lightboxCaption) {
      const legend = resolveAvatarLegend(src);
      lightboxCaption.innerHTML = `
        <div class="avatar-lightbox__legend-name">${escapeHtml(legend.name)}</div>
        <div class="avatar-lightbox__legend-bio">${escapeHtml(legend.bio)}</div>
        <div class="avatar-lightbox__legend-motive">
          <strong>Motivace:</strong> ${escapeHtml(legend.motivation)}
        </div>
      `;
    }
    lightbox.classList.remove("hidden");
    updateLightboxNavigation();
  }

  function closeLightbox() {
    if (!lightbox) return;
    lightbox.classList.add("hidden");
  }

  function shiftLightboxAvatar(direction) {
    const avatars = getAvailableAvatars();
    if (!avatars.length) return;
    const step = Number(direction) < 0 ? -1 : 1;
    const currentSrc = String(lightboxImg?.dataset?.avatar || selectedAvatar || avatars[0]);
    let currentIndex = avatars.indexOf(currentSrc);
    if (currentIndex < 0) currentIndex = 0;
    const nextIndex = (currentIndex + step + avatars.length) % avatars.length;
    const nextSrc = avatars[nextIndex];
    applyAvatarSelection(nextSrc, { openPreview: false });
    openLightbox(nextSrc);
  }

  async function applyGangColorSelection(color, options = {}) {
    const normalized = normalizeHexColor(color);
    if (!normalized || !gangColorValueSet.has(normalized)) return false;
    const previousColor = normalizeHexColor(selectedGangColor);
    const previousGangColorConfirmed = selectionConfirmed.gangColor;
    const shouldConfirmSelection = options?.confirm !== false;
    const shouldSyncServer = Boolean(authToken) && !options?.skipServerSync;
    const isSameAsPrevious = previousColor === normalized;

    if (shouldConfirmSelection) {
      selectionConfirmed.gangColor = true;
    }

    if (!isSameAsPrevious) {
      selectedGangColor = normalized;
      localStorage.setItem("empire_gang_color", normalized);
      renderGangColorSelectionState(normalized);
      updateContinueState();
      updateNote();
    } else if (!options?.silent) {
      updateNote();
    }

    if (!shouldSyncServer) return true;

    if (!isSameAsPrevious || options?.forceServerSync) {
      const syncRevision = ++gangColorSyncRevision;
      const result = await postAuthed("/players/gang-color", { color: normalized });
      if (syncRevision !== gangColorSyncRevision) {
        return false;
      }
      const confirmedColor = normalizeHexColor(result?.gangColor);
      if (confirmedColor) {
        selectedGangColor = confirmedColor;
        localStorage.setItem("empire_gang_color", confirmedColor);
        renderGangColorSelectionState(confirmedColor);
        if (result?.token) applyAuthToken(result.token);
        if (!options?.silent) updateNote();
        return true;
      }

      if (previousColor && previousColor !== normalized) {
        selectedGangColor = previousColor;
        localStorage.setItem("empire_gang_color", previousColor);
        renderGangColorSelectionState(previousColor);
      } else if (previousColor) {
        selectedGangColor = previousColor;
        localStorage.setItem("empire_gang_color", previousColor);
        renderGangColorSelectionState(previousColor);
      } else {
        clearGangColorSelection();
      }
      selectionConfirmed.gangColor = previousGangColorConfirmed;
      updateContinueState();
      if (!options?.silent && note) {
        if (result?.error === "gang_color_taken") {
          note.textContent = `Barva ${resolveGangColorName(normalized)} je už obsazená jiným hráčem. Vyber jinou.`;
        } else {
          note.textContent = "Barvu gangu se nepodařilo uložit na server.";
        }
      }
      return false;
    }

    return true;
  }

  function applyStructureSelection(choice, options = {}) {
    if (!choice || !grid) return;
    const shouldConfirmSelection = options?.confirm !== false;
    grid.querySelectorAll(".structure-card").forEach((btn) => {
      btn.classList.toggle("structure-card--active", btn.dataset.structure === choice);
    });
    const activeButton = grid.querySelector(`.structure-card[data-structure="${choice}"]`);
    if (activeButton) {
      const activeButtonStyles = window.getComputedStyle(activeButton);
      const accent = activeButtonStyles.getPropertyValue("--structure-accent").trim();
      const accentSoft = activeButtonStyles.getPropertyValue("--structure-accent-soft").trim();
      const accentAlt = activeButtonStyles.getPropertyValue("--structure-accent-alt").trim();
      if (accent) {
        if (detail) detail.style.setProperty("--faction-accent", accent);
        if (factionShell) factionShell.style.setProperty("--faction-accent", accent);
      }
      if (accentSoft) {
        if (detail) detail.style.setProperty("--faction-accent-soft", accentSoft);
        if (factionShell) factionShell.style.setProperty("--faction-accent-soft", accentSoft);
      }
      if (accentAlt) {
        if (detail) detail.style.setProperty("--faction-accent-alt", accentAlt);
        if (factionShell) factionShell.style.setProperty("--faction-accent-alt", accentAlt);
      }
    }
    selectedStructure = choice;
    localStorage.setItem("empire_structure", choice);
    if (shouldConfirmSelection) {
      selectionConfirmed.structure = true;
    }

    const availableAvatars = getAvailableAvatars();
    if (!availableAvatars.includes(selectedAvatar)) {
      selectedAvatar = null;
      selectionConfirmed.avatar = false;
      localStorage.removeItem("empire_avatar");
    }

    renderAvatars();
    if (isLightboxOpen()) {
      if (selectedAvatar && availableAvatars.includes(selectedAvatar)) {
        openLightbox(selectedAvatar);
      } else {
        closeLightbox();
      }
    }

    const info = data[choice];
    if (info) {
      if (detail) detail.classList.add("is-active");
      if (title) title.textContent = info.title;
      if (desc) desc.textContent = info.desc;
      if (bonus) bonus.innerHTML = info.bonus;
    }
    updateContinueState();
    updateNote();
    if (authToken) {
      fetch(`${API_BASE}/players/structure`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ structure: choice })
      })
        .then((res) => res.json())
        .then((data) => {
          if (data?.token) {
            applyAuthToken(data.token);
          }
        })
        .catch(() => {});
    }
  }

  function applyAvatarSelection(src, options = {}) {
    if (!src || !avatarGrid) return;
    const shouldConfirmSelection = options?.confirm !== false;
    const availableAvatars = getAvailableAvatars();
    if (!availableAvatars.includes(src)) return;
    avatarGrid.querySelectorAll(".avatar-item").forEach((btn) => {
      btn.classList.toggle("is-selected", btn.dataset.avatar === src);
    });
    selectedAvatar = src;
    localStorage.setItem("empire_avatar", src);
    if (shouldConfirmSelection) {
      selectionConfirmed.avatar = true;
    }
    updateContinueState();
    updateNote();
    if (options.openPreview) {
      openLightbox(src);
    }
  }

  function normalizeMarqueeLoop() {
    if (!marquee || marqueeLoopWidth <= 0) return;
    while (marquee.scrollLeft >= marqueeLoopWidth) {
      marquee.scrollLeft -= marqueeLoopWidth;
    }
    while (marquee.scrollLeft < 0) {
      marquee.scrollLeft += marqueeLoopWidth;
    }
  }

  function updateMarqueeLoopWidth() {
    if (!marquee) return;
    marqueeLoopWidth = isCoarsePointer ? 0 : marquee.scrollWidth / 2;
    normalizeMarqueeLoop();
  }

  function renderAvatars() {
    if (!avatarGrid) return;
    const availableAvatars = getAvailableAvatars();
    if (!availableAvatars.length) {
      avatarGrid.innerHTML = '<div class="avatar-track__hint">Nejdřív vyber frakci. Pak se zobrazí její avatary.</div>';
      marqueeLoopWidth = 0;
      if (isLightboxOpen()) closeLightbox();
      return;
    }
    const looped = isCoarsePointer ? availableAvatars : availableAvatars.concat(availableAvatars);
    const imageLoading = isCoarsePointer ? "eager" : "lazy";
    avatarGrid.innerHTML = looped
      .map((src) => `
        <button class="avatar-item" data-avatar="${src}" aria-label="Vybrat avatara">
          <img src="${src}" alt="Avatar" loading="${imageLoading}" />
        </button>
      `)
      .join("");

    avatarGrid.querySelectorAll(".avatar-item").forEach((item) => {
      const src = item.dataset.avatar;
      if (src && src === selectedAvatar) item.classList.add("is-selected");
      if (!isCoarsePointer) {
        item.addEventListener("mouseenter", () => {
          if (src) {
            const existing = document.getElementById("avatar-hover-preview");
            if (existing) existing.remove();
            const preview = document.createElement("div");
            preview.id = "avatar-hover-preview";
            preview.className = "avatar-hover-preview";
            const img = document.createElement("img");
            img.src = src;
            img.alt = "Avatar preview";
            preview.appendChild(img);
            document.body.appendChild(preview);
          }
        });
        item.addEventListener("mouseleave", () => {
          const existing = document.getElementById("avatar-hover-preview");
          if (existing) existing.remove();
        });
      }
      item.addEventListener("click", (event) => {
        if (isCoarsePointer && marqueeTouchState.moved) {
          event.preventDefault();
          return;
        }
        applyAvatarSelection(src, { openPreview: true });
      });
    });
    if (marquee) marquee.scrollLeft = 0;
    updateMarqueeLoopWidth();
    updateLightboxNavigation();
  }

  renderGangColorOptions();

  if (grid) {
    grid.querySelectorAll(".structure-card").forEach((card) => {
      const selectCard = () => applyStructureSelection(card.dataset.structure);
      if (isCoarsePointer) {
        card.addEventListener("touchend", (event) => {
          event.preventDefault();
          const now = Date.now();
          const structure = card.dataset.structure;
          const isDoubleTap = mobileStructureTapState.structure === structure
            && (now - mobileStructureTapState.at) <= MOBILE_STRUCTURE_DOUBLE_TAP_MS;
          if (isDoubleTap) {
            mobileStructureTapState = { structure: null, at: 0 };
            selectCard();
            return;
          }
          mobileStructureTapState = { structure, at: now };
        }, { passive: false });
      } else {
        card.addEventListener("click", selectCard);
      }
    });
  }

  if (gangColorGrid) {
    gangColorGrid.querySelectorAll("[data-gang-color]").forEach((swatch) => {
      const selectColor = () => {
        void applyGangColorSelection(swatch.dataset.gangColor);
      };
      swatch.addEventListener("click", selectColor);
      swatch.addEventListener("touchend", (event) => {
        event.preventDefault();
        selectColor();
      }, { passive: false });
    });
  }

  renderAvatars();
  updateContinueState();
  updateNote();

  if (avatarLeft && avatarRight && avatarGrid && marquee) {
    const scrollByAmount = () => (marquee ? marquee.clientWidth * 0.6 : 220);
    const autoSpeedPxPerMs = 0.038;
    const mobileDriftPxPerMs = 0.009;
    let holdDirection = 0;
    let mobileDriftDirection = 1;
    let lastTime = 0;
    marquee.style.scrollBehavior = "auto";

    const step = (time) => {
      if (!marquee) return;
      if (!lastTime) lastTime = time;
      const delta = Math.min(34, Math.max(0, time - lastTime));
      lastTime = time;
      if (!hoverPause) {
        if (isCoarsePointer) {
          const maxScroll = Math.max(0, marquee.scrollWidth - marquee.clientWidth);
          if (maxScroll > 0) {
            if (marquee.scrollLeft <= 1) mobileDriftDirection = 1;
            if (marquee.scrollLeft >= maxScroll - 1) mobileDriftDirection = -1;
            marquee.scrollLeft = Math.max(
              0,
              Math.min(maxScroll, marquee.scrollLeft + mobileDriftDirection * mobileDriftPxPerMs * delta)
            );
          }
        } else if (marqueeLoopWidth > 0) {
          const speed = holdDirection !== 0 ? holdDirection * autoSpeedPxPerMs * 5.2 : autoSpeedPxPerMs;
          marquee.scrollLeft += speed * delta;
          normalizeMarqueeLoop();
        }
      }
      requestAnimationFrame(step);
    };

    if (marquee) requestAnimationFrame(step);

    const startHold = (dir) => {
      holdDirection = dir;
    };
    const stopHold = () => {
      holdDirection = 0;
    };

    const jumpBy = (delta) => {
      if (!marquee) return;
      marquee.scrollLeft += delta;
      normalizeMarqueeLoop();
    };

    const jumpLeft = () => jumpBy(-scrollByAmount());
    const jumpRight = () => jumpBy(scrollByAmount());

    avatarLeft.addEventListener("click", jumpLeft);
    avatarRight.addEventListener("click", jumpRight);

    if (isCoarsePointer) {
      avatarLeft.addEventListener("touchend", (event) => {
        event.preventDefault();
        jumpLeft();
      }, { passive: false });
      avatarRight.addEventListener("touchend", (event) => {
        event.preventDefault();
        jumpRight();
      }, { passive: false });
    }
    window.addEventListener("resize", updateMarqueeLoopWidth);

    if (!isCoarsePointer) {
      marquee.addEventListener("mouseenter", () => {
        hoverPause = true;
      });
      marquee.addEventListener("mouseleave", () => {
        hoverPause = false;
        const existing = document.getElementById("avatar-hover-preview");
        if (existing) existing.remove();
      });
      avatarLeft.addEventListener("mousedown", () => startHold(-1));
      avatarRight.addEventListener("mousedown", () => startHold(1));
      document.addEventListener("mouseup", stopHold);
      avatarLeft.addEventListener("mouseleave", stopHold);
      avatarRight.addEventListener("mouseleave", stopHold);
    }

    if (isCoarsePointer && marquee) {
      marquee.addEventListener("touchstart", (event) => {
        const touch = event.touches[0];
        if (!touch) return;
        marqueeTouchState.active = true;
        marqueeTouchState.moved = false;
        marqueeTouchState.startX = touch.clientX;
        hoverPause = true;
      }, { passive: true });

      marquee.addEventListener("touchmove", (event) => {
        if (!marqueeTouchState.active) return;
        const touch = event.touches[0];
        if (!touch) return;
        if (Math.abs(touch.clientX - marqueeTouchState.startX) > 8) {
          marqueeTouchState.moved = true;
        }
      }, { passive: true });

      const endDrag = () => {
        marqueeTouchState.active = false;
        hoverPause = false;
        window.setTimeout(() => {
          marqueeTouchState.moved = false;
        }, 80);
      };

      marquee.addEventListener("touchend", endDrag);
      marquee.addEventListener("touchcancel", endDrag);
    }
  }

  if (selectedStructure) {
    applyStructureSelection(selectedStructure, { confirm: false });
  }

  if (selectedAvatar) {
    applyAvatarSelection(selectedAvatar, { confirm: false });
  }

  if (selectedGangColor) {
    void applyGangColorSelection(selectedGangColor, {
      confirm: false,
      silent: true,
      forceServerSync: Boolean(authToken)
    });
  } else if (gangColorValue) {
    gangColorValue.textContent = "Nevybráno";
    gangColorValue.style.color = "";
  }

  if (lightboxBackdrop) {
    lightboxBackdrop.addEventListener("click", closeLightbox);
  }

  if (lightboxClose) {
    lightboxClose.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      closeLightbox();
    });
    lightboxClose.addEventListener("touchend", (event) => {
      event.preventDefault();
      event.stopPropagation();
      closeLightbox();
    }, { passive: false });
  }

  if (lightboxPrev) {
    lightboxPrev.addEventListener("click", (event) => {
      event.stopPropagation();
      shiftLightboxAvatar(-1);
    });
    lightboxPrev.addEventListener("touchend", (event) => {
      event.preventDefault();
      event.stopPropagation();
      shiftLightboxAvatar(-1);
    }, { passive: false });
  }

  if (lightboxNext) {
    lightboxNext.addEventListener("click", (event) => {
      event.stopPropagation();
      shiftLightboxAvatar(1);
    });
    lightboxNext.addEventListener("touchend", (event) => {
      event.preventDefault();
      event.stopPropagation();
      shiftLightboxAvatar(1);
    }, { passive: false });
  }

  if (lightboxConfirm) {
    lightboxConfirm.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      closeLightbox();
    });
    lightboxConfirm.addEventListener("touchend", (event) => {
      event.preventDefault();
      event.stopPropagation();
      closeLightbox();
    }, { passive: false });
  }

  if (lightbox) {
    lightbox.addEventListener("click", (event) => {
      if (event.target === lightbox) closeLightbox();
    });
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeLightbox();
      return;
    }
    if (!isLightboxOpen()) return;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      shiftLightboxAvatar(-1);
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      shiftLightboxAvatar(1);
    }
  });

  if (goGame) {
    goGame.href = resolveGameEntryHref(currentMode);
    goGame.addEventListener("click", async (event) => {
      if (
        !selectedStructure
        || !selectedAvatar
        || !selectedGangColor
        || !selectionConfirmed.structure
        || !selectionConfirmed.avatar
        || !selectionConfirmed.gangColor
      ) {
        event.preventDefault();
        updateNote();
        return;
      }
      event.preventDefault();
      if (authToken) {
        await applyGangColorSelection(selectedGangColor, {
          forceServerSync: true
        });
      }
      const targetHref = String(goGame.getAttribute("href") || resolveGameEntryHref(currentMode));
      window.location.href = targetHref;
    });
  }

  if (backToLogin) {
    backToLogin.href = window.Empire?.getGameModeUrl?.("login", currentMode) || `/login.html?mode=${currentMode}`;
  }
});


