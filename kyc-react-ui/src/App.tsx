import { ErrorBoundary } from './components/common/ErrorBoundary';
import { KYCProvider, useKYC } from './contexts/KYCContext';
import { InitiateKYCForm } from './components/kyc/InitiateKYCForm';
import { DocumentUpload } from './components/kyc/DocumentUpload';
import { StatusUpdates } from './components/kyc/StatusUpdates';
import { MessageBox } from './components/common/MessageBox';

const KYCApp = () => {
  const {
    processId,
    statusUpdates,
    isSubmitting,
    uiMessage,
    initiateKYC,
    uploadDocument,
  } = useKYC();

  return (
    <div className="container mx-auto p-6 font-sans max-w-3xl bg-gray-50 min-h-screen">
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-gray-800">KYC Agentic System Interface</h1>
        <p className="text-gray-600">Interact with the CrewAI-powered KYC process.</p>
      </header>

      <MessageBox {...uiMessage} />
      
      <InitiateKYCForm
        onSubmit={initiateKYC}
        isSubmitting={isSubmitting}
        processId={processId}
      />
      
      {processId && (
        <>
          <DocumentUpload
            onUpload={uploadDocument}
            isSubmitting={isSubmitting}
          />
          <StatusUpdates updates={statusUpdates} />
        </>
      )}
    </div>
  );
};

const App = () => (
  <ErrorBoundary>
    <KYCProvider>
      <KYCApp />
    </KYCProvider>
  </ErrorBoundary>
);

export default App;