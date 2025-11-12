import { Cpu, MemoryStick, Gpu, ArrowDownToLine, ArrowUpFromLine, Zap, LucideIcon } from 'lucide-react';
import { metricIconColors, MetricType } from '@/lib/iconColors';

interface MetricCardProps {
  title: string;
  value: number | null;
  unit: string;
  max?: number;
  icon: MetricType;
  subtitle?: string;
  adaptiveUnit?: boolean; // Enable adaptive unit scaling (e.g., Kbps → Mbps → Gbps)
}

const iconMap: Record<MetricType, LucideIcon> = {
  cpu: Cpu,
  ram: MemoryStick,
  gpu: Gpu,
  networkRx: ArrowDownToLine,
  networkTx: ArrowUpFromLine,
  power: Zap,
};

export default function MetricCard({
  title,
  value,
  unit,
  max = 100,
  icon,
  subtitle,
  adaptiveUnit = false,
}: MetricCardProps) {
  // Adaptive unit scaling for network speeds (Mbps → Kbps/Mbps/Gbps)
  let displayValue = value;
  let displayUnit = unit;
  let displayMax = max;

  if (adaptiveUnit && value !== null && unit === 'Mbps') {
    if (value < 1) {
      // Convert to Kbps for values < 1 Mbps
      displayValue = value * 1000;
      displayUnit = 'Kbps';
      displayMax = 1000;
    } else if (value >= 1000) {
      // Convert to Gbps for values >= 1000 Mbps
      displayValue = value / 1000;
      displayUnit = 'Gbps';
      displayMax = 10; // Max 10 Gbps for typical home networks
    } else {
      // Keep as Mbps for values 1-999 Mbps
      displayMax = 1000;
    }
  }

  const percentage = displayValue !== null ? Math.min((displayValue / displayMax) * 100, 100) : 0;
  const IconComponent = iconMap[icon];
  const iconColorClass = metricIconColors[icon];

  // Color based on percentage
  const getColor = () => {
    if (value === null) return 'text-gray-400';
    if (percentage < 50) return 'text-green-400';
    if (percentage < 80) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getGradientColor = () => {
    if (value === null) return 'from-gray-500 to-gray-600';
    if (percentage < 50) return 'from-green-500 to-green-600';
    if (percentage < 80) return 'from-yellow-500 to-yellow-600';
    return 'from-red-500 to-red-600';
  };

  return (
    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-3 sm:p-4 border border-white/20 hover:border-white/30 transition-all">
      <div className="flex items-start sm:items-center justify-between mb-3 gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <IconComponent className={`w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0 ${iconColorClass}`} strokeWidth={2} />
            <h3 className="text-white font-semibold text-base sm:text-lg truncate">{title}</h3>
          </div>
          {subtitle && (
            <p className="text-blue-200 text-xs mt-1 truncate">{subtitle}</p>
          )}
        </div>
        <div className={`text-right flex-shrink-0 ${getColor()}`}>
          <div className="text-2xl sm:text-3xl font-bold whitespace-nowrap">
            {displayValue !== null ? displayValue.toFixed(1) : '--'}
          </div>
          <div className="text-xs sm:text-sm font-medium">{displayUnit}</div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="relative w-full h-2 bg-white/10 rounded-full overflow-hidden">
        <div
          className={`h-full bg-gradient-to-r ${getGradientColor()} transition-all duration-500 ease-out`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Percentage label */}
      <div className="mt-2 text-right">
        <span className={`text-xs font-medium ${getColor()}`}>
          {value !== null ? `${percentage.toFixed(0)}%` : 'No data'}
        </span>
      </div>
    </div>
  );
}
