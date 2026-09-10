**Empire STREETS — audit průběhu války, ekonomiky, policie a strategií, 9. 9. 2026**

Tento dokument popisuje lokální pracovní verzi hry po navazujícím auditu. Výchozí commit je `7adc9182beacf0a39d8e5fff7715cd22b3852bb2`; pracovní adresář obsahuje i dřívější necommitnuté opravy. Nejde o potvrzení nasazení na staging nebo produkci. Výsledky jednotlivých kontrol a jejich omezení jsou uvedeny na konci.

Úplný popis všech mechanik je v [původním herním auditu](gameplay-audit-2026-09-09.md). [Katalog budov, akcí, frakcí a úkolů](gameplay-catalog-2026-09-09.md) obsahuje podrobnosti k 32 typům budov, 40 veřejným akcím, 21 receptům a 300 šablonám městských úkolů. Číselné změny popsané v tomto dokumentu mají přednost před starším katalogem. Aktuální úplná konfigurace je v [novém snímku konfigurace](war-balance-config-2026-09-09.json).

**1. Závěr: hra má ucelený základ, ale původní nastavení nezaručovalo třídenní válku**

STREETS spojuje územní strategii, ekonomiku, výrobu, informace, kriminalitu a postupné vyřazování. Základní smyčka funguje: získat informace, rozšířit nebo ubránit území, využít budovy, obstarat lidi a vybavení, řídit policejní tlak a přežít Očistu. Ve finále rozhoduje bodové pořadí. Samotné obsazení celé mapy nemá předčasně obejít finální vyhodnocení.

Nejvýraznější problémy byly v souhře systémů. Výroba mohla mít drahý upgrade, ale malý lokální zásobník znehodnotil jeho přínos při hodinových návštěvách. Nakoupené suroviny a investice při zpracování ztrácely bodovou hodnotu. Pasivní součet heatů velkého území mohl přivést klidného hráče k tvrdé razii. Jednotlivé boosty stály desítky tisíc v materiálu, ač jejich přínos odpovídal několika minutám práce. Původní práh finále navíc zkracoval zápas při časných porážkách hráčů.

Tyto konkrétní rozpory byly opraveny nebo přenastaveny. Přesto není poctivé označit celou hru za dokonale vyváženou. Simulace s omezenými boty nedokazuje rovné šance všech frakcí, odolnost proti každé koordinované strategii ani to, že lidé budou stejně aktivní třetí den. Podstatný rozdíl je mezi zajištěním délky zápasu a zajištěním zajímavého hraní po celou tuto dobu.

**2. Přesný start hráče a význam prvního districtu**

Pro audit a nový výchozí hosted profil platí 6 000 clean cash, 3 000 dirty cash, 150 populace a 15 vlivu. Hráč vybírá pouze rezidenční district nebo park. Zůstávají dva špionážní sloty a výchozí materiály a výzbroj definované v hosted profilu; audit k tomu potají nepřidává peníze nebo vliv na založení aliance. Individuální nastavení již existujícího serveru se změnou výchozího profilu nepřepočítává.

Původní sdílený hosted default obsahoval jen 1 500 clean, 300 dirty a nulovou populaci i vliv. To odporovalo zadanému cílovému startu. Default a základní FREE peněžní nastavení jsou nyní sjednocené se zadáním. Přihlašování stále používá ověřenou session; změna startovních hodnot nedává klientovi možnost poslat si libovolný zůstatek.

Na skutečné mapě je 41 vhodných startovních míst: 22 rezidenčních a 19 parkových. Není to 41 ekonomicky totožných začátků. Při izolovaném měření pro Mafii, s průměrem dne a noci, mají rezidenční starty hrubý clean příjem přibližně 2 435–7 502 za hodinu. Parky mají rozpětí 0–7 141. Konkrétní výsledek závisí na budovách; medián clean příjmu činí přibližně 3 410 u rezidenčního startu a 2 686 u parku.

Parky `27`, `45`, `47`, `118`, `156` v této konfiguraci nemají pasivní clean příjem ani populační budovu. Dva rezidenční a devět parkových startů nemají přímý lokální populační zdroj. Neznamená to automatickou nehratelnost: hráč má počáteční zásoby, kriminalitu, městské úkoly a možnost rozšíření. Je to však výrazně obtížnější cesta, především pro nováčka.

Moje doporučení pro startovní obrazovku je zobrazovat čistý a špinavý příjem, zdroj populace a náročnost startu ještě před potvrzením. Tiché nahrazení všech parků stejnými budovami by odstranilo význam volby. Další přidávání povinné startovní budovy nebo omezení seznamu startů je samostatná změna mapy, kterou tento audit neprovedl. Tento rozdíl zůstává uvedený jako otevřená otázka férovosti, nikoli jako údajně vyřešený problém.

**3. Jak by měl probíhat zápas**

První hodiny slouží k vybudování základny. Hráč musí zjistit, kde získá populaci, odkud potečou peníze a jaké sousední území má smysl špehovat. Výchozí populace dovoluje několik raných akcí, ale nelze ji chápat jako neomezenou armádu. Obsazení běžného neutrálního districtu vyžaduje populaci a vliv, předchozí úspěšný průzkum a čas na dokončení. Část populace se při úspěchu vrací, neúspěch má skutečnou cenu.

