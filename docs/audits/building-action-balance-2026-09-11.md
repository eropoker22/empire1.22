# Audit odměn, rizik a významu speciálních akcí budov

Výchozí commit: `ca7f6069bbe3cecfc3e3418b5e9428928de7ed39` (`main`). Rozsah: všech 40 příkazových akcí v konfiguraci FREE a jejich návaznosti na 32 typů budov. Datum: 11. 9. 2026.

Audit našel skutečné chyby v oceňování, zapojení odměn i násobení bonusů. Opravy a úpravy níže tvoří návrh vyvážení pro testování. Výsledky lidské partie z těchto výpočtů nevyplývají.

## Co bylo chybně a co se mění

### 1. Dealeři vykupovali látky hluboko pod cenou celé výroby

Původní cena byla 125 % samotného poplatku laboratoře. Chemikálie a biomasa se vůbec nepočítaly. Ani před rizikem a praním tedy nešlo o smysluplný výrobní řetězec.

| Látka | Úplná výrobní cena v clean | Původní výkup v dirty | Nový výkup v dirty |
|---|---:|---:|---:|
| Neon Dust | 1 220 | 625 | 2 196 |
| Pulse Shot | 1 940 | 1 000 | 3 492 |
| Velvet Smoke | 2 100 | 1 125 | 3 780 |

Nová výkupní cena je **180 % celé nominální výrobní ceny**. Obsahuje prostor pro praní a riziko, ale výroba dál spotřebovává peníze, materiály a čas. Minimum 10 kusů, HEAT za každý kus, incidenty a čekání mezi prodeji zůstávají. Při minimální dávce je základní pouliční riziko 14/16/18 %, nikoliv pouze 4/6/8 %: server přičítá také počet prodávaných kusů. Potom vstupuje síť, fáze a případný otevřený kanál; strop je 35 %.

Po samotném 15% poplatku za praní činí hrubá marže na kus přibližně 647/1 028/1 113 clean. To ještě není čistý zisk: chybí incidenty, omezení velikosti praní, jeho HEAT, audity a případná policejní opatření. Při úmyslně opatrném ocenění dirty na 70 % clean je marže před těmito náklady 317/504/546 clean.

Validátor nově porovnává ceny s rekurzivně oceněným výrobním řetězcem. Budoucí změna ceny vstupů proto nemůže tiše ponechat starý nesmyslný výkup. Black market má vlastní přirážky a nedává bezrizikový převod nakoupených drog na zisk; příležitostné obchody je přesto nutné sledovat v lidské partii.

### 2. Otevřený kanál přidával riziko dealerů dvakrát

Příprava prodeje již do `streetRiskPct` zahrnovala příspěvek kanálu. Vyhodnocení incidentu ho přičetlo znovu. Report tak mohl ukazovat menší riziko, než server skutečně použil. Vyhodnocení nyní použije uložené výsledné riziko přesně jednou. Zůstává zvýšený HEAT i odlišné události kanálu.

### 3. Expresní dovoz používal historické ceny a rozdával drahé položky zdarma

Například Tech Core se při sestavení zásilky oceňoval na 85 místo 2 100, Combat Module na 160 místo 7 900 a Defense Tower na 800 místo 22 100. Navíc `Math.max(1, ...)` zaručoval minimálně jednu položku každého typu bez ohledu na rozpočet. Ani velmi malý podíl rozpočtu tak nezabránil bezplatné bazuce nebo věži.

Nový generátor rozděluje jeden omezený rozpočet podle skutečných receptů. Vybírá pouze položky, které si zbývající rozpočet může dovolit. Když se nevejde žádná, končí. Drahou položku nevytvoří jen proto, že je v kategorii. Chybná konfigurace bez dosažitelné položky selže výslovně.

Cena dovozu zůstává 2 000 clean, základní HEAT +6, celní kontrola 10 %, při ní dodatečných +10 HEAT a redukce kusů o 25 % se zaokrouhlením dolů. U jednotlivého kusu může kontrola zabavit celý kus. Dovoz je okamžitý; opraven je i zastaralý popis čekání. Pevné texty výběru Strip Clubu a prodeje přebytku už neopakují neaktuální částky či HEAT před fázovými a frakčními úpravami; přesná výsledná čísla obsahuje strukturovaný report.

