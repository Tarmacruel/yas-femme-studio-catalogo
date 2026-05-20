const path = require("node:path");
const { createApp } = require("./app");
const { openDatabase } = require("./db");
const { loadEnv } = require("./env");

const rootDir = path.resolve(__dirname, "..");
loadEnv(rootDir);

const port = Number(process.env.PORT || 5000);
const host = process.env.HOST || "127.0.0.1";
const adminPassword = process.env.ADMIN_PASSWORD || "troque_esta_senha";
const whatsappNumber = process.env.WHATSAPP_NUMBER || "557381676132";
const publicBaseUrl = process.env.PUBLIC_BASE_URL || "https://yasfemmestudio.sirel.com.br";
const dbPath = process.env.DB_PATH || path.join(rootDir, "storage", "yas-femme.sqlite");

const db = openDatabase(dbPath);
const app = createApp({
  db,
  publicDir: rootDir,
  adminPassword,
  whatsappNumber,
  publicBaseUrl
});

const server = app.listen(port, host, () => {
  console.log(`Yas Femme Studio rodando em http://${host}:${port}`);
});

function shutdown(signal) {
  console.log(`Recebido ${signal}. Encerrando...`);
  server.close(() => {
    db.close();
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
