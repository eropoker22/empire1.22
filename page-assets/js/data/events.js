import {
  leonSwitchVargaEvents,
  nyraValeEvents,
  victorGraveEvents
} from "../app/city-events-data.js";
import { registerEmpireData } from "./registry.js";

export {
  leonSwitchVargaEvents,
  nyraValeEvents,
  victorGraveEvents
};

export const LOGIN_ACTIVE_EVENTS = Object.freeze([
  {
    title: "POLICE RAID",
    text: "Zásahová jednotka čistí Downtown a zavírá únikové trasy.",
    time: "08:42",
    symbol: "◇",
    tone: "raid"
  },
  {
    title: "TOXIC TRAP",
    text: "Park zóna hlásí kontaminované skrýše a vyšší odměny.",
    time: "09:16",
    symbol: "☠",
    tone: "toxic"
  },
  {
    title: "GANG WAR",
    text: "Night Vultures a Purple Cobras bojují o hranici trhu.",
    time: "10:03",
    symbol: "✣",
    tone: "war"
  },
  {
    title: "BLACK MARKET",
    text: "Překupníci otevřeli krátké okno pro levnější kontraband.",
    time: "10:41",
    symbol: "$",
    tone: "market"
  },
  {
    title: "DATA LEAK",
    text: "Hackeři pustili do ulic seznam slabých skladů.",
    time: "11:09",
    symbol: "⌁",
    tone: "hack"
  },
  {
    title: "ARMS DROP",
    text: "Na Industrial okraji přistála zásilka zbraní bez majitele.",
    time: "11:52",
    symbol: "▦",
    tone: "supply"
  },
  {
    title: "SAFEHOUSE BURN",
    text: "Hoří kryt v Residential bloku. Stopy mizí rychleji než svědci.",
    time: "12:18",
    symbol: "▲",
    tone: "alert"
  },
  {
    title: "BORDER CHECK",
    text: "Policie kontroluje přejezdy mezi Commercial a Harbor.",
    time: "12:44",
    symbol: "!",
    tone: "raid"
  },
  {
    title: "NIGHT RACE",
    text: "Motogang blokuje jižní tah a bere sázky na průjezd.",
    time: "13:21",
    symbol: "◆",
    tone: "race"
  },
  {
    title: "HARBOR LOCKDOWN",
    text: "Přístav zavírá sklady po sérii falešných manifestů.",
    time: "13:58",
    symbol: "▤",
    tone: "raid"
  },
  {
    title: "DISTRICT BLACKOUT",
    text: "Výpadek proudu skrývá pohyb gangů v severním sektoru.",
    time: "14:36",
    symbol: "▧",
    tone: "blackout"
  },
  {
    title: "SPY NETWORK",
    text: "Informační síť prodává čerstvé lokace slabých hráčů.",
    time: "15:05",
    symbol: "◎",
    tone: "intel"
  },
  {
    title: "BOUNTY SIGNAL",
    text: "Na tabuli přibyla odměna za hráče s vysokým heatem.",
    time: "15:47",
    symbol: "⊕",
    tone: "bounty"
  },
  {
    title: "MARKET CRASH",
    text: "Ceny surovin kolísají po výprodeji špinavých zásob.",
    time: "16:12",
    symbol: "↯",
    tone: "market"
  },
  {
    title: "CHEM CLOUD",
    text: "Toxický mrak se drží u staré fabriky a láká riskantní loot.",
    time: "16:53",
    symbol: "☣",
    tone: "toxic"
  },
  {
    title: "TURF CLAIM",
    text: "Chrome Choir vyvěsil barvy na hranici cizího districtu.",
    time: "17:24",
    symbol: "✦",
    tone: "war"
  },
  {
    title: "CONVOY MOVE",
    text: "Ozbrojený konvoj veze materiál přes Industrial ring.",
    time: "18:08",
    symbol: "▰",
    tone: "supply"
  },
  {
    title: "CLUB FRONT",
    text: "Noční klub pere hotovost a na chvíli zvedá vliv.",
    time: "18:39",
    symbol: "◈",
    tone: "social"
  },
  {
    title: "SERVER NOISE",
    text: "Městská síť šumí. Některé falešné stopy mohou být pravé.",
    time: "19:17",
    symbol: "⌬",
    tone: "hack"
  },
  {
    title: "RED NOTICE",
    text: "Hledaný boss byl zahlédnut u hranice Downtownu.",
    time: "20:02",
    symbol: "×",
    tone: "alert"
  }
]);

export const eventAgents = Object.freeze([
  Object.freeze({ id: "victor", name: "Victor Grave Kadeř", tasks: victorGraveEvents }),
  Object.freeze({ id: "leon", name: "Leon Switch Varga", tasks: leonSwitchVargaEvents }),
  Object.freeze({ id: "nira", name: "Nyra Vale", tasks: nyraValeEvents })
]);

export const eventTasks = Object.freeze({
  victor: victorGraveEvents,
  leon: leonSwitchVargaEvents,
  nira: nyraValeEvents
});

export const eventsData = registerEmpireData("events", Object.freeze({
  loginActiveEvents: LOGIN_ACTIVE_EVENTS,
  eventAgents,
  eventTasks,
  victorGraveEvents,
  leonSwitchVargaEvents,
  nyraValeEvents
}));