První Očista má v běžném FREE nastavení začít po osmi hodinách, další mají čtyřhodinový interval. Mezi půlnocí a šestou ráno v `Europe/Bratislava` se vyřazování odkládá. Tato noční ochrana neznamená automatické zastavení ekonomiky, výroby, všech útočných akcí nebo policejních mechanismů.

Ve střední části zápasu mají vzniknout specializace: výrobní základny, informační síť, finanční centra, logistika a vojenské skupiny. Aliance poskytuje koordinaci a spolupráci, ale jednotliví členové stále musí plnit pravidla hry. Vliv má být skutečným rozhodováním mezi růstem, diplomacií a policejní kontrolou.

Nově mají servery s alespoň 16 hráči v základně registrace časové okno finále. Při dosažení finálního počtu přeživších může Final Lockdown začít nejdříve po 60 hodinách; nejpozději se spustí po 78 hodinách, i když přežívá více hráčů. Následuje 12 aktivních hodin finále, které se během nočního klidu neodečítají. Registrace musí být uzavřená. Malé servery se tímto pravidlem nenatahují na tři dny. Jediný přeživší může zahájit finále dříve.

V běžném kalendářním scénáři tím vzniká rámec přibližně 72–96 hodin. Není to univerzální záruka pro libovolné administrátorské zásahy, neuzavřenou registraci nebo všechny kalendářní hranice. Přesné modelované délky a skutečné běhy jsou v závěrečné tabulce. UI vysvětluje časové okno; hráč nemá vidět jen nesrozumitelné čekání po dosažení Top 8.

**4. Peníze a skutečný příjem z budov**

Clean cash jsou hlavní prostředek rozvoje: platí se jimi výrobní práce, upgrady, část nákupů, finanční akce a čistá cesta ke snížení heatu. Dirty cash jsou výnosný, ale rizikovější zdroj, který lze použít přímo nebo vyprat. Převod není zdarma a vyšší aktivita zvyšuje riziko kontrol.

Příjem z území nelze správně posuzovat jen podle jedné kartičky. Do výsledku vstupují konkrétní budovy, síťové bonusy, frakce, den či noc, aktivní akce, stav districtu, stabilizace po obsazení a dočasné postihy. UI musí ukazovat efektivní hodnoty. Nestačí, aby karta hezky popsala samotný základ.

Osm statických portfolií skutečných sousedících districtů ukazuje hrubé tempo ekonomiky. Tři běžné rezidenční distrikty v jednom vzorku dávají přibližně 9 422 clean a 4 180 dirty za hodinu; pět 22 165 clean a 12 867 dirty. U parkové větve vychází tři distrikty asi na 15 024 clean a 4 180 dirty. Deset districtů ve dvou vzorcích dosahuje přibližně 50–54 tisíc clean za hodinu.

To nejsou výdělky automaticky dosažitelné každým hráčem ani prognóza, že někdo získá deset districtů během prvního dne. Jde o plně vlastněná portfolia, s hrubým příjmem před běžnými výdaji. Nelze vynásobit nejvýnosnější portfolio 72 hodinami a vydávat výsledek za důkaz vyváženosti skutečného zápasu.

Downtown je výrazně silnější. Samotný základ Centrální banky představuje 9 600 clean za hodinu před dalšími násobiteli, Burzy 13 200. Bankovní úroky mají navíc interval a strop. Při dostatečném zůstatku může základní úrokový strop znamenat dalších 15 000 za hodinu. Takové budovy jsou strategickým cílem, ne běžným startovním příjmem.

Paušální zlevnění všech upgradů nebo plošné zdvojnásobení příjmů by nyní spíše zrychlilo náskok silného hráče. Proto byly příjmy zachovány a opravila se konkrétní nesrovnalost populačního bonusu Kultu ve Večerce. Skutečná výroba populace, její projekce a údaj v kartě nyní používají stejný bonus.

**5. Populace: omezení přesunuto z neustálého klikání na rozhodování**

Populace je především kapacita akcí, obnova gangu a část bodové hodnoty. Obyvatelé uložené v budově nejsou automaticky dostupní v horní liště: do aktivního gangu se přesunou vyzvednutím. To je odlišný případ od vracejícího se špiona, který má být po dokončení ihned znovu použitelný, pokud nebyl zajat.

Původní bytový dům dával dvě populace za minutu, ale měl zásobník jen 50. Naplnil se zhruba za 25 minut. Při hodinových návštěvách tak skutečný výběr odpovídal maximálně 50 za hodinu, přestože výrobní rychlost byla 120. To bylo pro několikadenní hru příliš svazující.

Bytový dům má nyní základní zásobník 180, Večerka 100 a Škola 60. Základní rychlosti se nemění. Bytový dům bez dalších bonusů pokryje 90 minut, Večerka přibližně dvě hodiny; škola má delší rezervu podle denní fáze. Vyšší kapacita není automatický populační bonus. Stále je nutné lidi vyzvednout a dlouhá nepřítomnost má důsledek, jen už nemá tak silnou výhodu hráč s budíkem po 25 minutách.

