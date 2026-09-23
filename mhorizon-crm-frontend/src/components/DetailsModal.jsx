export default function DetailsModal({ modalDetails, setModalDetails }) {
  if (!modalDetails.isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-900/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="flex justify-between items-center p-5 border-b border-gray-200">
          <h3 className="text-lg font-bold text-gray-900">
            {modalDetails.title} <span className="text-gray-500 text-sm font-normal">({modalDetails.leads.length})</span>
          </h3>
          <button onClick={() => setModalDetails({ isOpen: false, title: '', leads: [] })} className="text-gray-400 hover:text-gray-700 font-bold text-xl">×</button>
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
              {modalDetails.leads.map((lead, idx) => {
                const porcentaje = lead.displayOpens > 0 ? Math.min(Math.round((lead.displayClicks / lead.displayOpens) * 100), 100) : 0;
                let colorClass = "bg-gray-100 text-gray-500"; 
                if (porcentaje >= 50) colorClass = "bg-green-100 text-green-700"; 
                else if (porcentaje > 0) colorClass = "bg-yellow-100 text-yellow-700"; 
                return (
                  <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 text-gray-900 font-medium">{lead.email}</td>
                    <td className="py-3 text-center text-blue-600 font-bold">{lead.displayOpens}</td>
                    <td className="py-3 text-center text-pink-600 font-bold">{lead.displayClicks}</td>
                    <td className="py-3 text-center"><span className={`px-2 py-1 rounded text-xs font-bold ${colorClass}`}>{porcentaje}%</span></td>
                    <td className="py-3 text-gray-600">Fase {lead.fase}</td>
                  </tr>
                );
              })}
              {modalDetails.leads.length === 0 && (
                <tr><td colSpan="5" className="py-8 text-center text-gray-400">No hay prospectos en esta categoría todavía.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}