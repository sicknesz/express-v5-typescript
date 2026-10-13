import mongoose from "mongoose"
import type { Express } from "express"
import { log } from "./app.ts"

export async function connect(app: Express) {

  const {
    env: {
      MONGODB_USER = "admin",
      MONGODB_PASS = "pass",
      MONGODB_DB = "db",
      MONGODB_HOST = "127.0.0.1",
      MONGODB_PORT = 27017,
      MONGODB_AUTH = false,
    },
  } = process;

  const proto = "mongodb";
  const credentials = MONGODB_AUTH ? `${MONGODB_USER}:${MONGODB_PASS}@` : "";

  const connectionString = `${proto}://${credentials}${MONGODB_HOST}:${MONGODB_PORT}`;
  const mongooseConnectionString = `${connectionString}/${MONGODB_DB}`;

  log.debug(`connecting to ${mongooseConnectionString}`);

  const client = await mongoose.connect(mongooseConnectionString);

  app.set("db", client)

  return client;
}