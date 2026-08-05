import { validateReleaseDatabaseEndpoints } from "./release-database-endpoint-contract.mjs";

const result = validateReleaseDatabaseEndpoints(process.env);
console.log(`Release database endpoints: provider=${result.provider}; providerHash=${result.providerHostnameHash};`
  + ` databaseHash=${result.databaseNameHash}; directSsl=${result.directSslModes.join(",")};`
  + ` pooledSsl=${result.pooledSslModes.join(",")}; modes=${result.directConnectionMode}/${result.pooledConnectionMode}.`);
