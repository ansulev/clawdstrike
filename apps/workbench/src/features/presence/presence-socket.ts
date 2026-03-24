// PresenceSocket — WebSocket connection lifecycle manager for hushd /api/v1/presence.
//
// Uses the native browser WebSocket API (NOT tauri-plugin-websocket) because the
// presence endpoint authenticates via ?token= query parameter. Modeled on
// FleetEventStream but adapted for WebSocket with heartbeat and jittered backoff.

import { resolveProxyBase } from "@/components/workbench/editor/live-agent-tab";
import type {
  ClientMessage,
  PresenceConnectionState,
  PresenceSocketOptions,
  ServerMessageRaw,
} from "./types";
import { HEARTBEAT_INTERVAL_MS } from "./types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BACKOFF_BASE_DELAYS = [1000, 2000, 4000, 8000, 16000];

export function buildPresenceWebSocketUrl(
  hushdUrl: string,
  apiKey: string,
  locationOrigin: string,
  isDev = import.meta.env.DEV,
): string {
  const base = resolveProxyBase(hushdUrl, isDev);
  const wsUrl = new URL(base, locationOrigin);
  wsUrl.protocol = wsUrl.protocol === "https:" ? "wss:" : "ws:";
  wsUrl.pathname = `${wsUrl.pathname.replace(/\/$/, "")}/api/v1/presence`;
  wsUrl.search = "";
  wsUrl.searchParams.set("token", apiKey);
  return wsUrl.toString();
}

// ---------------------------------------------------------------------------
// PresenceSocket
// ---------------------------------------------------------------------------

export class PresenceSocket {
  private opts: PresenceSocketOptions;
  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectAttempt = 0;
  private isReconnect = false;
  private disposed = false;

  constructor(opts: PresenceSocketOptions) {
    this.opts = opts;
  }

  // ---- Public API ----

  /**
   * Open a WebSocket connection to the hushd presence endpoint.
   * Credentials are obtained fresh on every call via `opts.getApiKey()`.
   */
  connect(): void {
    this.setState("connecting");

    const apiKey = this.opts.getApiKey();
    if (!apiKey) {
      // Graceful offline degradation — no credentials means no connection.
      this.setState("disconnected");
      return;
    }

    // TODO(security): Browser WebSocket clients cannot send Authorization
    // headers, so this currently uses a query token. Replace it with a
    // short-lived ticket flow before presence traffic crosses URL-logging
    // infrastructure.
    const wsUrl = buildPresenceWebSocketUrl(
      this.opts.hushdUrl,
      apiKey,
      window.location.origin,
    );

    try {
      const ws = new WebSocket(wsUrl);
      this.ws = ws;

      ws.onopen = () => this.onOpen();
      ws.onmessage = (event: MessageEvent) => this.onMessage(event);
      ws.onclose = () => this.onClose();
      ws.onerror = () => this.onError();
    } catch {
      // Construction error (e.g. invalid URL) — schedule reconnect.
      this.scheduleReconnect();
    }
  }

  /**
   * Gracefully disconnect and tear down all timers.
   */
  disconnect(): void {
    this.disposed = true;
    this.stopHeartbeat();

    if (this.reconnectTimer != null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.close(1000);
      this.ws = null;
    }

    this.setState("disconnected");
    this.reconnectAttempt = 0;
  }

  /**
   * Send a typed client message. Silently drops if the socket is not open
   * (offline degradation — callers should not need to guard).
   */
  send(msg: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  // ---- Private handlers ----

  private onOpen(): void {
    this.reconnectAttempt = 0;
    this.setState("connected");
    this.sendJoin();
    this.startHeartbeat();

    if (this.isReconnect) {
      this.opts.onReconnect();
      this.isReconnect = false;
    }
  }

  private onMessage(event: MessageEvent): void {
    try {
      const parsed = JSON.parse(event.data as string) as ServerMessageRaw;
      this.opts.onMessage(parsed);
    } catch {
      // Skip malformed messages — do not tear down the connection.
      console.warn("[PresenceSocket] Skipping malformed message");
    }
  }

  private onClose(): void {
    this.stopHeartbeat();
    this.ws = null;

    if (!this.disposed) {
      this.setState("reconnecting");
      this.scheduleReconnect();
    }
  }

  private onError(): void {
    // onClose fires after onError and handles the state transition.
    console.warn("[PresenceSocket] WebSocket error");
  }

  // ---- Reconnect with jittered backoff ----

  private scheduleReconnect(): void {
    const baseDelay =
      BACKOFF_BASE_DELAYS[
        Math.min(this.reconnectAttempt, BACKOFF_BASE_DELAYS.length - 1)
      ];
    // Jitter: 50-100% of base delay to prevent thundering herd on hushd restart.
    const jitter = baseDelay * (0.5 + Math.random() * 0.5);
    this.reconnectAttempt++;
    this.isReconnect = true;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, jitter);
  }

  // ---- Heartbeat ----

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.send({ type: "heartbeat" });
    }, HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer != null) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  // ---- Join ----

  private sendJoin(): void {
    const identity = this.opts.getIdentity();
    if (!identity) {
      console.warn("[PresenceSocket] Cannot join — no operator identity");
      return;
    }
    this.send({
      type: "join",
      fingerprint: identity.fingerprint,
      display_name: identity.displayName,
      sigil: identity.sigil,
    });
  }

  // ---- State helper ----

  private setState(state: PresenceConnectionState): void {
    this.opts.onStateChange(state);
  }
}
