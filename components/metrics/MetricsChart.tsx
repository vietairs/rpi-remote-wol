'use client';

import { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Clock, Clock1, Clock6, Calendar, CalendarDays, CalendarRange, CalendarClock, RefreshCw } from 'lucide-react';
import { metricLineColors } from '@/lib/iconColors';

interface MetricsChartProps {
  deviceId: number;
  deviceName: string;
}

interface ChartDataPoint {
  timestamp: number;
  timeLabel: string;
  cpu: number | null;
  ram: number | null;
  gpu: number | null;
  networkRx: number | null;
  networkTx: number | null;
  power: number | null;
}

interface MetricVisibility {
  cpu: boolean;
  ram: boolean;
  gpu: boolean;
  networkRx: boolean;
  networkTx: boolean;
  power: boolean;
}

type TimeRange = '1h' | '6h' | '24h' | '7d' | '30d' | '90d' | '365d';

interface HistoricalMetricsResponse {
  deviceId: number;
  duration: string;
  dataPoints: number;
  metrics: {
    cpu: Array<{ timestamp: number; value: number | null }>;
    ram: Array<{ timestamp: number; value: number | null }>;
    gpu: Array<{ timestamp: number; value: number | null }>;
    network: {
      rx: Array<{ timestamp: number; value: number | null }>;
      tx: Array<{ timestamp: number; value: number | null }>;
    };
    power: Array<{ timestamp: number; value: number | null }>;
  };
  energyConsumption: {
    kWh: number;
    dataPoints: number;
  };
  powerStats: {
    avgWatts: number | null;
    maxWatts: number | null;
    minWatts: number | null;
    dataPoints: number;
  };
}