**6. Sklady a výrobní fronty**

Hra rozlišuje lokální výstup výrobní budovy, předplacenou výrobní frontu a globální inventář hráče. Tyto tři vrstvy mají odlišnou úlohu. Sklad zvyšuje limity inventáře, ale neznamená automatické vyzvednutí hotové produkce. Fronta rezervuje cenu předem; její velikost sama o sobě nic nevyrábí zdarma.

Globální základní limity jsou 60 kusů pro hromadné, 24 pro taktické a 8 pro strategické položky. Jde o limit každé položky v příslušné skupině, nikoli společných 60 míst pro všechny materiály. Jeden Sklad zvedá tyto limity na 90/36/12. Pět Skladů při nejvyšší úrovni v síti dosahuje zhruba 160/64/22. Kapacitu neurčuje součet úrovní všech Skladů; důležitá je nejvyšší úroveň a počet budov podle konfigurace.

Lokální výrobní zásobníky byly sjednoceny na 60/24/8 podle stejného zařazení položek. Fronta má kapacitu lokálního zásobníku plus tři kusy. Například Chemicals se na úrovni 1 plní asi 110 minut místo 22; Tech Core přibližně 176 minut místo necelých 37. Vysoké upgrady a bonusy tento čas zkracují, ale přínos už se neztrácí jen kvůli původnímu malému zásobníku.

Průběžná maximální rychlost výroby se touto změnou nezvýšila. Zvýšila se využitelná výroba pro hráče, který se nepřihlašuje každých pár minut. Cena velké předplacené fronty, dostupnost vstupů, přesun do inventáře a odběr zboží zůstávají omezeními. Není důvod současně automaticky navyšovat i celý globální sklad bez měření dalšího dopadu.

**7. Výrobní řetězce, čas a upgrady**

Úplná hodnota receptu zahrnuje i jeho vstupy. Tech Core nestojí jen přímých 900 clean: potřebuje čtyři Metal Parts po 300, tedy celkem 2 100. Bojový modul stojí 7 900 po započtení všech předchozích výrobních kroků. Ghost Serum má úplný náklad 6 880, Overdrive X 10 640 a Obranná věž 22 100.

Právě úplné náklady jsou použity při hodnocení zásob a boostů. Přímá hotovostní cena na poslední lince je užitečná pro konkrétní tlačítko, ale není správným měřítkem výhodnosti celého řetězce.

Časová zvýhodnění se skládají podle typu účinku. Bonus rychlosti se násobí s dalšími násobiteli rychlosti; zkrácení doby má vlastní koeficient. Například rychlost 1,10 za upgrade a 1,25 za boost dává rychlost 1,375, tedy dobu přibližně 72,73 % základu před dalšími vlivy. Nelze bez rozlišení sečíst všechny procentní popisky. Den, noc, frakce, síť budov a zvláštní akce musí dojít do stejného výsledného serverového výpočtu jako do UI.

Výrobní budovy mají maximální úroveň 14. Cena rozvoje zůstává progresivní. Továrna stojí na první upgrade 5 000, souhrn do úrovně 6 přibližně 62 400 a do úrovně 14 přibližně 1 581 700. U všech čtyř výrobních typů dohromady představuje dotažení jednotlivých budov na maximum asi 4,42 milionu clean. Úroveň 14 je luxusní specializace, nikoli doporučený cíl každého hráče během jednoho zápasu.

Pro běžnou hru doporučuji první den investovat do několika užitečných nižších upgradů, druhý den rozvíjet zvolený řetězec a teprve pak řešit vysoké úrovně. To je doporučení, ne pevný zámek úrovní podle dne. Drahý upgrade se má odvíjet od odbytu, velikosti zásob a předpokládaného zbývajícího času zápasu.

**8. Boosty po úpravě**

| Boost | Úplná cena dříve | Úplná cena nyní | Aktivní doba nyní | Cooldown | Účinek |
|---|---:|---:|---:|---:|---|
| Ghost Network | 22 640 | 8 080 | 20 min | 35 min | Špionáž −35 % času, lepší intel, nižší riziko kritického selhání |
| Industrial Overdrive | 44 580 | 7 480 | 30 min | 45 min | Výrobní rychlost ×1,25 |
| Tactical Grid | 58 100 | 13 580 | 40 min | 60 min | ×1,12 pro příští platný PvP boj |

Ghost Network stojí 1 200 clean a jedno Ghost Serum. Industrial Overdrive stojí 1 500 clean, dva Pulse Shoty a jeden Tech Core. Tactical Grid stojí 2 500 clean, jedno Ghost Serum a dva Tech Core. Základní síla efektů nebyla navýšena.

Industrial Overdrive dříve za 12 minut poskytoval každé nepřetržitě pracující lince jen tři dodatečné minuty základní výrobní práce, přitom spotřeboval materiál za desítky tisíc. Nyní dává při stejné síle efektu 7,5 minuty dodatečné práce. Pořád se vyplatí hlavně souběžně zásobené síti, ne prázdné lince.

