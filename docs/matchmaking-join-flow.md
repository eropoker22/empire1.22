# Matchmaking Join Flow

The gameplay entry flow is split into distinct phases.

1. Matchmaking reserve
2. Join server
3. Load/resume
4. Submit command
5. Logout

## Reserve

A server-authenticated account asks matchmaking for a reservation. The response includes a short-lived one-time `joinTicket`.

The reservation does not create a gameplay session and does not authorize read-model access.

## Join Ticket

A join ticket carries or references:

- ticket id
- account id
- server instance id
- mode and optional faction context
- issued time
- expiry time
- nonce
- consumed time

Tickets expire quickly, are tied to one account and one server, and can be consumed once. A second consume returns `JOIN_TICKET_ALREADY_USED`. An expired consume returns `JOIN_TICKET_EXPIRED`.

## Join

The join endpoint consumes the ticket atomically, finds or creates the player's registration, then creates a gameplay session. The server generates `playerId`; the browser cannot choose it.

The join response can include the initial gameplay read-model and session token. After this point, `load` and `submit` must use the gameplay session.

## Resume

Refresh or reconnect calls `load` with the gameplay session. It must return the same registered player and must not create a new registration.

## Logout

Logout revokes the gameplay session. It does not remove the player registration or mutate gameplay state.
