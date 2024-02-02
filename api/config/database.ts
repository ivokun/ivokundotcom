import { parse } from "pg-connection-string";
const config = parse(process.env.DATABASE_URL);
export default ({ env }) => {
  const client = "postgres";
  const connections = {
    postgres: {
      connection: {
        host: config.host,
        port: config.port,
        database: config.database,
        user: config.user,
        password: config.password,
        ssl: true,
      },
      debug: false,
    },
  };
  return {
    connection: {
      client,
      ...connections[client],
      acquireConnectionTimeout: env.int("DATABASE_CONNECTION_TIMEOUT", 60000),
    },
  };
};