Tactical Grid měl aktivní okno 20 minut, zatímco běžný útok potřebuje 22 minut. Nových 40 minut poskytuje prostor pro dokončení běžně zahájeného útoku. Po platném boji se spotřebuje, po nevyužité expiraci se cena nevrací. Současně lze mít aktivní jen jeden protokol; rozhodování mezi výrobou, průzkumem a bojem zůstává součástí strategie.

Byla opravena i lokální kompatibilita Tech Core a Bojového modulu: platba nesmí smazat ostatní historicky uložené tovární zásoby jen proto, že se odečítá jedna položka.

**9. HEAT bez samovolného ochlazování**

Postupný časový pokles heatu je vypnutý. Čekání nebo obnovení stránky samo o sobě hráčův heat nesnižuje. Ke změně dochází herní akcí nebo konkrétním policejním důsledkem. Odpočítávání cooldownu a ubývání krátkodobého auditního rizika nejsou ochlazování heatu.

| Metoda v okně HEAT | Cena | Snížení hráčova heatu | Vlastní cooldown | Základní riziko auditu |
|---|---:|---:|---:|---:|
| Dirty cash | 2 500 | 15 | 20 min | 20 % |
| Clean cash | 5 000 | 25 | 30 min | 5 % |
| Vliv | 20 | 25 | 45 min | 0 % |

Mezi kterýmikoli dvěma metodami je společný cooldown deset minut. Peněžní zásahy z posledních třiceti minut přidávají k dalšímu peněžnímu zásahu pět procentních bodů auditního rizika, maximálně do nastaveného stropu 50 %. Použití vlivu vlastní audit nemá.

Audit po peněžním zásahu přidá pět heatu a může odečíst pokutu do 25 % ceny této akce, maximálně do dostupného zůstatku příslušné měny. Proto je horní běžná pokuta 625 dirty nebo 1 250 clean. Zůstatek nesmí klesnout pod nulu. Samotné snížení heatu proběhne i při auditu; výsledek tedy může být menší čisté snížení. U velmi malého počátečního heatu může přidaný auditní heat převážit, což správně ukazuje historie.

Vliv se skutečně odečítá z vlastněných districtů. Není to pouze vizuální číslo v horní liště. Nulový heat, chybějící prostředky, neplatná metoda nebo cooldown znamenají odmítnutí bez částečné platby. Rozběhnutá razie se tímto tlačítkem neruší. UI používá serverové ceny, dostupnost, cooldown a výsledek.

**10. Férovost policie a odlišení kontroly od razie**

Policejní tlak kombinuje heat hráče a heat vlastněných districtů. Součet districtů má nyní ve FREE příspěvek omezený na 75 bodů agregovaného tlaku. Běžný růst pasivního heatu území tak sám o sobě nepřekročí hranici vysokého tlaku 115. Aktivní kriminalita, útoky a další hráčské akce nadále mohou dostat hráče do vysokého nebo extrémního pásma.

Když v plánovaném okně není vhodný rizikový cíl, záložní zásah je nyní běžná kontrola. Trvá deset minut, nebere peníze, nezabavuje materiál a neblokuje provoz. Výběr rotuje mezi způsobilými hráči a respektuje osobní cooldown; není důvod ho obcházet jen proto, aby se za každou cenu někdo potrestal. V mapě, policejním panelu a Uličních zprávách má takový případ své vysvětlení.

Skutečná razie zůstává postih za riziko. Použije správný cílový district a její následky se aplikují jednou při začátku, nikoli až po ručním zavření oznámení. Základní vysoká a extrémní razie mají významné zabavení dirty cash a zásob a mohou narušit provoz. Konkrétní procenta, stropy a ochrany jsou ve snímku policejní konfigurace; ochranné budovy zůstávají součástí výpočtu.

Časy `08:00`, `16:00`, `00:00` v policejním harmonogramu jsou městské hodiny. Herní městský den má v běžném FREE režimu čtyři reálné hodiny, takže tato tři kontrolní okna nejsou jen tři zásahy za skutečný den. V pravidelném průběhu jde o 18 plánovaných oken za 24 reálných hodin, před omezením aktivními zásahy a cooldowny. To je důležité pro posouzení četnosti policie.

Podplacený inspektor v Kasinu dostal samostatnou roli ochrany provozu. Cena klesla z 15 000 na 6 500 clean, ochrana trvá 30 minut místo 12 a základní konfigurační cooldown je 75 minut, v běžném FREE po koeficientu 0,8 přibližně 60 minut. Zachovává 14% riziko selhání a při úspěchu snižuje heat o 15. Jeho 35% omezení kasino auditu je relativní násobitel rizika, nikoli odečet 35 procentních bodů. Není to levnější náhrada všech tří tlačítek HEAT.

**11. Městské úkoly a zvláštní akce budov**

300 šablon městských úkolů není 300 současně dostupných zakázek. Dostupnost omezují kontakty, jejich časová okna, vliv, počet nabídek a jeden aktivní běh hráče. Vzácné strategické nabídky mají další limit na městský den. U odměny je důležitý okamžik vyzvednutí a volné místo v inventáři.

