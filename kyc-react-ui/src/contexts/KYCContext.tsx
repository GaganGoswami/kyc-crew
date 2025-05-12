
import React, { createContext, useContext, useState, useEffect } from 'react';
import { WebSocketService } from '../services/WebSocketService';
import { KYCService } from '../services/KYCService';
import type { KYCStatus, UIMessage } from '../types/kyc';

interface KYCContextType {
  processId: string | null;
  statusUpdates: KYCStatus[];
  isSubmitting: boolean;
  uiMessage: UIMessage;
  initiateKYC: (customerName: string, email: string) => Promise<void>;
  uploadDocument: (file: File) => Promise<void>;
}

const KYCContext = createContext<KYCContextType | undefined>(undefined);

export const KYCProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [processId, setProcessId] = useState<string | null>(null);
  const [statusUpdates, setStatusUpdates] = useState<KYCStatus[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uiMessage, setUiMessage] = useState<UIMessage>({ message: null, type: 'info' });
  const [webSocketService, setWebSocketService] = useState<WebSocketService | null>(null);

  const handleWebSocketMessage = (data: KYCStatus) => {
    setStatusUpdates(prev => [...prev, data]);
  };

  const handleConnectionStatus = (connected: boolean) => {
    setUiMessage({
      message: connected ? 'Connected to real-time updates.' : 'Disconnected from real-time updates.',
      type: connected ? 'success' : 'error'
    });
  };

  useEffect(() => {
    return () => {
      webSocketService?.disconnect();
    };
  }, [webSocketService]);

  const initiateKYC = async (customerName: string, email: string) => {
    try {
      setIsSubmitting(true);
      setUiMessage({ message: 'Initiating KYC process...', type: 'info' });
      
      const response = await KYCService.initiateKYC(customerName, email);
      const newProcessId = response.process_id;
      setProcessId(newProcessId);
      
      // Initialize WebSocket connection
      const ws = new WebSocketService(
        newProcessId,
        handleWebSocketMessage,
        handleConnectionStatus
      );
      setWebSocketService(ws);
      ws.connect();

      setUiMessage({
        message: `KYC process initiated successfully! Process ID: ${newProcessId}`,
        type: 'success'
      });
    } catch (error) {
      setUiMessage({
        message: `Error initiating KYC: ${error instanceof Error ? error.message : 'Unknown error'}`,
        type: 'error'
      });
      setProcessId(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const uploadDocument = async (file: File) => {
    if (!processId) {
      setUiMessage({
        message: 'No active KYC process. Please initiate KYC first.',
        type: 'error'
      });
      return;
    }

    try {
      setIsSubmitting(true);
      setUiMessage({ message: 'Uploading document...', type: 'info' });
      
      await KYCService.uploadDocument(processId, file);
      
      setUiMessage({
        message: 'Document uploaded successfully. Agents will process it.',
        type: 'success'
      });
    } catch (error) {
      setUiMessage({
        message: `Error uploading document: ${error instanceof Error ? error.message : 'Unknown error'}`,
        type: 'error'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KYCContext.Provider value={{
      processId,
      statusUpdates,
      isSubmitting,
      uiMessage,
      initiateKYC,
      uploadDocument,
    }}>
      {children}
    </KYCContext.Provider>
  );
};

export const useKYC = () => {
  const context = useContext(KYCContext);
  if (context === undefined) {
    throw new Error('useKYC must be used within a KYCProvider');
  }
  return context;
};