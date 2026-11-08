export type NetworkId = "atlantic" | "pacific";

export type AlertConditionType = "LARGE_TRANSFER" | "CONTRACT_CALL" | "PRICE_THRESHOLD";

export type ChannelType = "TELEGRAM" | "DISCORD" | "MOCK";

export type DeliveryStatus = "PENDING" | "DELIVERED" | "FAILED";

export interface AlertRule {
  id: string;
  name: string;
  network: NetworkId;
  type: AlertConditionType;
  enabled: boolean;
  contractAddress?: string;
  threshold?: string;
  thresholdAtomic?: string;
  tokenDecimals?: number;
  tokenSymbol?: string;
  senderAddress?: string;
  recipientAddress?: string;
  methodSelector?: string;
  channel: ChannelType;
  targetChatId?: string;
  createdAt: string;
  lastTriggeredAt?: string;
}

export interface DetectedEvent {
  eventId: string; // Composite unique key: network:txHash:logIndex:alertId
  alertId: string;
  alertName: string;
  network: NetworkId;
  blockNumber: number;
  txHash: string;
  logIndex: number;
  timestamp: string;
  eventType: string;
  description: string;
  valueFormatted: string;
  tokenSymbol: string;
  sender: string;
  recipient: string;
  contractAddress: string;
  explorerUrl: string;
  deliveryStatus: DeliveryStatus;
  deliveredAt?: string;
  errorDetails?: string;
}

export interface MonitoringStats {
  network: NetworkId;
  chainId: number;
  latestBlock: number;
  lastMonitoredBlock: number;
  lastCycleTimestamp: string;
  activeAlertCount: number;
  totalEventsDetected: number;
  totalDelivered: number;
  rpcStatus: "ONLINE" | "DEGRADED" | "OFFLINE";
  dbStatus: "CONNECTED" | "FALLBACK";
}

export interface NetworkConfig {
  name: string;
  chainId: number;
  caip2: string;
  rpcUrl: string;
  explorerUrl: string;
  defaultTokens: {
    symbol: string;
    address: string;
    decimals: number;
  }[];
}
