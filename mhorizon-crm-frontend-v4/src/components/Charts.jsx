import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { LegendDot, Panel } from './analytics';
import { COLORS, tooltipStyle, axisTick } from '../utils/theme';

// Aperturas y clics por dispositivo y por hora del día. Se usan en el panel y en el reporte de cada campaña
export default function DeviceHourCharts({ deviceBreakdown, hourlyActivityData }) {
  const peak = hourlyActivityData.reduce((best, h) => (h.aperturas + h.clics > best.aperturas + best.clics ? h : best), hourlyActivityData[0] || { aperturas: 0, clics: 0 });
  const hourSubtitle = peak && peak.aperturas + peak.clics > 0 ? `Tus prospectos están más activos cerca de las ${peak.hour}` : 'Aperturas y clics según la hora del día';
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <Panel className="min-w-0" title="Rendimiento por dispositivo" subtitle="Aperturas y clics según desde dónde se leyó"
        right={<div className="flex gap-4 pt-1"><LegendDot color={COLORS.opens} label="Aperturas" /><LegendDot color={COLORS.clicks} label="Clics" /></div>}>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={deviceBreakdown} margin={{ top: 8, right: 8, left: -20, bottom: 0 }} barGap={4}>
              <CartesianGrid vertical={false} stroke={COLORS.grid} />
              <XAxis dataKey="name" tick={{ ...axisTick, fontSize: 12 }} axisLine={false} tickLine={false} dy={8} />
              <YAxis tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={tooltipStyle} />
              <Bar dataKey="aperturas" name="Aperturas" fill={COLORS.opens} radius={[3, 3, 0, 0]} maxBarSize={32} />
              <Bar dataKey="clics" name="Clics" fill={COLORS.clicks} radius={[3, 3, 0, 0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>
      <Panel className="min-w-0" title="Actividad por hora" subtitle={hourSubtitle}
        right={<div className="flex gap-4 pt-1"><LegendDot color={COLORS.opens} label="Aperturas" /><LegendDot color={COLORS.clicks} label="Clics" /></div>}>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={hourlyActivityData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={COLORS.grid} />
              <XAxis dataKey="hour" tick={{ ...axisTick, fontSize: 10 }} axisLine={false} tickLine={false} interval={3} dy={6} />
              <YAxis tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={tooltipStyle} />
              <Bar dataKey="aperturas" name="Aperturas" stackId="a" fill={COLORS.opens} />
              <Bar dataKey="clics" name="Clics" stackId="a" fill={COLORS.clicks} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>
    </div>
  );
}
