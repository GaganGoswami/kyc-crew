
import type { KYCStatus } from '../../types/kyc';

interface StatusUpdatesProps {
  updates: KYCStatus[];
}

export const StatusUpdates: React.FC<StatusUpdatesProps> = ({ updates }) => {
  return (
    <section className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-xl font-semibold mb-4 text-gray-700">3. Agent Status Updates</h2>
          {updates.length > 0 ? (
            <ul className="list-disc list-inside space-y-2 text-sm text-gray-700 max-h-60 overflow-y-auto border border-gray-200 rounded-md p-4 bg-gray-50">
              {updates.map((update, index) => (
                <li key={index}>
                  <span className="font-semibold">{update.agent || 'System'}:</span> {update.message}
                  {update.data && <span className="text-xs text-gray-500 ml-2">({JSON.stringify(update.data)})</span>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500 italic">Waiting for updates from KYC agents...</p>
          )}
    </section>
  );
};