| Kategorie | Rozpočet podle receptů | Průměrná hodnota bez kontroly | Očekávaná hodnota včetně 10% kontroly |
|---|---:|---:|---:|
| Materiály | 3 000–4 000 | 3 385 | 3 278 |
| Vzácné díly | 4 200–6 000 | 4 200 | 3 990 |
| Zbraně | 3 000–4 200 | 3 328 | 3 071 |
| Obrana | 3 000–4 200 | 3 030 | 2 775 |

Jde o 1 000 deterministických zásilek na kategorii. Hodnota je výrobní cena, nikoliv prodejní výnos. Vzácné díly nyní v těchto limitech znamenají dva Tech Core; Combat Module se do rozpočtu nevejde. Vrcholné zbraně a věže má hráč vyrábět nebo získat odpovídajícím drahým obchodem. Zaplněný sklad nadále vede k odmítnutí importu bez odečtení ceny.

### 4. Černý charter byl zaplacený stav bez slíbené obchodní slevy

Akce ukládala metadata nabídky, ale nákupní cena je nepoužívala. Nově nákup a přehled ceny započítají dalších 6 procentních bodů slevy na podporované položky aktuální nabídky černého trhu. Charter stojí 1 000 dirty místo 2 500 a trvá 8 minut.

Celní riziko 15 % při takovém nákupu skutečně funguje: přidá 10 HEAT a zprávu k výsledku nákupu. Tato kontrola nezabavuje koupený předmět; ostatní běžná rizika trhu zůstávají. Sleva se neuplatní po expiraci, při policejně zablokovaných letištních slevách, u jiného hráče ani u nepodporované položky. Charter nepřeskakuje rotaci nabídky a negeneruje skladové kusy.

Z nabídky charteru byly odstraněny Cameras a Defense Tower, protože je současný černý trh vůbec neprodává. Podporované položky jsou Tech Core, Combat Module, SMG, Bazooka, Ghost Serum a Overdrive X. Akce má význam před větším plánovaným nákupem, ne před nákupem jedné levné věci. Při přímé 6% úspoře odpovídá cena 1 000 dirty objemu zhruba 16 667 dirty; přesný práh ovlivní ostatní slevy a zvolená měna.

### 5. Některé příjmové bonusy se násobily dvakrát a zasahovaly sousední budovy

Kasino, Herna, Strip Club a Zákulisní tlak už počítají bonusy přes metadata budovy či hráče. Současně se ukládal efekt districtu a výpočet ho násobil znovu. Například příslib +70 % u VIP noci mohl na vlastním kasinu vytvořit násobek 1,7 × 1,7 = 2,89. Efekt navíc zasahoval další podniky ve stejném districtu.

Nyní se tyto příjmové značky při obecném násobení districtu vynechají. Zůstávají dostupné pro zobrazení a funguje i načtení staršího uloženého stavu. Skutečný bonus se započte jednou v příslušné vrstvě.

Restaurace měla bonus pouze v districtovém efektu, proto dostala výslovné použití na konkrétní zdrojovou restauraci. Krýt schůzky tak zvedá její příjem, ne příjem sousední banky. Lokální síť podporuje vliv konkrétní restaurace. Stejný aktivní efekt jedné restaurace se sám se sebou nenásobí. Zákulisní tlak si zachovává zamýšlený dopad na produkci vlivu všech vlastněných budov.

Tato oprava snižuje chybně nafouknuté výnosy. Původní hrubé peněžní odhady těchto bonusů proto nelze bez úpravy převzít ze starších auditů.

## Větší odměna za jedno použití, rozumné hodinové tempo