Při převodu odměn na plné výrobní náklady a hodnotu dirty cash 0,7 vychází běžné šablony výrazně různorodě. Peněžní ekvivalent easy úkolů má průměrnou očekávanou rychlost kolem 3 640 za hodinu, medium kolem 3 039 a hard kolem 1 745. Tento průměr počítá všechny šablony v kategorii stejně; nepopisuje skutečnou frekvenci nabídek ani chování optimálního hráče. Některé hard úkoly jsou informační a jejich finanční ekvivalent může být nulový nebo záporný. To samo o sobě neznamená, že nemají herní hodnotu.

Vzácné úkoly mají podstatně větší jednorázovou hodnotu, ale jejich krátká doba dokončení se nesmí vydávat za trvale opakovatelný hodinový příjem. Ve výpočtu jsou oddělené čistě peněžní odměny, vliv, heat a obsah odměny. Úplná tabulka 300 šablon je v číselné příloze.

U 40 veřejných akcí budov je nutné rozlišovat cenu, přímý výnos, dobu účinku a cooldown. FREE obecně aplikuje koeficient cooldownu 0,8 a zaokrouhlení na tick; některé kategorie ještě upravují synergické budovy. Proto například deklarovaných 16 minut v konfiguraci není bez dalšího přesných 16 reálných minut v každé situaci. Přiložený přehled uvádí základ i běžný FREE přepočet a upozorňuje na dynamické efekty.

Finanční specializace měla konkrétní chybu výhodnosti. Spekulativní nákup s investicí 10 000 měl při pravděpodobnostech 65/25/10 a původním poplatku 2 500 očekávaný výsledek přibližně −450 ještě před heatem a kontrolami. Poplatek je nyní 750. Výpočetní očekávání je přibližně +1 300 na akci před navazujícími riziky. Deset tisíc deterministických serverových scénářů dalo průměr +1 315,49, minimum −3 750 a maximum +3 749. Malá investice se kvůli pevnému poplatku stále nemusí vyplatit; UI už jako výchozí nenabízí nízkou částku 1 000.

U Spekulativního nákupu, inspektora, expresního dovozu a soukromé party se také odstranila možnost měnit příslušný náhodný výsledek jen volbou klientského ID příkazu. To není obecný důkaz nepředvídatelnosti veškeré náhody ve hře. Je to konkrétní oprava hranice, kde klientské ID nemá vybírat výherní výsledek.

**12. Trh, inflace a odbyt**

V součtu peněz serveru byla chyba: společné deduplikování resource state pro clean i dirty mohlo vynechat dirty cash hráče. Každá měna se nyní započítává jednou. Celková veličina pro inflační výpočet používá clean + 0,7 × dirty.

Při zadaném startu dvaceti hráčů je tato hodnota 162 000. Pokud by zůstala původní neutrální hranice 80 000, vznikl by už na začátku inflační násobitel asi 1,4613, aniž by hráči vydělali další peníze. Neutrální hranice je proto 162 000; soft a hard referenční hranice se posunuly na 283 500 a 445 500. Start plného serveru má samotný inflační faktor 1. Výsledná cena trhu ale dál obsahuje nabídku, poptávku, události a další vlivy.

NPC trh nemá být nekonečná bezriziková tiskárna peněz. Rotuje omezený počet položek, používá zásoby a obnovování nabídky. Bazar potřebuje skutečného kupujícího. Výrobce proto nemůže do plánovaného zisku započítat každou vyrobenou zbraň jako automaticky prodanou za libovolnou cenu.

Za otevřenou návrhovou otázku považuji krátkou, 45minutovou životnost bazarové nabídky. Pro několikadenní asynchronní válku bych otestoval delší nabídky, například několik hodin, s odpovídajícím omezením počtu nabídek. Tuto hodnotu audit nemění bez ověření dopadu na blokování zboží a likviditu. Opravené skórování už alespoň nedává hráči bodový postih jen za přesun zboží do aktivní nabídky.

**13. Skóre a reálná hodnota různých strategií**

Základní váhy zůstávají: běžný district 10 000 bodů, jednotka vlivu 25, aktivní budova 500, clean cash 0,1, dirty cash 0,05, populace 2 a omezený bonus za nedávnou aktivitu. Ve finále přibývá bonus za Downtown a vzácné budovy a odečítá se postih za vysoký heat.

Zásoby se nově oceňují plnými výrobními náklady, s bodovou vahou 0,1. Dva Bojové moduly tedy představují hodnotu 15 800 a 1 580 bodů, nikoli téměř zanedbatelný počet dvou předmětů. Hodnota zůstává uznaná i v předplacené frontě, lokálním výstupu, nasazené obraně, rezervované výzbroji nebo aktivní bazarové nabídce. Cena napsaná prodávajícím do nabídky bodovou hodnotu nenafukuje.

Polovina bodové hodnoty vložené do ceny upgradu se zachovává jako investice do přeživší budovy: bodový koeficient investice je 0,05 proti 0,1 u volné clean hotovosti. Upgrade tedy není zcela bodově neutrální. Je to úmyslný kompromis: hráč dostává provozní výhodu, ale nemusí před Očistou přijít o celou bodovou hodnotu jen tím, že místo hromadění peněz rozvíjí výrobu. Zničená budova tuto investiční hodnotu nemá.

