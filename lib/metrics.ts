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
    powerDraw?: number | null;
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

  // RAM usage (outputs comma-separated values on single line)
  ram: `
    $os = Get-CimInstance Win32_OperatingSystem;
    $totalGB = [math]::Round($os.TotalVisibleMemorySize/1MB, 2);
    $freeGB = [math]::Round($os.FreePhysicalMemory/1MB, 2);
    $usedGB = [math]::Round($totalGB - $freeGB, 2);
    $usedPercent = [math]::Round((1 - $os.FreePhysicalMemory/$os.TotalVisibleMemorySize) * 100, 2);
    @($usedGB,$totalGB,$usedPercent) -join ','
  `.trim(),

  // GPU usage and power draw (NVIDIA only, may fail if no GPU or AMD/Intel)
  gpu: `
    try {
      $result = nvidia-smi --query-gpu=utilization.gpu,memory.used,memory.total,power.draw --format=csv,noheader,nounits 2>&1;
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

  // CPU power consumption (Intel-specific counter for package power)
  cpuPower: `
    try {
      $cpuPower = (Get-Counter '\\Power Meter(Intel CPU)\\Power').CounterSamples.CookedValue;
      if ($cpuPower -and $cpuPower -gt 0) {
        [math]::Round($cpuPower, 2)
      } else {
        Write-Output "N/A"
      }
    } catch {
      Write-Output "N/A"
    }
  `.trim(),

  // Total system power consumption (may not be available on all systems)
  power: `
    try {
      $power = (Get-Counter '\\Power Meter(_Total)\\Power').CounterSamples.CookedValue;
      if ($power -and $power -gt 0) {
        [math]::Round($power, 2)
      } else {
        Write-Output "N/A"
      }
    } catch {
      Write-Output "N/A"
    }
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
    const [cpuResult, ramResult, gpuResult, networkResult, cpuPowerResult, powerResult] = await Promise.allSettled([
      executePowerShellCommand(ssh, POWERSHELL_COMMANDS.cpu, 5000),
      executePowerShellCommand(ssh, POWERSHELL_COMMANDS.ram, 5000),
      executePowerShellCommand(ssh, POWERSHELL_COMMANDS.gpu, 5000),
      executePowerShellCommand(ssh, POWERSHELL_COMMANDS.network, 5000),
      executePowerShellCommand(ssh, POWERSHELL_COMMANDS.cpuPower, 5000),
      executePowerShellCommand(ssh, POWERSHELL_COMMANDS.power, 5000),
    ]);

    // Parse results
    const cpu = cpuResult.status === 'fulfilled' ? parseCpuOutput(cpuResult.value) : null;
    const ram = ramResult.status === 'fulfilled' ? parseRamOutput(ramResult.value) : { used: null, total: null, percent: null };
    const gpu = gpuResult.status === 'fulfilled' ? parseGpuOutput(gpuResult.value) : null;
    const network = networkResult.status === 'fulfilled' ? parseNetworkOutput(networkResult.value) : null;
    const cpuPower = cpuPowerResult.status === 'fulfilled' ? parseCpuPowerOutput(cpuPowerResult.value) : null;
    const totalPower = powerResult.status === 'fulfilled' ? parsePowerOutput(powerResult.value) : null;

    // Determine power consumption strategy
    let power: { watts: number; estimated: boolean } | null = null;

    // Strategy 1: Use total system power meter (most accurate, includes everything)
    if (totalPower && totalPower.watts !== null) {
      power = { watts: totalPower.watts, estimated: false };
    }
    // Strategy 2: Aggregate CPU + GPU sensor power (hardware sensors)
    else if ((cpuPower !== null && cpuPower > 0) || (gpu && gpu.powerDraw !== null && gpu.powerDraw !== undefined && gpu.powerDraw > 0)) {
      const cpuWatts = cpuPower ?? 0;
      const gpuWatts = gpu?.powerDraw ?? 0;
      const baseSystemWatts = 50; // Motherboard, RAM, storage, fans estimate
      power = { watts: cpuWatts + gpuWatts + baseSystemWatts, estimated: false };
    }
    // Strategy 3: Estimate from CPU/GPU utilization
    else if (cpu !== null) {
      const estimatedWatts = estimatePowerConsumption(cpu, gpu);
      if (estimatedWatts !== null) {
        power = { watts: estimatedWatts, estimated: true };
      }
    }

    return {
      success: true,
      metrics: {
        cpu,
        ram,
        gpu,
        network,
        power,
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

  // Use Base64 encoding to avoid all shell escaping issues
  // PowerShell expects UTF-16LE encoding for EncodedCommand
  const commandBuffer = Buffer.from(command, 'utf16le');
  const base64Command = commandBuffer.toString('base64');

  const commandPromise = ssh.execCommand(`powershell -NoProfile -EncodedCommand ${base64Command}`, {
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
 * Parse RAM output: "usedGB,totalGB,usedPercent" or "usedGB\ntotalGB\nusedPercent"
 */
function parseRamOutput(output: string): {
  used: number | null;
  total: number | null;
  percent: number | null;
} {
  // Try comma-separated first
  let parts = output.split(',').map(s => parseFloat(s.trim()));

  // If that doesn't work, try newline-separated
  if (parts.length !== 3 || parts.some(isNaN)) {
    parts = output.split(/[\r\n]+/).map(s => parseFloat(s.trim()));
  }

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
 * Parse GPU output: "usage, memoryUsed, memoryTotal, powerDraw" (NVIDIA format)
 * Returns null if GPU unavailable
 */
function parseGpuOutput(output: string): {
  usage: number | null;
  memoryUsed: number | null;
  memoryTotal: number | null;
  powerDraw?: number | null;
} | null {
  if (output === 'N/A' || !output) {
    return null;
  }

  const parts = output.split(',').map(s => parseFloat(s.trim()));

  // Support both old format (3 values) and new format (4 values with power draw)
  if (parts.length === 3 && !parts.some(isNaN)) {
    return {
      usage: Math.round(parts[0] * 100) / 100,
      memoryUsed: Math.round(parts[1]),
      memoryTotal: Math.round(parts[2]),
      powerDraw: null,
    };
  }

  if (parts.length === 4 && !parts.some(isNaN)) {
    return {
      usage: Math.round(parts[0] * 100) / 100,
      memoryUsed: Math.round(parts[1]),
      memoryTotal: Math.round(parts[2]),
      powerDraw: Math.round(parts[3] * 100) / 100, // Power in Watts
    };
  }

  return null;
}

/**
 * Parse network output: "receivedBytes,sentBytes"
 * Note: This returns cumulative bytes. For rate calculation, need previous sample.
 * Returning null for now as we need delta calculation logic.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function parseNetworkOutput(_output: string): {
  rxMbps: number | null;
  txMbps: number | null;
} | null {
  // Network rate calculation requires storing previous sample and computing delta
  // For MVP, return null and implement in future iteration
  return null;
}

/**
 * Parse CPU power output: watts value from Intel power sensor
 * Returns null if sensor unavailable
 */
function parseCpuPowerOutput(output: string): number | null {
  if (output === 'N/A' || !output) {
    return null;
  }

  const value = parseFloat(output);
  if (isNaN(value) || value <= 0) {
    return null;
  }

  return Math.round(value * 100) / 100;
}

/**
 * Parse power output: watts value
 * Returns null if power meter unavailable
 */
function parsePowerOutput(output: string): {
  watts: number | null;
} | null {
  if (output === 'N/A' || !output) {
    return null;
  }

  const value = parseFloat(output);
  if (isNaN(value) || value <= 0) {
    return null;
  }

  return {
    watts: Math.round(value * 100) / 100,
  };
}

/**
 * Estimate power consumption based on CPU and GPU utilization
 * Uses real TDP values for Intel Core i9-13900KF and NVIDIA RTX 4080
 */
function estimatePowerConsumption(
  cpuPercent: number,
  gpu: { usage: number | null; powerDraw?: number | null } | null
): number | null {
  // Component power consumption (watts) - Real hardware TDP values
  const BASE_SYSTEM_POWER = 50; // Motherboard, RAM, storage, fans
  const CPU_TDP = 253; // Intel Core i9-13900KF (PL2/Turbo Power)
  const GPU_TDP = 320; // NVIDIA RTX 4080 ASUS ROG Gaming OC

  // CPU power scales with utilization using square root for realistic power curve
  // Square root models how modern CPUs scale power with frequency/utilization
  const cpuPower = BASE_SYSTEM_POWER + (CPU_TDP * Math.sqrt(cpuPercent / 100));

  // Add GPU power if GPU present and has usage data
  let gpuPower = 0;
  if (gpu && gpu.usage !== null && gpu.usage > 0) {
    // GPU power also scales with utilization
    gpuPower = GPU_TDP * Math.sqrt(gpu.usage / 100);
  }

  const totalPower = cpuPower + gpuPower;

  return Math.round(totalPower * 100) / 100;
}
