// Icon color consistency utilities for metrics components
// Maps metric types to their corresponding Tailwind text color classes

export const metricIconColors = {
  cpu: 'text-orange-400',
  ram: 'text-blue-400',
  gpu: 'text-purple-400',
  networkRx: 'text-green-400',
  networkTx: 'text-teal-400',
  power: 'text-yellow-400',
} as const;

export type MetricType = keyof typeof metricIconColors;

// Chart line colors (hex values for Recharts)
export const metricLineColors = {
  cpu: '#f97316',    // orange-500
  ram: '#3b82f6',    // blue-500
  gpu: '#a855f7',    // purple-500
  networkRx: '#22c55e', // green-500
  networkTx: '#14b8a6', // teal-500
  power: '#eab308',  // yellow-500
} as const;

// Metric display names
export const metricNames = {
  cpu: 'CPU',
  ram: 'RAM',
  gpu: 'GPU',
  networkRx: 'Network RX',
  networkTx: 'Network TX',
  power: 'Power',
} as const;