Přehled v Očistě a finále nyní umí zobrazit skutečné bodové příspěvky. Nemíchá v porovnávacích pruzích počet districtů, částku v peněžence a body. Viditelné jsou i výrobní zásoby, investice a záporný finální heat postih; souhrn není omezen jen na prvních pět položek.

Ekonomická strategie má přímý příspěvek ke skóre a nepřímý přes nákup vybavení. Výrobní strategie zachovává vloženou hodnotu, umožňuje odbyt, zásobuje vlastní válku a zvyšuje cenu kvalitního zásobování. Informační strategie sama netiskne body za opakované špehování: její přínos spočívá v povolení obsazení a útoku, výběru cíle a snížení rizika špatné investice. Přidávat neomezené body za každý report by vytvořilo snadno opakovatelný bodový automat.

První měřený zápas ukázal ekonomického bota na druhém a informačního bota na čtvrtém místě. To je důkaz, že tyto styly v daném scénáři mohou přispět k vysokému umístění. Není to důkaz stejné výhernosti ani izolovaný kauzální experiment výrobce proti dobyvateli. Každý bot kombinuje více činností. Výrobní zachování skóre je doloženo skutečnými příkazy craft → dokončení → výběr a ověřením bodů v každé fázi.

**14. Boj, ztráty, pasti a obrana**

Před útokem je důležitý průzkum, autorizace, dostupná výzbroj, populace, cesta a čas. Částečný úspěch špionáže může přinést informaci, ale nesmí se tvářit jako plná možnost obsazení. Neonový okraj mapy proto patří jen cíli se skutečně platným oprávněním pro obsazení. Po dokončení se nezajatí špioni vracejí bez další zbytečné čekací doby.

Pálky mají velmi dobrý poměr základní síly k plné pořizovací ceně. Dražší výzbroj nemůže být posuzována jen podle této jediné metriky: omezuje ji počet položek, populace, synergie a riziko použití. Přesto zůstává vhodné sledovat strategie, které používají levné vybavení jako první spotřebovávanou vrstvu před dražším.

Základní výpočet některých útočných ztrát je plochý podle výsledkové kategorie. Izolovaný test s pěti a padesáti pálkami proto může dát stejný počet ztracených kusů. To je otevřený kandidát na změnu směrem k procentní složce, ale nemá se měnit bez celé matice síly, populace, obrany a ekonomických nákladů. Obránci při ztrátě districtu opouštějí i přeživší obranné vybavení; nelze z dílčího combat výsledku tvrdit, že se při obsazení ztratily pouze dva či tři předměty.

Bazuky mají také vztah k riziku destrukce území. Trvalé ničení mapy je mocný nástroj konce války a zaslouží si samostatné pozorování ve větším počtu zápasů. Audit nenasazuje plošný bonus poškození ani nový systém procentních ztrát bez takového podkladu.

Past je autoritativní obranná akce a její stav musí být vidět na mapě. Animace ani neonový rámeček nesmí rozhodovat o tom, zda past nebo autorizace skutečně existuje. To stále určuje server. Stejně tak odchod, porážka nebo vyřazení Očistou musí odstranit hráče z nově volitelných bounty cílů.

**15. Aliance, frakce a udržení aktivity**

Na serveru je maximálně 20 hráčů; limit jedné frakce je čtyři. Jde o frakci, nikoli o počet lidí ve stejně pojmenované alianci. Limit se vynucuje v úložišti i při souběžných požadavcích, UI ukazuje obsazení a nedovolí vybrat plnou frakci. Odchod uvolňuje možnost nové registrace jen v rámci stále otevřených registračních pravidel; stará session se tím neobnovuje.

Založení aliance má skutečnou cenu ve vlivu. Po založení se horní tlačítko zjednodušuje na znak a vycentrovaný název. Aliance může podpořit výrobní, informační i vojenskou specializaci, ale není důvod v testu potají dotovat její založení jen proto, aby tabulka pokrytí byla zelená.

Pro udržení aktivity doporučuji sledovat především počet hráčů se smysluplnou volbou ve druhém a třetím dni. Časový rámec 72–96 hodin nezajistí zajímavou válku, pokud je po prvních šesti hodinách většina mapy pod nedostižným blokem. Důležitější než samotný počet kliknutí jsou změny fronty, obchod mezi hráči, skutečně dokončená výroba, změny pořadí a možnost rozumného návratu po několika hodinách nepřítomnosti.

Za vhodné další testy považuji skupiny hráčů s návštěvou po 15, 60 a 120 minutách; pevné čtyřčlenné aliance proti neorganizovaným hráčům; a zvlášť začátky bez populační budovy. Frakce by se měly porovnávat na stejných startech a s více semeny. Jediný vítězný bot není argument pro buff nebo nerf celé frakce.

**16. Mobilní okna a návaznost na dřívější opravy**

U běžných budov je cílem střed skutečně viditelné části telefonu, se ztmaveným pozadím. Čtyři hlavní výrobní karty mají vlastní celoplošný režim. Otevřená nebo schovaná spodní lišta, klávesnice či změna orientace nesmí tlačit běžná okna pod viditelnou oblast.

