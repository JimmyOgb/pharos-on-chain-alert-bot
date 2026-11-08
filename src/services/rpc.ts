import { createPublicClient, http, formatUnits, parseAbiItem, PublicClient } from "viem";
import { NETWORKS } from "../config.js";
import { NetworkId } from "../types.js";

// Standard ERC-20 Transfer event signature: Transfer(address indexed from, address indexed to, uint256 value)
export const TRANSFER_EVENT_ABI = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)"
);

export class PharosRpcService {
  private clients: Map<NetworkId, PublicClient> = new Map();
  private tokenMetadataCache: Map<string, { symbol: string; decimals: number }> = new Map();

  getClient(network: NetworkId): PublicClient {
    let client = this.clients.get(network);
    if (!client) {
      const netConfig = NETWORKS[network];
      if (!netConfig) {
        throw new Error(`Unsupported network: ${network}`);
      }
      client = createPublicClient({
        transport: http(netConfig.rpcUrl, {
          timeout: 15000,
          retryCount: 2,
        }),
      });
      this.clients.set(network, client);
    }
    return client;
  }

  async getLatestBlockNumber(network: NetworkId): Promise<bigint> {
    const client = this.getClient(network);
    return await client.getBlockNumber();
  }

  async getTokenMetadata(
    network: NetworkId,
    tokenAddress: string
  ): Promise<{ symbol: string; decimals: number }> {
    const key = `${network}:${tokenAddress.toLowerCase()}`;
    if (this.tokenMetadataCache.has(key)) {
      return this.tokenMetadataCache.get(key)!;
    }

    const client = this.getClient(network);
    const addr = tokenAddress as `0x${string}`;

    let symbol = "TOKEN";
    let decimals = 18;

    try {
      const sym = await client.readContract({
        address: addr,
        abi: [
          {
            name: "symbol",
            type: "function",
            stateMutability: "view",
            inputs: [],
            outputs: [{ type: "string" }],
          },
        ],
        functionName: "symbol",
      });
      symbol = sym as string;
    } catch {
      // Some tokens use bytes32 symbol, fallback
    }

    try {
      const dec = await client.readContract({
        address: addr,
        abi: [
          {
            name: "decimals",
            type: "function",
            stateMutability: "view",
            inputs: [],
            outputs: [{ type: "uint8" }],
          },
        ],
        functionName: "decimals",
      });
      decimals = Number(dec);
    } catch {
      // Default to 18 if decimals() reverts
    }

    const metadata = { symbol, decimals };
    this.tokenMetadataCache.set(key, metadata);
    return metadata;
  }

  formatTokenValue(valueAtomic: bigint, decimals: number): string {
    return formatUnits(valueAtomic, decimals);
  }

  buildExplorerTxUrl(network: NetworkId, txHash: string): string {
    const base = NETWORKS[network].explorerUrl;
    return `${base.replace(/\/+$/, "")}/tx/${txHash}`;
  }

  buildExplorerAddressUrl(network: NetworkId, address: string): string {
    const base = NETWORKS[network].explorerUrl;
    return `${base.replace(/\/+$/, "")}/address/${address}`;
  }
}

export const rpcService = new PharosRpcService();
