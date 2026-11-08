import dotenv from "dotenv";
import { NetworkConfig, NetworkId } from "./types.js";

dotenv.config();

export const NETWORKS: Record<NetworkId, NetworkConfig> = {
  atlantic: {
    name: "Pharos Atlantic Testnet",
    chainId: 688689,
    caip2: "eip155:688689",
    rpcUrl: process.env.ATLANTIC_RPC_URL || "https://atlantic.dplabs-internal.com",
    explorerUrl: process.env.ATLANTIC_EXPLORER_URL || "https://atlantic.pharosscan.xyz",
    defaultTokens: [
      {
        symbol: "USDC",
        address: "0xcfc8330f4bcab529c625d12781b1c19466a9fc8b",
        decimals: 6,
      },
    ],
  },
  pacific: {
    name: "Pharos Pacific Mainnet",
    chainId: 1672,
    caip2: "eip155:1672",
    rpcUrl: process.env.PACIFIC_RPC_URL || "https://rpc.pharos.xyz",
    explorerUrl: process.env.PACIFIC_EXPLORER_URL || "https://pharosscan.xyz",
    defaultTokens: [
      {
        symbol: "PHAROS",
        address: "0x0000000000000000000000000000000000000000",
        decimals: 18,
      },
    ],
  },
};

export const CONFIG = {
  PORT: parseInt(process.env.PORT || "3000", 10),
  DEFAULT_NETWORK: (process.env.DEFAULT_NETWORK as NetworkId) || "atlantic",
  MAX_BLOCK_CHUNK: parseInt(process.env.MAX_BLOCK_CHUNK || "50", 10),
  POLL_INTERVAL_MS: parseInt(process.env.POLL_INTERVAL_MS || "30000", 10),
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || "",
  TELEGRAM_DEFAULT_CHAT_ID: process.env.TELEGRAM_DEFAULT_CHAT_ID || "",
  DISCORD_WEBHOOK_URL: process.env.DISCORD_WEBHOOK_URL || "",
  DATABASE_URL: process.env.DATABASE_URL || "",
  CRON_SECRET: process.env.CRON_SECRET || "",
  DATA_DIR: process.env.DATA_DIR || "./data",
};
