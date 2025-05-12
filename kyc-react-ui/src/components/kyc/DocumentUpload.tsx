
import { useState } from 'react';

interface DocumentUploadProps {
  onUpload: (file: File) => Promise<void>;
  isSubmitting: boolean;
}

export const DocumentUpload: React.FC<DocumentUploadProps> = ({
  onUpload,
  isSubmitting,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (selectedFile) {
      await onUpload(selectedFile);
      setSelectedFile(null);
      if (document.getElementById('fileInput')) {
        (document.getElementById('fileInput') as HTMLInputElement).value = '';
      }
    }
  };

  return (
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
            onClick={handleUpload}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
            disabled={!selectedFile || isSubmitting}
          >
            {isSubmitting ? 'Uploading...' : 'Upload Document'}
          </button>
    </section>
  );
};