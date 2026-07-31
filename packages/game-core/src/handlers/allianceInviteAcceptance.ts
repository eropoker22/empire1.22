import type { AllianceInvite } from "@empire/shared-types";
import type { AllianceMembershipResult } from "./allianceMembershipUtils";

export const completeAllianceInviteAcceptance = (
  joined: AllianceMembershipResult,
  invite: AllianceInvite,
  response: AllianceInvite["status"],
  respondedAt: string,
  responseEvent: AllianceMembershipResult["events"][number]
): AllianceMembershipResult => {
  const currentInvite = joined.nextState.allianceInvitesById?.[invite.id] ?? invite;
  return {
    nextState: {
      ...joined.nextState,
      allianceInvitesById: {
        ...(joined.nextState.allianceInvitesById ?? {}),
        [invite.id]: {
          ...currentInvite,
          status: response,
          respondedAt,
          version: currentInvite.version + 1
        }
      },
      root: { ...joined.nextState.root, version: joined.nextState.root.version + 1 }
    },
    events: [responseEvent, ...joined.events],
    errors: []
  };
};
