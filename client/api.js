window.Empire = window.Empire || {};

window.Empire.API = (() => {
  const baseUrl = "http://localhost:3000";

  function init() {
    refreshRound();
  }

  async function login(username, password) {
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Game-Mode": window.Empire.mode || "war"
      },
      body: JSON.stringify({ username, password, mode: window.Empire.mode || "war" })
    });
    return res.json();
  }

  async function register(username, gangName, password) {
    const res = await fetch(`${baseUrl}/auth/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Game-Mode": window.Empire.mode || "war"
      },
      body: JSON.stringify({ username, gangName, password, mode: window.Empire.mode || "war" })
    });
    return res.json();
  }

  async function getDistricts() {
    const res = await fetch(`${baseUrl}/districts`, {
      headers: authHeaders()
    });
    return res.json();
  }

  async function getProfile() {
    const res = await fetch(`${baseUrl}/players/me`, {
      headers: authHeaders()
    });
    return res.json();
  }

  async function setStructure(structure) {
    const res = await fetch(`${baseUrl}/players/structure`, {
      method: "POST",
      headers: {
        ...authHeaders(),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ structure })
    });
    return res.json();
  }

  async function getEconomy() {
    const res = await fetch(`${baseUrl}/economy/status`, {
      headers: authHeaders()
    });
    return res.json();
  }

  async function getDrugsStatus() {
    const res = await fetch(`${baseUrl}/economy/drugs`, {
      headers: authHeaders()
    });
    return res.json();
  }

  async function useDrug(drugKey, amount = 1) {
    const res = await fetch(`${baseUrl}/economy/drugs/use`, {
      method: "POST",
      headers: {
        ...authHeaders(),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ drugKey, amount })
    });
    return res.json();
  }

  async function getAlliance() {
    const res = await fetch(`${baseUrl}/alliances/mine`, {
      headers: authHeaders()
    });
    return res.json();
  }

  async function listAlliances() {
    const res = await fetch(`${baseUrl}/alliances`, {
      headers: authHeaders()
    });
    return res.json();
  }

  async function createAlliance(name, description = "", iconKey = "") {
    const res = await fetch(`${baseUrl}/alliances/create`, {
      method: "POST",
      headers: {
        ...authHeaders(),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ name, description, iconKey })
    });
    return res.json();
  }

  async function joinAlliance(allianceId) {
    const res = await fetch(`${baseUrl}/alliances/join`, {
      method: "POST",
      headers: {
        ...authHeaders(),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ allianceId })
    });
    return res.json();
  }

  async function requestAllianceInvite(allianceId) {
    const res = await fetch(`${baseUrl}/alliances/invitations/request`, {
      method: "POST",
      headers: {
        ...authHeaders(),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ allianceId })
    });
    return res.json();
  }

  async function respondToAllianceInvite(requestId, accept) {
    const res = await fetch(`${baseUrl}/alliances/invitations/${requestId}/respond`, {
      method: "POST",
      headers: {
        ...authHeaders(),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ accept: Boolean(accept) })
    });
    return res.json();
  }

  async function sendAllianceManagementInvite(username) {
    const res = await fetch(`${baseUrl}/alliances/management/invite`, {
      method: "POST",
      headers: {
        ...authHeaders(),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ username })
    });
    return res.json();
  }

  async function respondToAllianceMemberInvite(inviteId, accept) {
    const res = await fetch(`${baseUrl}/alliances/member-invites/${inviteId}/respond`, {
      method: "POST",
      headers: {
        ...authHeaders(),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ accept: Boolean(accept) })
    });
    return res.json();
  }

  async function markAllianceReady() {
    const res = await fetch(`${baseUrl}/alliances/ready`, {
      method: "POST",
      headers: authHeaders()
    });
    return res.json();
  }

  async function removeAllianceMember(memberId) {
    const res = await fetch(`${baseUrl}/alliances/members/${memberId}/remove`, {
      method: "POST",
      headers: authHeaders()
    });
    return res.json();
  }

  async function startAllianceKickVote(targetPlayerId) {
    const res = await fetch(`${baseUrl}/alliances/kick-votes/start`, {
      method: "POST",
      headers: {
        ...authHeaders(),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ targetPlayerId })
    });
    return res.json();
  }

  async function castAllianceKickVote(voteId) {
    const res = await fetch(`${baseUrl}/alliances/kick-votes/${voteId}/cast`, {
      method: "POST",
      headers: authHeaders()
    });
    return res.json();
  }

  async function leaveAlliance() {
    const res = await fetch(`${baseUrl}/alliances/leave`, {
      method: "POST",
      headers: authHeaders()
    });
    return res.json();
  }

  async function attackDistrict(districtId) {
    const res = await fetch(`${baseUrl}/combat/attack`, {
      method: "POST",
      headers: {
        ...authHeaders(),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ districtId })
    });
    return res.json();
  }

  async function raidDistrict(districtId) {
    const res = await fetch(`${baseUrl}/combat/raid`, {
      method: "POST",
      headers: {
        ...authHeaders(),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ districtId })
    });
    return res.json();
  }

  async function getMarket() {
    const res = await fetch(`${baseUrl}/market`, {
      headers: authHeaders()
    });
    return res.json();
  }

  async function createMarketOrder(order) {
    const res = await fetch(`${baseUrl}/market/orders`, {
      method: "POST",
      headers: {
        ...authHeaders(),
        "Content-Type": "application/json"
      },
      body: JSON.stringify(order)
    });
    return res.json();
  }

  async function cancelMarketOrder(orderId) {
    const res = await fetch(`${baseUrl}/market/orders/${orderId}/cancel`, {
      method: "POST",
      headers: authHeaders()
    });
    return res.json();
  }

  async function refreshRound() {
    const res = await fetch(`${baseUrl}/rounds/status`, {
      headers: authHeaders()
    });
    const data = await res.json();
    window.Empire.UI.updateRound(data);
  }

  async function getBounties() {
    const res = await fetch(`${baseUrl}/bounties`, {
      headers: authHeaders()
    });
    return res.json();
  }

  async function createBounty(payload) {
    const res = await fetch(`${baseUrl}/bounties`, {
      method: "POST",
      headers: {
        ...authHeaders(),
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload || {})
    });
    return res.json();
  }

  async function claimBounties(payload) {
    const res = await fetch(`${baseUrl}/bounties/claim`, {
      method: "POST",
      headers: {
        ...authHeaders(),
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload || {})
    });
    return res.json();
  }

  async function resolveBounties(payload) {
    const res = await fetch(`${baseUrl}/bounties/resolve`, {
      method: "POST",
      headers: {
        ...authHeaders(),
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload || {})
    });
    return res.json();
  }

  function authHeaders() {
    return {
      ...(window.Empire.token ? { Authorization: `Bearer ${window.Empire.token}` } : {}),
      "X-Game-Mode": window.Empire.mode || "war"
    };
  }

  return {
    init,
    login,
    register,
    getDistricts,
    getProfile,
    setStructure,
    getEconomy,
    getDrugsStatus,
    useDrug,
    getAlliance,
    listAlliances,
    createAlliance,
    joinAlliance,
    requestAllianceInvite,
    respondToAllianceInvite,
    sendAllianceManagementInvite,
    respondToAllianceMemberInvite,
    markAllianceReady,
    removeAllianceMember,
    startAllianceKickVote,
    castAllianceKickVote,
    leaveAlliance,
    getMarket,
    createMarketOrder,
    cancelMarketOrder,
    attackDistrict,
    raidDistrict,
    refreshRound,
    getBounties,
    createBounty,
    claimBounties,
    resolveBounties
  };
})();