Při následném testu WebKitu byl zachycen posun o 90,5 px po zmenšení výšky prohlížeče. Příčinou byla stará hodnota visual viewportu během změny layoutu. Výpočet nyní omezuje viditelnou výšku aktuálním layoutem a po ustálení změny ji znovu načte. Test pokrývá otevření a zavření lišty, nezávislou změnu visual viewportu, orientaci a serverové karty Vítejte, Očista, Lockdown a Vítězové.

Prohlížečový WebKit na Windows není fyzický iPhone se Safari. Je to důležitá kontrola stejné rodiny vykreslovacího jádra a událostí, ale závěrečnou kontrolu nativní lišty na reálném zařízení nenahrazuje. Rozdíl mezi tímto testem a skutečným telefonem je v auditních výsledcích výslovně zachován.

Ostatní dřívější požadavky zahrnují mobilní Očistu s vyřazenými hráči, průhlednější boost a odpočet Očisty, správné vrstvení budov, žádný dotykový hover při scrollování nevybraných budov, oranžovou zprávu po upgradu, kompaktnější Lockdown popisky, návrat špionů, průběžnou razii v Uličních zprávách a registraci s minimálně osmi znaky hesla. Jejich implementace a podrobnosti jsou v původním auditu a příslušných testech. Tento souhrn neoznačuje každou obrazovku za nově vizuálně ověřenou jen na základě existujícího CSS.

**17. Jak číst důkazy a co audit netvrdí**

Číselná příloha vzniká voláním skutečných funkcí pro příjmy, kapacity, výrobní čas, cenové řetězce a policejní tlak. Časové scénáře zahrnují 264 kombinací počtu hráčů, počtu časných vyřazení a hodiny startu. Další scénáře ověřují pozdní start finále. Statické portfolio, matematická očekávaná hodnota, jednotkový test a celý serverový zápas jsou čtyři různé druhy důkazů.

Celé serverové běhy používají ověřené herní session, příkazy, tick, in-memory úložiště, restart ze snapshotu, souběh nákupu a finální vyhodnocení. Nejde o dvacet skutečných lidí, databázový zátěžový test ani prohlížečovou simulaci celého zápasu. Testovací perzistenční hranice nemá všechna chování PostgreSQL. Zvláštní PostgreSQL testy jsou proto uvedeny samostatně.

Audit odhalil také chybu měření ve starším simulátoru: výsledky útoku a špionáže hodnotil už při odeslání příkazu, před dokončením. Pole jako `attacksWon`, `attacksLost`, `spySuccesses`, `spyFailures` v dříve spuštěných bězích proto nejsou použita k tvrzení o úspěšnosti. Sběr byl opraven tak, aby vycházel z událostí skutečného vyhodnocení. Pole označená `cleanCashEarned` a `dirtyCashEarned` ve starším reportu jsou navíc změna zůstatku proti startu, omezená zdola nulou, nikoli hrubý příjem za celý zápas.

Záměrně nebyly zdarma založeny aliance. Pokud obecný report požaduje pokrytí `create-alliance`, takový běh proto nesmí být přeznačen na kompletní PASS všech mechanismů. Skutečné chyby příkazů, očekávané odmítnutí prohraného souběhu, odmítnutí po konci hry a nepokryté scénáře se vykazují odděleně.

<!-- AUDIT_RESULTS -->

| Měření | Před tímto laděním | Po úpravě délky, zásobníků, boostů a HEAT |
| --- | --- | --- |
| Stejné seed / scénář | war-audit-1 / balanced-city | war-audit-1 / balanced-city |
| Délka zápasu | 52 h | 78 h |
| Přijaté / odeslané příkazy | 1137 / 1139 | 1455 / 1457 |
| Očekávaná / neočekávaná odmítnutí | 2 / 0 | 2 / 0 |
| Zahájené útoky / špionáže | 17 / 238 | 22 / 316 |
| Kontroly invariantů / porušení | 4 133 499 / 0 | 5 604 512 / 0 |
| Přijaté placené snížení HEAT | 0 | 53 |
| Vyzvednuté odměny městských událostí | 0 | 0 |

Oba běhy začaly s 20 novými hráči, 6 000 clean, 3 000 dirty, 150 populace, 15 vlivu a povoleným startem v residential/park. Jde o čerstvé běhy stejného seedu, nikoli pokračování starého snapshotu. Mezi běhy se změnila i schopnost botů používat tlačítka HEAT. Nelze proto připsat každý rozdíl jednomu konkrétnímu buffu či nerfu.

Nový běh prošel obnovou po restartu, idempotencí, souběhem nákupu, uložením finálního výsledku a blokací mutací/ticku po konci hry. Souhrnný příznak `passed` přesto zůstává false: nepokryté založení aliance je poctivě uvedeno jako `ACTION_NOT_SUCCESSFUL:create-alliance`. Příkazy pro úspěšné založení a stržení vlivu jsou ověřeny samostatnými testy, nikoli tímto botím zápasem.

V novém běhu vzniklo 59 událostí policejního výjezdu; tento součet zahrnuje i rutinní kontroly a nesmí se vydávat za 59 konfiskací. Městské události běžely, ale boti nevyzvedli žádnou jejich odměnu. Vyhodnocení/claim je proto pokryto cílenými testy, nikoli úspěšným claimem v tomto dlouhém zápase.

