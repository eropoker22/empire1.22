# Production Chain Simulation

- Result: PASS
- Scenario: pharmacy-lab-factory-armory
- Final pistol inventory: 1
- Final clean cash: 5780

## Authoritative Steps

| Building | Recipe | Quantity | Ticks | Collected | Max completions/tick |
| --- | --- | ---: | ---: | ---: | ---: |
| pharmacy | chemicals | 2 | 48 | 2 | 1 |
| drug_lab | neon-dust | 1 | 60 | 1 | 1 |
| factory | metal-parts | 7 | 336 | 7 | 1 |
| factory | tech-core | 1 | 96 | 1 | 1 |
| armory | pistol | 1 | 60 | 1 | 1 |

## Reservation Audit

- Factory reservation accepted: true
- Conflicting Armory command: armory_missing_inputs
- Metal Parts after Factory reservation: 1
- Metal Parts after waiting refund: 5
- Clean cash after waiting refund: 900
- Duplicate cancel: factory_no_waiting_items

## Invariants

- allCommandsAccepted: PASS
- onePieceCompletion: PASS
- finalPistolCollected: PASS
- noNegativeBalances: PASS
- reservationConflictRejected: PASS
- waitingRefundExact: PASS
- duplicateRefundBlocked: PASS
