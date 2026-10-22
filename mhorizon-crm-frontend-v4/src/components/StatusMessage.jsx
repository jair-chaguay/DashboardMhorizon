// Mensaje de éxito o error ({ type: 'success' | 'error', text })
export default function StatusMessage({ message, className = 'p-4 rounded-lg' }) {
  if (!message) return null;
  const colors = message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700';
  return <div role="status" className={`${className} animate-fade-in text-sm font-medium ${colors}`}>{message.text}</div>;
}