Tabulka používá základní násobitel FREE cooldownu 0,8. Nezahrnuje frakci, další síťové slevy, omezení den/noc ani následky policie. „Hodina“ zde znamená hodinu, během které je akce dostupná. Čistý ekvivalent oceňuje dirty koeficientem 0,7 a materiály celým receptem; vliv není převeden na peníze.

| Akce | Předtím za použití | Nyní za použití | Čekání FREE před → po | Ekvivalent za dostupnou hodinu před → po |
|---|---|---|---|---:|
| Restaurace: tržby | 869 clean + 550 dirty | 1 800 clean + 900 dirty | 24 → 48 min | 3 135 → 3 038 |
| Strip Club: cash | 360 dirty | 1 500 dirty | 8 → 32 min | 1 890 → 1 969 |
| Přístav: kontejner | 160 dirty + 3 Metal Parts + 1 vliv | 900 dirty + 6 Metal Parts + 2 vliv | 11,2 → 32 min | 5 421 → 4 556 |
| Parlament: politické okno | 160 clean + 5 vliv | 1 600 clean + 10 vliv | 14,4 → 36 min | 667 → 2 667 |
| Elektrárna: prodej přebytku | 2 000 clean + 500 dirty | stejné | 48 → 48 min | 2 938 → 2 938 |

Parlament je cíleně posílen. Peněžní odměna 160 byla na vzácnou politickou budovu zanedbatelná a slabší než drobné tržby. Současně se snižuje množství okamžitého vlivu za hodinu: 20,83 → 16,67 před ostatními bonusy. Nejde tedy o plošné posílení všech složek.

Restaurace zachovává téměř stejný teoretický peněžní tok, ale odměna je na jedno použití podstatně hmatatelnější. Výběrové akce nevytvářejí automatickou zásobu za zmeškané cooldowny; hráč, který přijde jednou za několik hodin, vybere jednu odměnu.

## Přehled všech 40 akcí

`C` = clean cash, `D` = dirty cash, `V` = vliv districtu. Časy čekání níže jsou **základní konfigurační minuty před násobitelem FREE 0,8**; trvání efektu se tímto cooldownovým násobitelem nekrátí. Ceny, HEAT a dostupnost dále upravuje městský den/noc a příslušné bonusy. Konkrétní fázové hodnoty jsou u každé akce v číselné příloze. Noční klid očisty není totéž co městská noc.

### Finance a politické budovy: 15 akcí

