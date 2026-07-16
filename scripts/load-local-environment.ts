if (process.env.NODE_ENV !== "production" && process.loadEnvFile) {
  try {
    process.loadEnvFile(".env.local");
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
    if (code !== "ENOENT") throw error;
  }
}
