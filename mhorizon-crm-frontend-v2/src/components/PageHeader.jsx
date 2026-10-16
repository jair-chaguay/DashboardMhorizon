export default function PageHeader({ children }) {
  return (
    <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
      {children}
    </h2>
  );
}
