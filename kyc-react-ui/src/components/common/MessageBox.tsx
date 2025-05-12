import type { UIMessage } from '../../types/kyc';

interface MessageBoxProps extends UIMessage {}

export const MessageBox: React.FC<MessageBoxProps> = ({ message, type }) => {
  const baseStyle = "p-3 rounded-md my-2 text-sm";
  const typeStyle = type === 'error'
    ? "bg-red-100 border border-red-400 text-red-700"
    : type === 'success'
    ? "bg-green-100 border border-green-400 text-green-700"
    : "bg-blue-100 border border-blue-400 text-blue-700";
    
  return message ? <div className={`${baseStyle} ${typeStyle}`}>{message}</div> : null;
};