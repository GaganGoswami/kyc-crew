export interface KYCStatus {
  agent: string;
  message: string;
  data?: any;
  type?: string;
}

export interface UIMessage {
  message: string | null;
  type: 'error' | 'success' | 'info' | 'ping'| 'connected' | 'disconnected' |'update';
}

export interface KYCProcessResponse {
  process_id: string;
  message: string;
}

export interface KYCUpdateData {
  agent: string;
  message: string;
  data?: Record<string, any>;
}