| Budova / akce | Cena a hlavní přínos | Riziko a čekání | Výsledek auditu |
|---|---|---|---|
| Centrální banka — Injekce likvidity | 20 V; 2 500 C + 90 za způsobilou ekonomickou budovu, nominální strop 8 000 před synergiemi | +4 HEAT, riziková událost 6 % na 8 min; CD 20 | Zachovat. Už jde o významnou konverzi vlivu a odměna roste s infrastrukturou. |
| Centrální banka — Zmrazené účty | 2 000 C; 8 min posílené ochrany peněz a omezení finančních následků | +5 HEAT, riziko 8 %, dražší obchod; CD 24 | Zachovat jako obranu velké rezervy. Nevyplatí se malé peněžence automaticky. |
| Centrální banka — Měnová intervence | 3 000 C + 25 V; 8 min vliv na tržní kategorii a omezení burzovních výkyvů | +7 HEAT, riziko 12 %; CD 28 | Zachovat jako strategický zásah. Příjem není přímá odměna. |
| Radnice — Úřední krytí | 1 500 C + 25 V; 8 min slabší vznik HEAT, kontrol a drbů | +2 HEAT, riziko 8 %; CD 20 | Zachovat před intenzivní sérií akcí. Nezaměňovat s vymazáním existujícího HEAT. |
| Radnice — Městská zakázka | 20 V; 1 500 C + 120 za legální budovu, nominální strop 6 500 před synergiemi | +3 HEAT, riziko 6 % na 8 min; CD 18 | Zachovat. Počet budov a cena místního vlivu jsou důležitější než samotný základ 1 500. |
| Radnice — Nouzový dekret | 2 500 C + 40 V; 6 min zvoleného politického režimu | +8 HEAT, riziko 12 %; CD 28 | Zachovat cenu, ale sledovat využití. Krátké okno vyžaduje správné načasování; některé vedlejší konfigurační přísliby nejsou plně zapojené. |
| Lobby klub — Zákulisní tlak | 1 200 C + **8 V místo 25**; **20 min místo 8**, produkce vlivu +18 %, další politické slevy a omezení drbů | +3 HEAT, riziko 8 % během účinku; CD **40 místo 20** | Posílená strategická příprava s delší prodlevou. Bonus vlivu opraven na jediné započtení. |
| Lobby klub — Tiché vyjednávání | **800 C + 5 V místo 1 500 C + 15 V**; jeden vhodný zbývající cooldown −20 %, další vlivová sleva, dočasně nižší riziko | +2 HEAT, riziková událost 6 %, CD 24 | Původní cena byla vysoká proti ušetřeným minutám a malé následující slevě. Akci je vhodné použít, když skutečně existuje důležitý cooldown. |
| Lobby klub — Mediální clona | **800 C místo 2 000**; **15 min místo 8**, omezení negativních drbů o 35 procentních bodů před součtem ostatních ochran a limitem | +4 HEAT, riziko 7 %; CD **30 místo 26** | Levnější informační obrana. Popis omezen na skutečně zapojený účinek. |
| Burza — Spekulativní nákup | Poplatek 750 C + investice do 10 000; 65 % příznivý, 25 % neutrální, 10 % nepříznivý výsledek | +5 HEAT, riziková událost 6 % na 8 min; CD 16 | Zachovat. Při 10 000 je základní očekávaný čistý výsledek +1 300 před policií, při malé investici může být záporný. |
| Burza — Tlak na trh | 3 000 C + 15 V; 10 min pump +12 % / dump −10 % vybrané kategorie, menší dopad na black market | +8 HEAT, riziko 12 %; CD 22 | Zachovat. Zhodnotit společně s obchodním objemem a možným prospěchem soupeřů. |
| Burza — Vnitřní tipy | **750 C místo 1 500**; **16 min místo 6**, šance spekulace +12 bodů a další sleva/hinty | +4 HEAT, riziko 10 %; CD **30 místo 18** | Okno pokryje až dvě základní spekulace. Jedna malá spekulace cenu sama neobhájí. |
| Letiště — Expresní dovoz | 2 000 C plus případná dřívější dovozní penalizace; okamžitá rozpočtově omezená zásilka | +6 HEAT; 10 % kontrola, +10 HEAT a ztráta kusů; CD 18 | Opraveno neomezené rozdávání drahého vybavení. |
| Letiště — Černý charter | **1 000 D místo 2 500**, 8 min skutečné další slevy 6 bodů na podporované aktuálně dostupné nabídky | +9 HEAT při otevření; 15 % kontrola při nákupu, +10 HEAT; CD 24 | Nově skutečně zapojená sleva i riziko. |
| Letiště — Evakuační koridor | 1 800 C; 7 min podpory nově zahájených útoků, +18 bodů k úniku, omezení ztrát vybavení v příslušném výsledku | +5 HEAT; CD 26, také běžné celní kontroly budovy | Zachovat okno: podpora se čte při zahájení útoku. Není nutné bezdůvodně prodlužovat na dobu celé operace. Odstraněn příslib nezapojené návratové logistiky. |

### Obchodní a noční podniky: 15 akcí

