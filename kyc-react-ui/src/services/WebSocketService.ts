import type { KYCStatus } from '../types/kyc';

export class WebSocketService {
  private ws: WebSocket | null = null;
  private readonly processId: string;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 5;
  private readonly onMessageCallback: (data: KYCStatus) => void;
  private readonly onStatusChange: (connected: boolean) => void;

  constructor(
    processId: string,
    onMessage: (data: KYCStatus) => void,
    onStatusChange: (connected: boolean) => void
  ) {
    this.processId = processId;
    this.onMessageCallback = onMessage;
    this.onStatusChange = onStatusChange;
  }

  connect() {
    const SOCKET_URL = 'ws://localhost:8000';
    
    try {
      this.ws = new WebSocket(`${SOCKET_URL}/ws/kyc/${this.processId}`);
      this.setupEventHandlers();
    } catch (error) {
      console.error('WebSocket Connection Error:', error);
      this.onStatusChange(false);
    }
  }

  private setupEventHandlers() {
    if (!this.ws) return;

    this.ws.onopen = () => {
      console.log(`WebSocket connected for process ID: ${this.processId}`);
      this.reconnectAttempts = 0;
      this.onStatusChange(true);
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'ping') {
          this.ws?.send(JSON.stringify({ type: 'pong' }));
        } else {
          this.onMessageCallback(data);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    this.ws.onclose = () => {
      this.onStatusChange(false);
      this.attemptReconnect();
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.onStatusChange(false);
    };
  }

  private attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      setTimeout(() => this.connect(), 3000);
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}