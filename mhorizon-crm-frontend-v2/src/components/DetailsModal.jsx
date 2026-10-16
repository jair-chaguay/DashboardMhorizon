import Modal from './Modal';

function ctorBadge(opens, clicks) {
  const porcentaje = opens > 0 ? Math.min(Math.round((clicks / opens) * 100), 100) : 0;
  let colorClass = "bg-gray-100 text-gray-500";
  if (porcentaje >= 50) colorClass = "bg-green-100 text-green-700";
  else if (porcentaje > 0) colorClass = "bg-yellow-100 text-yellow-700";
  return { porcentaje, colorClass };
}

export default function DetailsModal({ modalDetails, onClose }) {
  return (
    <Modal isOpen={modalDetails.isOpen} onClose={onClose} className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
      <div className="flex justify-between items-center p-5 border-b border-gray-200">
        <h3 className="text-lg font-bold text-gray-900">
          {modalDetails.title} <span className="text-gray-500 text-sm font-normal">({modalDetails.leads.length})</span>
        </h3>
        <button onClick={onClose} aria-label="Cerrar" className="text-gray-400 hover:text-gray-700 font-bold text-xl cursor-pointer">
          ×
        </button>
      </div>
      <div className="overflow-y-auto p-5">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-gray-500">
              <th className="pb-2 font-medium">Email</th>
              <th className="pb-2 font-medium text-center">Aperturas</th>
              <th className="pb-2 font-medium text-center">Clics</th>
              <th className="pb-2 font-medium text-center">Efectividad (CTOR)</th>
              <th className="pb-2 font-medium">Fase CRM</th>
            </tr>
          </thead>
          <tbody>
            {modalDetails.leads.map((lead) => {
              const { porcentaje, colorClass } = ctorBadge(lead.displayOpens, lead.displayClicks);
              return (
                <tr key={lead.email} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 text-gray-900 font-medium">{lead.email}</td>
                  <td className="py-3 text-center text-blue-600 font-bold">{lead.displayOpens}</td>
                  <td className="py-3 text-center text-pink-600 font-bold">{lead.displayClicks}</td>
                  <td className="py-3 text-center"><span className={`px-2 py-1 rounded text-xs font-bold ${colorClass}`}>{porcentaje}%</span></td>
                  <td className="py-3 text-gray-600">Fase {lead.fase || 1}</td>
                </tr>
              );
            })}
            {modalDetails.leads.length === 0 && (
              <tr>
                <td colSpan="5" className="py-8 text-center text-gray-400">No hay prospectos en esta categoría todavía.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}