| Budova / akce | Cena a hlavní přínos | Riziko a čekání | Výsledek auditu |
|---|---|---|---|
| Přístav — Proříznout kontejner | Zdarma; 900 D, 6 Metal Parts, 2 V | +6 HEAT; CD 40 | Větší jednorázová zásilka a pomalejší opakování; skladové limity zůstávají. |
| Parlament — Politické okno | Zdarma; 1 600 C a 10 V | +5 HEAT; CD 45; pouze městský den | Posílit slabou peněžní odměnu, omezit frekvenci vlivu. |
| Restaurace — Vybrat tržby | Zdarma; 1 800 C + 900 D | +5 HEAT; CD 60; pouze městský den | Vyšší odměna na kliknutí při téměř stejném hodinovém tempu. |
| Restaurace — Krýt schůzky | Zdarma; +8 V a příjem vlastní restaurace ×1,18 po 30 min | +4 HEAT; CD 45 | Čísla zachovat, opravit rozsah na konkrétní restauraci. |
| Restaurace — Posílit lokální síť | Zdarma; **+10 V místo 4**, vlastní produkce vlivu **×1,5 místo 1,12** po 30 min | **+5 HEAT místo 8**; CD **45 místo 30** | Akce má nově lepší vliv než krytí schůzek, ale nemá jeho peněžní bonus a vytváří více HEAT. |
| Herna — Noční automaty | Zdarma; clean ×1,35, dirty ×1,65, vliv ×1,15 po **20 min místo 7** | Pasivní HEAT ×1,45, audit +4 body; CD **45 místo 16**, městská noc | Delší smysluplná návštěva. Opraveno dvojí násobení. |
| Herna — Zadní pokladna | Vypere 13 % aktuálního dirty, min. 500 a max. 3 800, poplatek 15 %, +1 V | +3 HEAT, auditní příspěvek +3 body na 8 min; CD 16 | Zachovat jako dostupnou menší pračku. Hodnota závisí na objemu. |
| Kasino — Tichá herna | Vypere 24 % dirty, min. 1 500 a max. 18 000, základní poplatek 9 %, +3 V | +7 HEAT, audit +6 bodů na 10 min a objemová rizika; CD 14 | Zachovat velkoobjemovou roli. Nelze ji hodnotit jako odměnu bez odečtení dirty. |
| Kasino — VIP noc | Zdarma; clean ×1,7, dirty ×1,55, vliv ×1,25 po 10 min | Pasivní HEAT ×1,6, audit +8 bodů; CD 26, městská noc | Opravit dvojí násobení. Skutečných +70 % čistého příjmu je stále silných. |
| Kasino — Podplacený inspektor | 6 500 C; úspěch −15 HEAT, +4 V a 30 min relativně nižší auditní riziko | Základní selhání 14 %, při něm +12 HEAT a vyšší auditní riziko; CD 75 | Zachovat nedávné přecenění. Hodnota je zejména ochrana při praní, ne nejlevnější jednorázové chlazení. |
| Směnárna — Výhodný kurz | Vypere 16 % dirty, min. 800 a max. 6 000; poplatek 12 %, +3 V | **+6 HEAT místo 12**, audit +4 body na 8 min; CD 18, městský den | Riziko sníženo vzhledem k objemu a horšímu poplatku než kasino. |
| Strip Club — Vybrat cash | Zdarma; 1 500 D, ve slabší denní fázi základně 1 275 D | +5 HEAT před fází; ve dne vyšší; CD 40 | Výraznější odměna, méně opakování. |
| Strip Club — Hostit VIP klienty | 800 C; clean ×1,45, dirty ×1,35, vliv ×1,55 po 30 min | Pasivní HEAT ×1,5 a více drbů; CD 60, městská noc | Zachovat cenu, opravit dvojí násobení. |
| Strip Club — Soukromá party | **900 C místo 1 500**, **12 V místo 8**, tvorba vlivu ×1,7 po 10 min | +6 HEAT před fází, extra drb 45 %, skandál 12 % se ztrátou 4 V a dalšími +10 HEAT před dalšími úpravami; CD 30 | Lepší placená cesta k vlivu a kontaktům, zachované skutečné riziko. Opraveno dvojí násobení produkce vlivu. |
| Pouliční dealeři — Prodat zásobu | Nejméně 10 kusů dostupné látky; cena 180 % plného receptu v dirty | HEAT 2/3/4 za kus před úpravami; riziko roste s dávkou, max. 35 %; slotové CD 4/5/6 min před síťovým zrychlením | Opraven výkup i dvojí příspěvek kanálu do incidentu. Slotový cooldown není obecný cooldown akce ×0,8. |

