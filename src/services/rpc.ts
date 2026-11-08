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
  private blockNumberCache: Map<NetworkId, { blockNumber: bigint; timestamp: number }> = new Map();
  private inFlightBlockFetch: Map<NetworkId, Promise<bigint>> = new Map();

  getClient(network: NetworkId): PublicClient {
    let client = this.clients.get(network);
    if (!client) {
      const netConfig = NETWORKS[network];
      if (!netConfig) {
        throw new Error(`Unsupported network: ${network}`);
      }
      client = createPublicClient({
        transport: http(netConfig.rpcUrl, {
          timeout: 6000,
          retryCount: 1,
        }),
      });
      this.clients.set(network, client);
    }
    return client;
  }

  /**
   * Retrieves the latest block number with a high-performance in-memory cache
   * and stale-while-revalidate behavior. Prevents client-side poll storms and API timeouts.
   */
  async getLatestBlockNumber(network: NetworkId): Promise<bigint> {
    const now = Date.now();
    const cached = this.blockNumberCache.get(network);

    // Cache TTL: 5 seconds. If fresh, return instantly without waiting on network RPC.
    if (cached && now - cached.timestamp < 5000) {
      return cached.blockNumber;
    }

    // If a fetch is already in-flight for this network, avoid duplicate network calls.
    if (this.inFlightBlockFetch.has(network)) {
      if (cached) {
        // Return stale cache immediately while background fetch completes
        return cached.blockNumber;
      }
      return await this.inFlightBlockFetch.get(network)!;
    }

    const client = this.getClient(network);

    // Bounded fetch promise with strict 4.5-second timeout
    const fetchPromise = (async () => {
      try {
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("RPC blockNumber timeout")), 4500)
        );
        const blockNumber = await Promise.race([client.getBlockNumber(), timeoutPromise]);
        this.blockNumberCache.set(network, { blockNumber, timestamp: Date.now() });
        return blockNumber;
      } catch (err: any) {
        if (cached) {
          // Fall back gracefully to last known block number
          return cached.blockNumber;
        }
        throw err;
      } finally {
        this.inFlightBlockFetch.delete(network);
      }
    })();

    this.inFlightBlockFetch.set(network, fetchPromise);

    // If we have stale cache, serve it immediately (stale-while-revalidate)
    if (cached) {
      return cached.blockNumber;
    }

    return await fetchPromise;
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
            outputs: [{ name: "", type: "string" }],
          },
        ],
        functionName: "symbol",
      });
      symbol = sym as string;
    } catch {
      symbol = "TOKEN";
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
            outputs: [{ name: "", type: "uint8" }],
          },
        ],
        functionName: "decimals",
      });
      decimals = Number(dec);
    } catch {
      decimals = 18;
    }

    const meta = { symbol, decimals };
    this.tokenMetadataCache.set(key, meta);
    return meta;
  }

  formatTokenValue(value: bigint, decimals: number): string {
    return formatUnits(value, decimals);
  }

  buildExplorerTxUrl(network: NetworkId, txHash: string): string {
    const netConfig = NETWORKS[network] || NETWORKS.atlantic;
    return `${netConfig.explorerUrl}/tx/${txHash}`;
  }

  getExplorerTxUrl(network: NetworkId, txHash: string): string {
    return this.buildExplorerTxUrl(network, txHash);
  }

  getExplorerAddressUrl(network: NetworkId, address: string): string {
    const netConfig = NETWORKS[network] || NETWORKS.atlantic;
    return `${netConfig.explorerUrl}/address/${address}`;
  }
}

export const rpcService = new PharosRpcService();
