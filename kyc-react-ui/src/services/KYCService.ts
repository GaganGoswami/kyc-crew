import axios from 'axios';
import { API_BASE_URL } from '../config/api';
import type { KYCProcessResponse } from '../types/kyc';

export class KYCService {
  static async initiateKYC(customerName: string, email: string): Promise<KYCProcessResponse> {
    const response = await axios.post(`${API_BASE_URL}/initiate`, {
      customer_name: customerName,
      email: email,
    });
    return response.data;
  }

  static async uploadDocument(processId: string, file: File, documentType: string = 'ID_CARD'): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('details', JSON.stringify({ documentType }));

    const response = await axios.post(`${API_BASE_URL}/document/${processId}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  }
}