### Obyvatelé, výroba a obnova: 10 akcí

| Budova / akce | Cena a hlavní přínos | Riziko a čekání | Výsledek auditu |
|---|---|---|---|
| Bytový blok — Vybrat obyvatele | Zdarma přesune celé uložené obyvatele; základní zásobník 180 | Bez HEAT, bez obecného cooldownu; ochrana proti dvojímu výběru v jednom ticku | Zachovat. Není to tlačítko vytvářející obyvatele z ničeho. |
| Večerka — Vybrat obyvatele | Zdarma přesune uložené obyvatele; základní zásobník 100 | Bez HEAT, ochrana proti dvojímu výběru | Zachovat. |
| Škola — Vybrat obyvatele | Zdarma přesune celé uložené obyvatele; základní zásobník 60 | Bez HEAT, ochrana proti dvojímu výběru | Zachovat. Zobrazení zásobníku řeší samostatná předchozí UI oprava. |
| Škola — Večerní kurz | 1 000 C; 20 min rychlejší nábor v bytových blocích o 60 % | Bez přímého HEAT; CD 35 | Zachovat. Přínos vyžaduje bytové bloky a volné místní zásobníky. |
| Klinika — Stabilizační protokol | 1 200 C; obnova způsobilých nedávných ztrát, základ 15 %, síť až 40 % | +1 HEAT; CD 18; zásobník ztrát expiruje po 90 min, některé ztráty mají omezení | Zachovat. Při velkých ztrátách silná návratnost; důležitý je skutečný dostupný výstup před potvrzením. |
| Recyklační centrum — Vytěžit ztráty | 900 C; obnova způsobilých předmětů, základ 12 %, síť až 34 % | +2 HEAT; CD 16; zásobník ztrát 18 min | Zachovat jako rychlou reakci po boji. Nevrací lidi. Krátká expirace je záměrný tlak na přítomnost, který je vhodné změřit s lidmi. |
| Energetická stanice — Záložní síť | 3 500 C; 25 min infrastruktura +12 bodů, kamery/alarmy +20 %, výrobní podpora | +3 HEAT; CD 60 | Zachovat síťovou/obrannou roli. Bez zásobené výroby nebo připravené obrany není automaticky výhodná. |
| Energetická stanice — Prodat přebytek | Zdarma; 2 000 C + 500 D | +10 HEAT; CD 60 | Čísla zachovat. Opravit zprávu: prodává přebytek, nezrychluje výrobu. |
| Energetická stanice — Snížit HEAT | **5 000 C místo 10 000**; −20 hráči i konkrétnímu districtu | CD 60, bez vlastního náhodného selhání, nezruší probíhající razii | Poloviční cena a pravdivý popis rozsahu. Obecné snížení za clean má jinou cenu za bod i vlastní rizika a cooldown. |
| Pašovací tunel — Otevřít kanál | **900 C místo 1 800**, **30 min místo 15**; +45 % dirty produkce celé sítě a kratší slotová prodleva dealerů | +5 HEAT před fází; dealerům vyšší HEAT a +5 bodů incidentu; CD **60 místo 30**, globálně se nesčítá | Základní bonus jednoho tunelu dává 729 D za okno místo 365 D. Dva tunely se síťovým bonusem dávají asi 1 531 D; role se projeví už u malé sítě. |

## Další závěry a otevřená omezení