**78 hodin dokládá délku, ne intenzitu lidské války.** Dvacet dva zahájených útoků za celý botí zápas je omezený podklad pro tvrzení o nepřetržitě aktivní frontě. Ekonomický bot skončil čtvrtý a informační pátý; vítěz byl expander. Není prokázána rovná výhernost čistě výrobní, ekonomické a informační specializace. K tomu jsou nutné oddělené strategie, více seedů a lidské zápasy.

Celé zápasy byly zkompilovány před poslední úpravou ceny kasinového inspektora, závislosti náhody na ID klientského příkazu, zobrazení bodových příspěvků a opravou sběru výsledků v simulátoru. Tyto pozdější změny mají samostatné regresní testy; dlouhý běh se nesmí prezentovat jako simulace přesně všech posledních souborů.

Prohlížečové kontroly: **6 HEAT scénářů** v mobilním Chromiu a WebKitu, **6 viewport scénářů** v obou jádrech, **3 frakční/rejoin scénáře**, **2 hlášené UI/registrační scénáře** a **1 animace pasti** v Chromiu. Celkem **18 úspěšných scénářů**. HEAT a frakční testy používají kontrolované serverové odpovědi; viewport/UI lokální herní režim. Nejde o kompletní přihlášený produkční E2E ani fyzický telefon. Test popisků byl opraven, aby změřil geometrii ve stejném renderovacím kroku a nevzorkoval už přepsaný časovač.

Raw podklady: [první zápas](war-match-before-2026-09-09.json), [nový zápas](war-match-after-2026-09-09.json), [číselné měření před](war-balance-before-2026-09-09.json), [po](war-balance-after-2026-09-09.json) a [aktuální konfigurace](war-balance-config-2026-09-09.json). Chybná starší pole úspěšnosti útoků/špionáže zůstala v raw souborech zachována pro dohledatelnost a nejsou použita v závěru.

Závěrečná související regresní sada: **761/761 testů**, 0 selhání, 0 přeskočených. [Strojový výsledek](war-regression-tests-2026-09-09.json).

Živý lokální PostgreSQL: **6/6 testů**, 0 selhání a 0 přeskočených. Každý test měl izolované schéma, zahrnutou migraci 027 a žádný přístup k produkčním datům. [Výsledek](war-postgres-tests-2026-09-09.json).

Po rozdělení pomocných funkcí kvůli limitům délky souborů bylo znovu ověřeno **211/211 souvisejících testů** (0 selhání). Tato čísla jsou opakováním části předchozí sady, nesčítají se jako další odlišné testy. [Výsledek](war-extraction-tests-2026-09-09.json).

Závěrečné statické kontroly prošly: TypeScript včetně testových zdrojů, shoda generované browser konfigurace, hranice architektury, limity délky souborů, bezpečné směrování příkazů a `git diff --check` s nastavením konců řádků tohoto repozitáře. Po posledním odstranění nadbytečného příznaku v plánování razie znovu prošlo i všech 41 policejních testů. Celá nesouvisející testovací sada repozitáře se znovu nespouštěla.

<!-- /AUDIT_RESULTS -->

**18. Doporučení pro další hraní a vyhodnocování**

Nejdříve bych nasbíral několik kontrolovaných zápasů s těmito opravami. Pro každé místo na mapě sledovat přežití první Očisty; pro každou frakci a styl maximální i konečný počet districtů, příjmy, investice a pořadí; pro policii důvod výběru cíle a skutečně odečtenou hodnotu. U výroby měřit čas zastavený plným zásobníkem a čas zastavený chybějícími vstupy. U trhu měřit prodané nabídky a stáří nabídky, ne jen počet vystavených kusů.

Výchozí směr je hodinová až dvouhodinová smysluplná kontrola ekonomiky a častější aktivita během vlastního útoku, obrany nebo důležité události. Hra může odměňovat aktivitu, ale hlavní výhoda by neměla být schopnost každých dvacet minut mechanicky vybírat plný zásobník.

Nedoporučuji nyní zrychlit úplně všechno. Největší prostor pro další zlepšení je srozumitelná volba startu, odbyt výroby, dlouhodobější bazar a kvalitnější rozlišení bojových rolí zbraní. Naopak samovolné ochlazování heatu se do návrhu nevrací. Policejní tlak má být viditelné rozhodnutí hráče s cenou a důsledkem.

<!-- GENERATED_TABLES -->

**19. Úplné číselné přílohy a reprodukce**

[Číselná příloha](war-balance-tables-2026-09-09.md) obsahuje 32 budov, 40 akcí, 21 receptů, upgrady, skupiny skladu, portfolia, všech 41 měřených startů, osm frakcí, intervaly výběru a všech 300 questů.

Měření vytváří `tools/war-balance-audit-2026-09-09.ts`; dlouhý zápas spouští `tools/run-war-balance-match-2026-09-09.ts`. Tuto přílohu z uložených dat vytváří `node tools/render-war-balance-audit.mjs`. [Manifest podkladů a omezení](war-evidence-manifest-2026-09-09.json) obsahuje SHA-256 souborů a kompilovaných simulačních programů. Nasazení na staging ani produkci není součástí tohoto auditu.

<!-- /GENERATED_TABLES -->
