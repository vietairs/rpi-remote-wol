'use client';

import { useState, useEffect, useRef } from 'react';
import MetricCard from './MetricCard';

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
  } | null;
}

interface MetricsPanelProps {
  deviceId: number;
  deviceName: string;
  onClose?: () => void;
}

export default function MetricsPanel({ deviceId, deviceName, onClose }: MetricsPanelProps) {
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [collecting, setCollecting] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
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

  // Initial load
  useEffect(() => {
    loadLatestMetrics();

    // Set up polling every 30 seconds
    pollingInterval.current = setInterval(() => {
      loadLatestMetrics();
    }, 30000);

    return () => {
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
      }
    };
  }, [deviceId]);

  if (loading) {
    return (
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <svg className="animate-spin h-12 w-12 text-blue-400 mx-auto mb-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <p className="text-white font-medium">Loading metrics...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            📊 System Metrics
          </h2>
          <p className="text-blue-200 text-sm mt-1">{deviceName}</p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdate && (
            <span className="text-xs text-blue-200">
              Last updated: {lastUpdate.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={collectMetrics}
            disabled={collecting}
            className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 disabled:bg-gray-500/20 border border-blue-500/50 text-blue-100 text-sm font-medium rounded-lg transition-colors disabled:cursor-not-allowed flex items-center gap-2"
          >
            {collecting ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Collecting...
              </>
            ) : (
              <>🔄 Refresh</>
            )}
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="px-3 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 text-red-100 text-sm font-medium rounded-lg transition-colors"
            >
              ✕
            </button>
          )}
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
          icon="🔥"
          subtitle="Processor Usage"
        />

        {/* RAM */}
        <MetricCard
          title="RAM"
          value={metrics?.ram?.percent ?? null}
          unit="%"
          max={100}
          icon="💾"
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
            icon="🎮"
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
            icon="📥"
            subtitle="Download Speed"
          />
        )}

        {/* Network TX */}
        {metrics?.network && (
          <MetricCard
            title="Network TX"
            value={metrics.network.txMbps ?? null}
            unit="Mbps"
            max={1000}
            icon="📤"
            subtitle="Upload Speed"
          />
        )}

        {/* Power */}
        {metrics?.power && (
          <MetricCard
            title="Power"
            value={metrics.power.watts ?? null}
            unit="W"
            max={500}
            icon="⚡"
            subtitle="Consumption"
          />
        )}
      </div>

      {/* Info note */}
      <div className="mt-6 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
        <p className="text-blue-200 text-xs">
          💡 Metrics are automatically refreshed every 30 seconds. Click &quot;Refresh&quot; to collect new data immediately.
        </p>
      </div>
    </div>
  );
}
