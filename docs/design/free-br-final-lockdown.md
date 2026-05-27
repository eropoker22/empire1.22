# Free BR Final Lockdown

Free Battle Royale uzavirame pres Final Lockdown, protoze 75% control victory byla v 161-district mape prakticky nedosazitelna. Po Top 8 uz eliminace nesmi pokracovat, ale server potrebuje jasny konec misto timeoutu bez viteze.

## Pravidlo

- Final Lockdown zacne, jakmile zustane 8 aktivnich hracu.
- Planovane eliminace se zastavi.
- Bezi 12 hodin aktivniho casu.
- Quiet hours 00:00-06:00 Europe/Bratislava timer pozastavi.
- Po 12 aktivnich hodinach se vytvori vysledek zapasu.
- Vitez a Top 3 se urci podle Final Empire Score.

Hracsky text:

> Prezil jsi cistky. Ted vyhraj mesto. Final Lockdown zacal - 12 aktivnich hodin do rozsudku.

## Final Empire Score

Final Empire Score vychazi z elimination score, ale radi nejsilnejsi imperia. Zaklad obsahuje districts, influence, budovy, clean cash, dirty cash, resources, population a aktivitu.

Free BR k tomu pridava konzervativni endgame bonusy:

- downtown district: +15000
- rare building: +5000
- heat penalty zacina nad heat 120
- extra heat penalty zacina nad heat 180

Tie-breakery jsou stabilni:

1. vyssi Final Empire Score
2. vice downtown districtu
3. vice kontrolovanych districtu
4. nizsi heat
5. playerId

## UI data

Read model vystavuje:

- status Final Lockdownu
- zbyvajici aktivni ticks
- jestli je timer pozastaven quiet hours
- odhad konce
- aktualni Top 3
- rank a final score aktualniho hrace

Legacy runtime.js nema obsahovat autoritativni endgame logiku. UI ma jen renderovat data z core/read modelu.

## 75% control

Stary 75% threshold zustava pouze auditni metrika v simulatoru. Free BR uz nema vytvaret match result pres `control:fast-control`; produkcni konec ma byt `final_lockdown_score`, pokud server dosahne Top 8 a Final Lockdown dobehne.
