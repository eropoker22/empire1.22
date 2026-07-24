export function loadLocalEnvFile(
  filename = ".env.local",
  loader = process.loadEnvFile?.bind(process)
) {
  if (typeof loader !== "function") {
    return false;
  }

  try {
    loader(filename);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}
