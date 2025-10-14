import { NodeSSH } from 'node-ssh';
import { Device } from './db';

export interface MetricsData {
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
}

export interface MetricsCollectionResult {
  success: boolean;
  metrics?: MetricsData;
  error?: string;
  timestamp: number;
}

/**
 * PowerShell commands for collecting system metrics
 */
const POWERSHELL_COMMANDS = {
  // CPU usage percentage
  cpu: `(Get-Counter '\\Processor(_Total)\\% Processor Time').CounterSamples.CookedValue`,

  // RAM usage (outputs JSON)
  ram: `
    $os = Get-CimInstance Win32_OperatingSystem;
    $totalGB = [math]::Round($os.TotalVisibleMemorySize/1MB, 2);
    $freeGB = [math]::Round($os.FreePhysicalMemory/1MB, 2);
    $usedGB = [math]::Round($totalGB - $freeGB, 2);
    $usedPercent = [math]::Round((1 - $os.FreePhysicalMemory/$os.TotalVisibleMemorySize) * 100, 2);
    Write-Output "$usedGB,$totalGB,$usedPercent"
  `.trim(),

  // GPU usage (NVIDIA only, may fail if no GPU or AMD/Intel)
  gpu: `
    try {
      $result = nvidia-smi --query-gpu=utilization.gpu,memory.used,memory.total --format=csv,noheader,nounits 2>&1;
      if ($LASTEXITCODE -eq 0) { Write-Output $result } else { Write-Output "N/A" }
    } catch {
      Write-Output "N/A"
    }
  `.trim(),

  // Network statistics (returns bytes, need delta calculation)
  network: `
    Get-NetAdapterStatistics |
    Where-Object {$_.Name -notlike '*Loopback*' -and $_.Name -notlike '*Bluetooth*'} |
    Select-Object -First 1 |
    ForEach-Object { Write-Output "$($_.ReceivedBytes),$($_.SentBytes)" }
  `.trim(),
};

/**
 * Collects system metrics from a Windows PC via SSH + PowerShell
 */
export async function collectMetrics(device: Device): Promise<MetricsCollectionResult> {
  const timestamp = Math.floor(Date.now() / 1000);

  // Validate device has required SSH credentials
  if (!device.ip_address || !device.ssh_username || !device.ssh_password) {
    return {
      success: false,
      error: 'Device missing IP address or SSH credentials',
      timestamp,
    };
  }

  const ssh = new NodeSSH();

  try {
    // Connect with 10-second timeout
    await ssh.connect({
      host: device.ip_address,
      username: device.ssh_username,
      password: device.ssh_password,
      timeout: 10000,
    });

    // Collect all metrics in parallel for speed
    const [cpuResult, ramResult, gpuResult, networkResult] = await Promise.allSettled([
      executePowerShellCommand(ssh, POWERSHELL_COMMANDS.cpu, 5000),
      executePowerShellCommand(ssh, POWERSHELL_COMMANDS.ram, 5000),
      executePowerShellCommand(ssh, POWERSHELL_COMMANDS.gpu, 5000),
      executePowerShellCommand(ssh, POWERSHELL_COMMANDS.network, 5000),
    ]);

    // Parse results
    const cpu = cpuResult.status === 'fulfilled' ? parseCpuOutput(cpuResult.value) : null;
    const ram = ramResult.status === 'fulfilled' ? parseRamOutput(ramResult.value) : { used: null, total: null, percent: null };
    const gpu = gpuResult.status === 'fulfilled' ? parseGpuOutput(gpuResult.value) : null;
    const network = networkResult.status === 'fulfilled' ? parseNetworkOutput(networkResult.value) : null;

    return {
      success: true,
      metrics: {
        cpu,
        ram,
        gpu,
        network,
      },
      timestamp,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown SSH error';
    return {
      success: false,
      error: errorMessage,
      timestamp,
    };
  } finally {
    ssh.dispose();
  }
}

/**
 * Execute a PowerShell command via SSH with timeout
 */
async function executePowerShellCommand(
  ssh: NodeSSH,
  command: string,
  timeout: number
): Promise<string> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Command timeout')), timeout);
  });

  const commandPromise = ssh.execCommand(`powershell -Command "${command.replace(/"/g, '\\"')}"`, {
    execOptions: { pty: false },
  });

  const result = await Promise.race([commandPromise, timeoutPromise]);

  if (result.code !== 0) {
    throw new Error(`Command failed: ${result.stderr || result.stdout}`);
  }

  return result.stdout.trim();
}

/**
 * Parse CPU output: single float value (percentage)
 */
function parseCpuOutput(output: string): number | null {
  const value = parseFloat(output);
  return isNaN(value) ? null : Math.round(value * 100) / 100;
}

/**
 * Parse RAM output: "usedGB,totalGB,usedPercent"
 */
function parseRamOutput(output: string): {
  used: number | null;
  total: number | null;
  percent: number | null;
} {
  const parts = output.split(',').map(s => parseFloat(s.trim()));

  if (parts.length !== 3 || parts.some(isNaN)) {
    return { used: null, total: null, percent: null };
  }

  return {
    used: Math.round(parts[0] * 100) / 100,
    total: Math.round(parts[1] * 100) / 100,
    percent: Math.round(parts[2] * 100) / 100,
  };
}

/**
 * Parse GPU output: "usage, memoryUsed, memoryTotal" (NVIDIA format)
 * Returns null if GPU unavailable
 */
function parseGpuOutput(output: string): {
  usage: number | null;
  memoryUsed: number | null;
  memoryTotal: number | null;
} | null {
  if (output === 'N/A' || !output) {
    return null;
  }

  const parts = output.split(',').map(s => parseFloat(s.trim()));

  if (parts.length !== 3 || parts.some(isNaN)) {
    return null;
  }

  return {
    usage: Math.round(parts[0] * 100) / 100,
    memoryUsed: Math.round(parts[1]),
    memoryTotal: Math.round(parts[2]),
  };
}

/**
 * Parse network output: "receivedBytes,sentBytes"
 * Note: This returns cumulative bytes. For rate calculation, need previous sample.
 * Returning null for now as we need delta calculation logic.
 */
function parseNetworkOutput(_output: string): {
  rxMbps: number | null;
  txMbps: number | null;
} | null {
  // Network rate calculation requires storing previous sample and computing delta
  // For MVP, return null and implement in future iteration
  return null;
}
