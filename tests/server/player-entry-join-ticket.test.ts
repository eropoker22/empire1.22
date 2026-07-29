import { describe, expect, it, vi } from "vitest";
import { createInMemoryGameplaySessionService } from "../../apps/server/src/auth";
import { createPlayerEntryNetlifyBoundary } from "../../apps/server/src/player-entry/player-entry-netlify";
import type {
  AuthenticatedAccount,
  PostgresPlayerEntryRepository
} from "../../apps/server/src/player-entry/postgres-player-entry-repository";

const account: AuthenticatedAccount = {
  accountId: "account:returning-player",
  sessionId: "account-session:returning-player",
  username: "returning-player",
  displayName: "Returning Player",
  gangName: "Returning Crew",
  expiresAt: "2099-01-01T00:00:00.000Z"
};

describe("active membership join-ticket rotation", () => {
  it("persists the prepared replacement ticket before returning it", async () => {
    let boundTicketId: string | null = null;
    const rotateMembershipJoinTicket = vi.fn(async (
      accountId: string,
      membershipId: string,
      ticket: { ticketId: string }
    ) => {
      expect(accountId).toBe(account.accountId);
      expect(membershipId).toBe("membership:returning-player");
      boundTicketId = ticket.ticketId;
      return ticket;
    });
    const repository = {
      isSchemaCurrent: async () => true,
      authenticate: async () => account,
      getMembership: async () => ({
        membershipId: "membership:returning-player",
        accountId: account.accountId,
        serverInstanceId: "instance:returning-player",
        serverMode: "free",
        status: "active",
        factionId: "mafian"
      }),
      rotateMembershipJoinTicket,
      getMembershipView: async () => ({
        membershipId: "membership:returning-player",
        serverInstanceId: "instance:returning-player",
        status: "active",
        joinTicket: boundTicketId
      })
    } as unknown as PostgresPlayerEntryRepository;
    const handler = createPlayerEntryNetlifyBoundary({
      environment: { NODE_ENV: "production", EMPIRE_ALLOWED_ORIGINS: "https://empire.test" },
      repository,
      gameplaySessionService: createInMemoryGameplaySessionService({ productionReady: true })
    });

    const response = await handler({
      httpMethod: "POST",
      path: "/api/lobby/memberships/membership%3Areturning-player/join-ticket",
      body: {},
      headers: {
        cookie: "empire_account_session=account-token",
        origin: "https://empire.test",
        "content-type": "application/json"
      }
    });
    const payload = JSON.parse(response?.body ?? "null");

    expect(response?.statusCode).toBe(201);
    expect(rotateMembershipJoinTicket).toHaveBeenCalledOnce();
    expect(payload.data.joinTicket).toBe(boundTicketId);
    expect(boundTicketId).toMatch(/^join:/u);
  });
});