export default function MetricsChart({ deviceId }: MetricsChartProps) {
  const [duration, setDuration] = useState<TimeRange>('24h');
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [energyConsumption, setEnergyConsumption] = useState<{ kWh: number; dataPoints: number } | null>(null);
  const [powerStats, setPowerStats] = useState<{ avgWatts: number | null; maxWatts: number | null; minWatts: number | null } | null>(null);
  const [visibleMetrics, setVisibleMetrics] = useState<MetricVisibility>({
    cpu: true,
    ram: true,
    gpu: true,
    networkRx: true,
    networkTx: true,
    power: true,
  });

  // Fetch historical data
  const fetchHistoricalData = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/metrics/${deviceId}?duration=${duration}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: HistoricalMetricsResponse = await response.json();

      if (data.dataPoints === 0) {
        setError('No historical data available. Metrics will appear after first collection.');
        setChartData([]);
        setEnergyConsumption(null);
        setPowerStats(null);
        setLoading(false);
        return;
      }

      const transformed = transformToChartData(data, duration);
      setChartData(transformed);
      setEnergyConsumption(data.energyConsumption);
      setPowerStats(data.powerStats);
    } catch (err) {
      console.error('Failed to fetch metrics:', err);
      setError(err instanceof Error ? err.message : 'Failed to load historical metrics');
      setChartData([]);
    } finally {
      setLoading(false);
    }
  };

  // Transform API response to chart format
  const transformToChartData = (
    response: HistoricalMetricsResponse,
    timeRange: TimeRange
  ): ChartDataPoint[] => {
    // Collect all unique timestamps
    const timestamps = new Set<number>();

    response.metrics.cpu.forEach(d => timestamps.add(d.timestamp));
    response.metrics.ram.forEach(d => timestamps.add(d.timestamp));
    response.metrics.gpu.forEach(d => timestamps.add(d.timestamp));
    response.metrics.network.rx.forEach(d => timestamps.add(d.timestamp));
    response.metrics.network.tx.forEach(d => timestamps.add(d.timestamp));
    response.metrics.power.forEach(d => timestamps.add(d.timestamp));

    // Sort timestamps chronologically
    const sortedTimestamps = Array.from(timestamps).sort();

    // Create merged data points
    return sortedTimestamps.map(timestamp => ({
      timestamp,
      timeLabel: formatTimestamp(timestamp, timeRange),
      cpu: findValueAtTimestamp(response.metrics.cpu, timestamp),
      ram: findValueAtTimestamp(response.metrics.ram, timestamp),
      gpu: findValueAtTimestamp(response.metrics.gpu, timestamp),
      networkRx: normalizeToScale(
        findValueAtTimestamp(response.metrics.network.rx, timestamp),
        0, 1000, 0, 100
      ),
      networkTx: normalizeToScale(
        findValueAtTimestamp(response.metrics.network.tx, timestamp),
        0, 1000, 0, 100
      ),
      power: normalizeToScale(
        findValueAtTimestamp(response.metrics.power, timestamp),
        0, 500, 0, 100
      ),
    }));
  };

  // Helper: Find metric value at specific timestamp
  const findValueAtTimestamp = (
    data: Array<{ timestamp: number; value: number | null }>,
    timestamp: number
  ): number | null => {
    const point = data.find(d => d.timestamp === timestamp);
    return point?.value ?? null;
  };

  // Helper: Normalize value to 0-100 scale
  const normalizeToScale = (
    value: number | null,
    minValue: number,
    maxValue: number,
    minScale: number,
    maxScale: number
  ): number | null => {
    if (value === null) return null;
    const normalized = ((value - minValue) / (maxValue - minValue)) * (maxScale - minScale) + minScale;
    return Math.max(minScale, Math.min(maxScale, normalized));
  };

  // Helper: Format timestamp based on duration
  const formatTimestamp = (timestamp: number, timeRange: TimeRange): string => {
    const date = new Date(timestamp * 1000);

    switch (timeRange) {
      case '1h':
      case '6h':
        // Hour/minute for short durations
        return date.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit'
        });
      case '24h':
        // Date + time for 1 day
        return date.toLocaleString('en-US', {
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        });
      case '7d':
      case '30d':
        // Date + time for week/month
        return date.toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      case '90d':
      case '365d':
        // Date only for long durations
        return date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric'
        });
      default:
        return date.toLocaleTimeString();
    }
  };

  // Denormalize values for tooltip display
  const getActualValue = (
    dataKey: string,
    normalizedValue: number,
    dataPoint: ChartDataPoint | undefined
  ): number => {
    if (!dataPoint) return normalizedValue;

    // For percentage metrics, use value directly
    if (['cpu', 'ram', 'gpu'].includes(dataKey)) {
      return normalizedValue;
    }

    // Denormalize network metrics (0-100 back to 0-1000 Mbps)
    if (dataKey === 'networkRx' || dataKey === 'networkTx') {
      return (normalizedValue / 100) * 1000;
    }

    // Denormalize power (0-100 back to 0-500W)
    if (dataKey === 'power') {
      return (normalizedValue / 100) * 500;
    }

    return normalizedValue;
  };

  const getUnit = (dataKey: string): string => {
    if (['cpu', 'ram', 'gpu'].includes(dataKey)) return '%';
    if (dataKey === 'networkRx' || dataKey === 'networkTx') return 'Mbps';
    if (dataKey === 'power') return 'W';
    return '';
  };

  // Toggle metric visibility
  const toggleMetric = (metric: keyof MetricVisibility) => {
    setVisibleMetrics(prev => ({
      ...prev,
      [metric]: !prev[metric],
    }));
  };

  // Fetch data on mount, when duration changes, and auto-refresh every 5 minutes
  useEffect(() => {
    fetchHistoricalData();

    // Auto-refresh chart every 5 minutes to match collection interval
    const chartRefreshInterval = setInterval(() => {
      fetchHistoricalData();
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(chartRefreshInterval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId, duration]);

  // Custom tooltip component
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || payload.length === 0) {
      return null;
    }

    const dataPoint = chartData.find(d => d.timeLabel === label);

    return (
      <div className="bg-gray-900/95 backdrop-blur-sm border border-white/20 rounded-lg p-3">
        <p className="text-white text-sm font-semibold mb-2">{label}</p>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {payload.map((entry: any, index: number) => {
          const actualValue = getActualValue(entry.dataKey as string, entry.value as number, dataPoint);
          const unit = getUnit(entry.dataKey as string);

          return (
            <p key={index} className="text-xs" style={{ color: entry.color }}>
              {entry.name}: {actualValue.toFixed(1)} {unit}
            </p>
          );
        })}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 sm:p-6 border border-white/20 mt-6">
        <div className="flex items-center justify-center py-8 sm:py-12">
          <div className="text-center">
            <RefreshCw className="animate-spin h-10 w-10 sm:h-12 sm:w-12 text-blue-400 mx-auto mb-4" />
            <p className="text-white font-medium text-sm sm:text-base">Loading chart data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 sm:p-6 border border-white/20 mt-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h3 className="text-xl font-bold text-white">Historical Trends</h3>

        {/* Time Range Selector */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setDuration('1h')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              duration === '1h'
                ? 'bg-blue-500 text-white'
                : 'bg-white/10 text-blue-200 hover:bg-white/20'
            }`}
          >
            <Clock1 className="w-4 h-4" />
            1h
          </button>
          <button
            onClick={() => setDuration('6h')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              duration === '6h'
                ? 'bg-blue-500 text-white'
                : 'bg-white/10 text-blue-200 hover:bg-white/20'
            }`}
          >
            <Clock6 className="w-4 h-4" />
            6h
          </button>
          <button
            onClick={() => setDuration('24h')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              duration === '24h'
                ? 'bg-blue-500 text-white'
                : 'bg-white/10 text-blue-200 hover:bg-white/20'
            }`}
          >
            <Clock className="w-4 h-4" />
            24h
          </button>
          <button
            onClick={() => setDuration('7d')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              duration === '7d'
                ? 'bg-blue-500 text-white'
                : 'bg-white/10 text-blue-200 hover:bg-white/20'
            }`}
          >
            <CalendarDays className="w-4 h-4" />
            Week
          </button>
          <button
            onClick={() => setDuration('30d')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              duration === '30d'
                ? 'bg-blue-500 text-white'
                : 'bg-white/10 text-blue-200 hover:bg-white/20'
            }`}
          >
            <Calendar className="w-4 h-4" />
            Month
          </button>
          <button
            onClick={() => setDuration('90d')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              duration === '90d'
                ? 'bg-blue-500 text-white'
                : 'bg-white/10 text-blue-200 hover:bg-white/20'
            }`}
          >
            <CalendarRange className="w-4 h-4" />
            Quarter
          </button>
          <button
            onClick={() => setDuration('365d')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              duration === '365d'
                ? 'bg-blue-500 text-white'
                : 'bg-white/10 text-blue-200 hover:bg-white/20'
            }`}
          >
            <CalendarClock className="w-4 h-4" />
            Year
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg">
          <p className="text-red-100 text-sm">⚠️ {error}</p>
        </div>
      )}

      {/* Energy Consumption Stats */}
      {energyConsumption && energyConsumption.kWh > 0 && (
        <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Total Energy Consumption */}
          <div className="bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border border-yellow-500/40 rounded-lg p-3 sm:p-4">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <h4 className="text-yellow-100 text-xs sm:text-sm font-semibold">Total Energy</h4>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-white">
              {energyConsumption.kWh.toFixed(2)}
            </p>
            <p className="text-yellow-200 text-xs mt-1">kWh</p>
          </div>

          {/* Average Power */}
          {powerStats && powerStats.avgWatts !== null && powerStats.avgWatts !== undefined && (
            <div className="bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/40 rounded-lg p-3 sm:p-4">
              <h4 className="text-blue-200 text-xs sm:text-sm font-semibold mb-2">Avg Power</h4>
              <p className="text-2xl sm:text-3xl font-bold text-white">
                {powerStats.avgWatts.toFixed(1)}
              </p>
              <p className="text-blue-200 text-xs mt-1">Watts</p>
            </div>
          )}

          {/* Max Power */}
          {powerStats && powerStats.maxWatts !== null && powerStats.maxWatts !== undefined && (
            <div className="bg-gradient-to-br from-red-500/20 to-pink-500/20 border border-red-500/40 rounded-lg p-3 sm:p-4">
              <h4 className="text-red-200 text-xs sm:text-sm font-semibold mb-2">Peak Power</h4>
              <p className="text-2xl sm:text-3xl font-bold text-white">
                {powerStats.maxWatts.toFixed(1)}
              </p>
              <p className="text-red-200 text-xs mt-1">Watts</p>
            </div>
          )}

          {/* Min Power */}
          {powerStats && powerStats.minWatts !== null && powerStats.minWatts !== undefined && (
            <div className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/40 rounded-lg p-3 sm:p-4">
              <h4 className="text-green-200 text-xs sm:text-sm font-semibold mb-2">Min Power</h4>
              <p className="text-2xl sm:text-3xl font-bold text-white">
                {powerStats.minWatts.toFixed(1)}
              </p>
              <p className="text-green-200 text-xs mt-1">Watts</p>
            </div>
          )}
        </div>
      )}

      {/* Metric Toggles */}
      <div className="flex flex-wrap gap-3 mb-6">
        {Object.entries(visibleMetrics).map(([key, visible]) => {
          const metricKey = key as keyof MetricVisibility;
          const labels: Record<keyof MetricVisibility, string> = {
            cpu: 'CPU',
            ram: 'RAM',
            gpu: 'GPU',
            networkRx: 'Net RX',
            networkTx: 'Net TX',
            power: 'Power',
          };

          return (
            <label key={key} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={visible}
                onChange={() => toggleMetric(metricKey)}
                className="w-4 h-4 rounded border-white/30 bg-white/10 text-blue-500 focus:ring-2 focus:ring-blue-400"
              />
              <span className="text-white text-sm font-medium">{labels[metricKey]}</span>
            </label>
          );
        })}
      </div>

      {/* Chart */}
      {chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height={350} className="sm:!h-[400px]">
          <LineChart
            data={chartData}
            margin={{ top: 5, right: 5, left: -10, bottom: 20 }}
            className="sm:!mr-[10px] sm:!ml-[0px] lg:!mr-[30px] lg:!ml-[15px]"
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />

            <XAxis
              dataKey="timeLabel"
              stroke="rgb(191, 219, 254)"
              style={{ fontSize: '10px' }}
              angle={-45}
              textAnchor="end"
              height={60}
              interval="preserveStartEnd"
              className="sm:!text-xs"
            />

            <YAxis
              stroke="rgb(191, 219, 254)"
              style={{ fontSize: '10px' }}
              domain={[0, 100]}
              width={25}
              className="sm:!text-xs sm:!w-[35px]"
            />

            <Tooltip content={<CustomTooltip />} />

            <Legend
              wrapperStyle={{
                cursor: 'pointer',
                fontSize: '10px',
                paddingTop: '10px'
              }}
              iconSize={10}
              onClick={(e) => {
                const dataKey = e.dataKey as keyof MetricVisibility;
                if (dataKey) toggleMetric(dataKey);
              }}
            />

            {visibleMetrics.cpu && (
              <Line
                type="monotone"
                dataKey="cpu"
                stroke={metricLineColors.cpu}
                strokeWidth={2}
                dot={false}
                name="CPU %"
              />
            )}

            {visibleMetrics.ram && (
              <Line
                type="monotone"
                dataKey="ram"
                stroke={metricLineColors.ram}
                strokeWidth={2}
                dot={false}
                name="RAM %"
              />
            )}

            {visibleMetrics.gpu && (
              <Line
                type="monotone"
                dataKey="gpu"
                stroke={metricLineColors.gpu}
                strokeWidth={2}
                dot={false}
                name="GPU %"
              />
            )}

            {visibleMetrics.networkRx && (
              <Line
                type="monotone"
                dataKey="networkRx"
                stroke={metricLineColors.networkRx}
                strokeWidth={2}
                dot={false}
                name="Net RX"
              />
            )}

            {visibleMetrics.networkTx && (
              <Line
                type="monotone"
                dataKey="networkTx"
                stroke={metricLineColors.networkTx}
                strokeWidth={2}
                dot={false}
                name="Net TX"
              />
            )}

            {visibleMetrics.power && (
              <Line
                type="monotone"
                dataKey="power"
                stroke={metricLineColors.power}
                strokeWidth={2}
                dot={false}
                name="Power"
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      ) : (
        !error && (
          <div className="flex items-center justify-center py-12">
            <p className="text-blue-200 text-sm">No data available for this time range</p>
          </div>
        )
      )}

      {/* Info note */}
      <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
        <p className="text-blue-200 text-xs leading-relaxed">
          💡 <strong>All metrics normalized to 0-100 scale.</strong> Network scaled from 0-1000 Mbps, Power from 0-500W.
          Tap chart points for actual values. Toggle metrics using checkboxes above or legend below.
          {energyConsumption && energyConsumption.kWh > 0 && (
            <span className="block mt-2">
              ⚡ Energy consumption calculated using trapezoidal integration for accurate kWh measurement over the selected time period.
            </span>
          )}
        </p>
      </div>
    </div>
  );
}
