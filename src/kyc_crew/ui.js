import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import io from 'socket.io-client';

// --- Configuration ---
const API_BASE_URL = 'http://localhost:8000/api/kyc'; // Your FastAPI backend URL
const SOCKET_URL = 'http://localhost:8000'; // Your FastAPI WebSocket URL

// --- Helper Components ---

// Simple message display component
function MessageBox({ message, type }) {
  const baseStyle = "p-3 rounded-md my-2 text-sm";
  const typeStyle = type === 'error'
    ? "bg-red-100 border border-red-400 text-red-700"
    : type === 'success'
    ? "bg-green-100 border border-green-400 text-green-700"
    : "bg-blue-100 border border-blue-400 text-blue-700";
  return message ? <div className={`${baseStyle} ${typeStyle}`}>{message}</div> : null;
}

// --- Main App Component ---
function App() {
  // --- State Variables ---
  const [customerName, setCustomerName] = useState('');
  const [email, setEmail] = useState('');
  const [processId, setProcessId] = useState(null);
  const [kycStatusUpdates, setKycStatusUpdates] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uiMessage, setUiMessage] = useState({ message: null, type: 'info' }); // For user feedback

  // WebSocket reference
  const socketRef = useRef(null);

  // --- WebSocket Connection Handling ---
  const connectWebSocket = useCallback((currentProcessId) => {
    // Disconnect previous socket if exists
    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    console.log(`Attempting to connect WebSocket for process ID: ${currentProcessId}`);
    // Connect to the specific process ID endpoint
    socketRef.current = io(`${SOCKET_URL}/ws/kyc/${currentProcessId}`, {
      // Removed query parameter, using path parameter as per FastAPI setup
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current.on('connect', () => {
      console.log(`WebSocket connected for process ID: ${currentProcessId}`);
      setUiMessage({ message: `Real-time updates connected for process ${currentProcessId}.`, type: 'success' });
    });

    socketRef.current.on('kyc_update', (data) => {
      console.log('Received kyc_update:', data);
      setKycStatusUpdates(prevUpdates => [...prevUpdates, data]);
    });

    socketRef.current.on('disconnect', (reason) => {
      console.log(`WebSocket disconnected: ${reason}`);
      setUiMessage({ message: 'Real-time updates disconnected.', type: 'error' });
      // Optionally attempt to reconnect or notify user
    });

    socketRef.current.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      setUiMessage({ message: `Failed to connect for real-time updates: ${error.message}`, type: 'error' });
    });

  }, []); // No dependencies, uses refs and state setters

  // Cleanup WebSocket on component unmount
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        console.log('WebSocket disconnected on component unmount.');
      }
    };
  }, []);

  // --- API Interaction Functions ---

  // Initiate KYC Process (Pull)
  const handleInitiateKYC = async (e) => {
    e.preventDefault();
    if (!customerName || !email) {
      setUiMessage({ message: 'Please enter both name and email.', type: 'error' });
      return;
    }
    setIsSubmitting(true);
    setUiMessage({ message: 'Initiating KYC process...', type: 'info' });
    setKycStatusUpdates([]); // Clear previous updates

    try {
      const response = await axios.post(`${API_BASE_URL}/initiate`, {
        customer_name: customerName,
        email: email,
      });
      const newProcessId = response.data.process_id;
      setProcessId(newProcessId);
      setUiMessage({ message: `KYC process initiated successfully! Process ID: ${newProcessId}`, type: 'success' });
      // Connect WebSocket after getting the process ID
      connectWebSocket(newProcessId);
    } catch (error) {
      console.error("Error initiating KYC:", error);
      setUiMessage({ message: `Error initiating KYC: ${error.response?.data?.detail || error.message}`, type: 'error' });
      setProcessId(null); // Reset process ID on error
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle file selection
  const handleFileChange = (event) => {
    setSelectedFile(event.target.files[0]);
  };

  // Upload Document (Pull)
  const handleUploadDocument = async () => {
    if (!selectedFile || !processId) {
      setUiMessage({ message: 'Please select a file and ensure a KYC process is initiated.', type: 'error' });
      return;
    }
    setIsSubmitting(true);
    setUiMessage({ message: 'Uploading document...', type: 'info' });

    const formData = new FormData();
    formData.append('file', selectedFile);
    // Optionally add more form data if needed by the backend
    formData.append('details', JSON.stringify({ documentType: 'ID_CARD' })); // Example details

    try {
      const response = await axios.post(`${API_BASE_URL}/document/${processId}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      setUiMessage({ message: `Document '${response.data.filename}' uploaded successfully. Agents will process it.`, type: 'success' });
      setSelectedFile(null); // Clear file input
      document.getElementById('fileInput').value = null; // Reset file input visually
    } catch (error) {
      console.error("Error uploading document:", error);
      setUiMessage({ message: `Error uploading document: ${error.response?.data?.detail || error.message}`, type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Rendering ---
  return (
    <div className="container mx-auto p-6 font-sans max-w-3xl bg-gray-50 min-h-screen">
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-gray-800">KYC Agentic System Interface</h1>
        <p className="text-gray-600">Interact with the CrewAI-powered KYC process.</p>
      </header>

      {/* UI Message Display */}
      <MessageBox message={uiMessage.message} type={uiMessage.type} />

      {/* Section 1: Initiate KYC */}
      <section className="bg-white p-6 rounded-lg shadow-md mb-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-700">1. Initiate KYC Process</h2>
        <form onSubmit={handleInitiateKYC}>
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

      {/* Section 2: Upload Document (Only show if process initiated) */}
      {processId && (
        <section className="bg-white p-6 rounded-lg shadow-md mb-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-700">2. Upload Document</h2>
          <div className="mb-4">
            <label htmlFor="fileInput" className="block text-sm font-medium text-gray-700 mb-1">Select Document:</label>
            <input
              type="file"
              id="fileInput"
              onChange={handleFileChange}
              className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
              disabled={isSubmitting}
            />
          </div>
          <button
            onClick={handleUploadDocument}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
            disabled={!selectedFile || isSubmitting}
          >
            {isSubmitting ? 'Uploading...' : 'Upload Document'}
          </button>
        </section>
      )}

      {/* Section 3: Real-time Status Updates (Only show if process initiated) */}
      {processId && (
        <section className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4 text-gray-700">3. Agent Status Updates</h2>
          {kycStatusUpdates.length > 0 ? (
            <ul className="list-disc list-inside space-y-2 text-sm text-gray-700 max-h-60 overflow-y-auto border border-gray-200 rounded-md p-4 bg-gray-50">
              {kycStatusUpdates.map((update, index) => (
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
      )}

      {/* Tailwind CSS Import (Ensure Tailwind is set up in your project) */}
      {/* If not using a build process with Tailwind, add this script in your index.html: */}
      {/* <script src="https://cdn.tailwindcss.com"></script> */}
    </div>
  );
}

export default App; // Make sure to export App as default
