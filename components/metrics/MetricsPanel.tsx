'use client';

import { useState, useEffect, useRef } from 'react';
import { LineChart, RefreshCw, X } from 'lucide-react';
import MetricCard from './MetricCard';
import MetricsChart from './MetricsChart';

interface MetricsData {
  cpu: number | null;
  ram: {
    used: number | null;
    total: number | null;
    percent: number | null;
  };
  gpu: {
    usage: number | null;
    memoryUsed: number | null;
    memoryTotal: number | null;
  } | null;
  network: {
    rxMbps: number | null;
    txMbps: number | null;
  } | null;
  power: {
    watts: number | null;
    estimated: boolean;
  } | null;
}

interface MetricsPanelProps {
  deviceId: number;
  deviceName: string;
  deviceIpAddress?: string | null;
  onClose?: () => void;
}

export default function MetricsPanel({ deviceId, deviceName, deviceIpAddress, onClose }: MetricsPanelProps) {
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [collecting, setCollecting] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [pollIntervalMs, setPollIntervalMs] = useState(300000); // Default: 5 minutes
  const pollingInterval = useRef<NodeJS.Timeout | null>(null);

  // Collect metrics from the device
  const collectMetrics = async () => {
    setCollecting(true);
    try {
      const response = await fetch('/api/metrics/collect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ deviceId }),
      });

      if (!response.ok) {
        throw new Error('Failed to collect metrics');
      }

      const data = await response.json();
      setMetrics(data.metrics);
      setLastUpdate(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to collect metrics');
    } finally {
      setCollecting(false);
      setLoading(false); // Ensure loading state is cleared
    }
  };

  // Load latest metrics from database
  const loadLatestMetrics = async () => {
    try {
      const response = await fetch(`/api/metrics/${deviceId}/latest`);

      if (!response.ok) {
        // If no metrics available yet, try to collect
        if (response.status === 200) {
          const data = await response.json();
          if (!data.metrics) {
            await collectMetrics();
            return;
          }
        }
        throw new Error('Failed to load metrics');
      }

      const data = await response.json();
      if (data.metrics) {
        setMetrics(data.metrics);
        setLastUpdate(new Date(data.collectedAt));
        setError(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load metrics');
    } finally {
      setLoading(false);
    }
  };

  // Smart polling: Check device status and collect metrics if online
  const smartPoll = async () => {
    // Skip if no IP address configured
    if (!deviceIpAddress) {
      await loadLatestMetrics();
      return;
    }

    try {
      // Check device online status
      const statusResponse = await fetch('/api/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ipAddress: deviceIpAddress }),
      });

      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        setIsOnline(statusData.online);

        if (statusData.online) {
          // Device is online → Collect fresh metrics from PC
          await collectMetrics();
        } else {
          // Device is offline → Load latest from database
          await loadLatestMetrics();
        }
      } else {
        // Status check failed → Fallback to DB
        setIsOnline(false);
        await loadLatestMetrics();
      }
    } catch (error) {
      console.error('Smart polling error:', error);
      // Fallback to DB on error
      setIsOnline(false);
      await loadLatestMetrics();
    } finally {
      // Always ensure loading state is cleared
      setLoading(false);
    }
  };

  // Load user preferences for polling interval
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const response = await fetch('/api/preferences');
        if (response.ok) {
          const data = await response.json();
          setPollIntervalMs(data.preferences.metrics_poll_interval_ms || 300000);
        }
      } catch (error) {
        console.error('Failed to load preferences:', error);
      }
    };

    loadPreferences();
  }, []);

  // Initial load and polling setup
  useEffect(() => {
    smartPoll(); // Initial load

    // Poll based on user preference
    pollingInterval.current = setInterval(() => {
      smartPoll();
    }, pollIntervalMs);

    return () => {
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId, deviceIpAddress, pollIntervalMs]);

  if (loading) {
    return (
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-4 sm:p-6 border border-white/20">
        <div className="flex items-center justify-center py-8 sm:py-12">
          <div className="text-center">
            <svg className="animate-spin h-10 w-10 sm:h-12 sm:w-12 text-blue-400 mx-auto mb-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <p className="text-white font-medium text-sm sm:text-base">Loading metrics...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-4 sm:p-6 border border-white/20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <LineChart className="w-6 h-6 sm:w-7 sm:h-7 text-blue-300" strokeWidth={2} />
            <h2 className="text-xl sm:text-2xl font-bold text-white">System Metrics</h2>
            {/* Online indicator */}
            {deviceIpAddress && (
              <span className={`text-xs px-2 py-1 rounded flex items-center gap-1 ${
                isOnline
                  ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                  : 'bg-red-500/20 text-red-300 border border-red-500/30'
              }`}>
                <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-400' : 'bg-red-400'}`} />
                {isOnline ? 'Online' : 'Offline'}
              </span>
            )}
          </div>
          <p className="text-blue-200 text-sm mt-1">{deviceName}</p>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
          {lastUpdate && (
            <span className="text-xs text-blue-200 order-2 sm:order-1">
              Last updated: {lastUpdate.toLocaleTimeString()}
            </span>
          )}
          <div className="flex items-center gap-2 order-1 sm:order-2">
            <button
              onClick={collectMetrics}
              disabled={collecting}
              className="px-3 sm:px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 disabled:bg-gray-500/20 border border-blue-500/50 text-blue-100 text-sm font-medium rounded-lg transition-colors disabled:cursor-not-allowed flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${collecting ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{collecting ? 'Collecting...' : 'Refresh'}</span>
              <span className="sm:hidden">{collecting ? '...' : ''}</span>
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="px-3 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 text-red-100 text-sm font-medium rounded-lg transition-colors"
                aria-label="Close metrics"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg">
          <p className="text-red-100 text-sm">⚠️ {error}</p>
        </div>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* CPU */}
        <MetricCard
          title="CPU"
          value={metrics?.cpu ?? null}
          unit="%"
          max={100}
          icon="cpu"
          subtitle="Processor Usage"
        />

        {/* RAM */}
        <MetricCard
          title="RAM"
          value={metrics?.ram?.percent ?? null}
          unit="%"
          max={100}
          icon="ram"
          subtitle={
            metrics?.ram?.used !== null && metrics?.ram?.used !== undefined &&
            metrics?.ram?.total !== null && metrics?.ram?.total !== undefined
              ? `${metrics.ram.used.toFixed(1)} / ${metrics.ram.total.toFixed(1)} GB`
              : undefined
          }
        />

        {/* GPU */}
        {metrics?.gpu && (
          <MetricCard
            title="GPU"
            value={metrics.gpu.usage ?? null}
            unit="%"
            max={100}
            icon="gpu"
            subtitle={
              metrics.gpu.memoryUsed !== null && metrics.gpu.memoryUsed !== undefined &&
              metrics.gpu.memoryTotal !== null && metrics.gpu.memoryTotal !== undefined
                ? `${metrics.gpu.memoryUsed} / ${metrics.gpu.memoryTotal} MB`
                : undefined
            }
          />
        )}

        {/* Network RX */}
        {metrics?.network && (
          <MetricCard
            title="Network RX"
            value={metrics.network.rxMbps ?? null}
            unit="Mbps"
            max={1000}
            icon="networkRx"
            subtitle="Download Speed"
            adaptiveUnit={true}
          />
        )}

        {/* Network TX */}
        {metrics?.network && (
          <MetricCard
            title="Network TX"
            value={metrics.network.txMbps ?? null}
            unit="Mbps"
            max={1000}
            icon="networkTx"
            subtitle="Upload Speed"
            adaptiveUnit={true}
          />
        )}

        {/* Power */}
        {metrics?.power && (
          <MetricCard
            title="Power"
            value={metrics.power.watts ?? null}
            unit="W"
            max={500}
            icon="power"
            subtitle={metrics.power.estimated ? "Estimated" : "Consumption"}
          />
        )}
      </div>

      {/* Historical Chart */}
      <MetricsChart deviceId={deviceId} deviceName={deviceName} />

      {/* Info note */}
      <div className="mt-6 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
        <p className="text-blue-200 text-xs">
          💡 {deviceIpAddress
            ? `Metrics are auto-collected every ${Math.round(pollIntervalMs / 60000)} minutes when PC is online. Click "Refresh" to collect immediately.`
            : 'Configure device IP address to enable auto-collection. Click "Refresh" to collect metrics.'
          }
          {metrics?.power?.estimated && (
            <span className="block mt-1">
              ⚡ Power consumption is estimated based on CPU/GPU usage (hardware monitoring unavailable).
            </span>
          )}
        </p>
      </div>
    </div>
  );
}
