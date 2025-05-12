
import { useState } from 'react';
import { MessageBox } from '../common/MessageBox';

interface InitiateKYCFormProps {
  onSubmit: (customerName: string, email: string) => Promise<void>;
  isSubmitting: boolean;
  processId: string | null;
}

export const InitiateKYCForm: React.FC<InitiateKYCFormProps> = ({
  onSubmit,
  isSubmitting,
  processId,
}) => {
  const [customerName, setCustomerName] = useState('');
  const [email, setEmail] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (customerName && email) {
      await onSubmit(customerName, email);
    }
  };

  return (
    <section className="bg-white p-6 rounded-lg shadow-md mb-6">
      <h2 className="text-xl font-semibold mb-4 text-gray-700">1. Initiate KYC Process</h2>
      <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="customerName" className="block text-sm font-medium text-gray-700 mb-1">Customer Name:</label>
            <input
              type="text"
              id="customerName"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Enter full name"
              disabled={isSubmitting || processId} // Disable if submitting or already initiated
            />
          </div>
          <div className="mb-4">
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email:</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Enter email address"
              disabled={isSubmitting || processId} // Disable if submitting or already initiated
            />
          </div>
          <button
            type="submit"
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            disabled={isSubmitting || processId} // Disable if submitting or already initiated
          >
            {isSubmitting ? 'Initiating...' : 'Start KYC Process'}
          </button>
      </form>
      {processId && <p className="mt-3 text-sm text-gray-600">Current Process ID: <span className="font-medium">{processId}</span></p>}
    </section>
  );
};