import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./lib/app.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const host = process.env.HOST || (process.env.RENDER ? "0.0.0.0" : "127.0.0.1");
const port = Number(process.env.PORT || 3000);
const publicUrl = process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || `http://${host === "0.0.0.0" ? "localhost" : host}:${port}`;
const app = createApp({
  dbPath: process.env.DATABASE_PATH || resolve(root, "data/micro.sqlite"),
  publicDir: resolve(root, "public"), publicUrl
});
app.server.listen(port, host, () => {
  console.log(`\nELASTIC: ${publicUrl}\n`);
  if (app.needsSetup()) console.log(`Ustoz hisobini yaratish / Create teacher account:\n${publicUrl}/#setup=${app.setupToken}\nBu bir martalik havolani sir saqlang.\n`);
});
function shutdown() { app.server.close(() => { app.db.close(); process.exit(0); }); }
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