- Vliv se u těchto akcí přičítá a utrácí v příslušném districtu. Nesmí se automaticky zaměnit s libovolnou položkou `balances.influence` nebo s možností platit lokální akci celým součtem mapy. Některé velké peněžní akce jsou proto reálně omezené místním vlivem, ne pouze cooldownem.
- Riziková událost 6 % na 8 minut není totéž jako jednorázová 6% šance selhání tlačítka. Banka, burza, kasino a politické budovy mají periodické kontroly, součty rizik a následky. Delší účinek může znamenat více kontrol. V tabulkách je to odlišeno od okamžitého hodu na dovoz, dealery či skandál party.
- Platí také pasivní příjmy a synergie budov. Změny tohoto auditu se netýkají celé mapy, startovního balíčku, cen všech receptů ani celého policejního plánovače.
- Config stále obsahuje některá budoucí/částečná pole. Například letištní návratová rychlost a redukce ztrát lidí nejsou v současném bojovém vyhodnocení připojené stejně jako únik a výzbroj. Mediální clona nemá doložený samostatný účinek policejního varování +6 % ani přepisu slabých drbů. Tyto přísliby nejsou použity jako důvod vyšší ceny a byly odstraněny z upravovaných popisů akcí. Samotná přítomnost čísla v konfiguraci není důkaz fungující mechaniky.
- Žádnou z 40 akcí jsem nepřidal pouze pro zvýšení počtu tlačítek. Ostatní typy budov mají výrobu, pasivní bonusy, informace, upgrady nebo skladování. Není potřeba nutit každé budově hotovostní tlačítko.
- Slabý je stále přehled čistého ekonomického výsledku složitějších akcí. U spekulace je žádoucí ukazovat také investici, poplatek a čistý výsledek, u podpory její příjemce a u obnovy reálnou zásobu obnovitelných ztrát. Tato práce není kompletním přepracováním všech potvrzovacích oken.

## Jak ověřit návratnost s lidmi

Pro první dva testy s 20 hráči ukládat za každé `actionId` počet použití, počet unikátních hráčů, skutečné odečty/přípisy, okamžitý HEAT, následné kontroly, odmítnutí a množství vlastněných podpůrných budov. Rozdělit výsledky alespoň na začátek, prostředek a finále a podle frakce. Měřit i dostupné příležitosti: vzácnou budovu nemůže používat všech 20 hráčů.

Zvlášť sledovat, zda přecenění dealerů nevytváří dominantní řetězec, zda dovoz dvou Tech Core není ve finále nejvýhodnější opakovanou volbou a zda lidé používají podpůrné akce před důležitou operací. U burzy sledovat čistý zisk po poplatcích a finančních kontrolách, ne samotnou výplatu. U restaurace a nočních klubů oddělit pasivní příjem od odměny na kliknutí.

Předchozí simulace celých zápasů byly provedené na jiných číslech. Nepotvrzují vyvážení této větve. Nová kompletní 72–96hodinová partie ani fyzický telefon v tomto auditu ověřeny nebyly.

## Reprodukce a stav ověření

Číselná příloha: [building-action-balance-numbers-2026-09-11.json](building-action-balance-numbers-2026-09-11.json). Obsahuje všech 40 akcí, samostatné denní/noční náhledy, konfigurace dynamických účinků, seznam 32 budov, úplné ceny drog a 4 000 vzorků zásilek shrnutých po kategoriích.

Obnovit výpočty: `node scripts/run-local-bin.mjs vite-node/vite-node.mjs tools/audit-building-actions.ts`.

Ověření: **184 cílených testů v 11 souborech prošlo**. Po závěrečném sjednocení rozhraní letiště a textů se znovu ověřilo 85 souvisejících případů ve třech souborech. Nové testy pokrývají rozpočty dovozu, jedno započtení rizika kanálu, skutečný nákup s charterem včetně expirace a kontroly, jediné násobení sedmi příjmových akcí a rozsah restaurace. Prošly také TypeScript, generovaná browser konfigurace, kontrola architektury a limity velikosti souborů.

Nové E2E ani simulaci celé partie jsem nespouštěl. Kontrola všech 40 akcí je audit konfigurace a konkrétních serverových cest; neznamená 40 nových živých prohlížečových scénářů. Uváděné počty nezahrnují opakované spuštění stejného testu jako nový test.

Nasazení: tato větev je samostatný návrh změn pro review a test. Neobsahuje dřívější mobilní UI opravy z PR #3. Dokud není sloučena a úspěšně nasazena, staging používá svou předchozí konfiguraci. Rozběhnuté cooldowny a uložené časované účinky se hromadně nemažou; nová pravidla se použijí při příslušných budoucích výpočtech a nových akcích.
