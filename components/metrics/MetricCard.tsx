interface MetricCardProps {
  title: string;
  value: number | null;
  unit: string;
  max?: number;
  icon: string;
  subtitle?: string;
}

export default function MetricCard({
  title,
  value,
  unit,
  max = 100,
  icon,
  subtitle,
}: MetricCardProps) {
  const percentage = value !== null ? Math.min((value / max) * 100, 100) : 0;

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
    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20 hover:border-white/30 transition-all">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">{icon}</span>
            <h3 className="text-white font-semibold text-lg">{title}</h3>
          </div>
          {subtitle && (
            <p className="text-blue-200 text-xs mt-1">{subtitle}</p>
          )}
        </div>
        <div className={`text-right ${getColor()}`}>
          <div className="text-3xl font-bold">
            {value !== null ? value.toFixed(1) : '--'}
          </div>
          <div className="text-sm font-medium">{unit}</div>
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
