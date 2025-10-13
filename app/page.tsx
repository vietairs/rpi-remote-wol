'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface Device {
  id: number;
  name: string;
  mac_address: string;
  ip_address: string | null;
  ssh_username: string | null;
  ssh_password: string | null;
  created_at: string;
  updated_at: string;
}

interface DeviceStatus {
  online: boolean;
  rdpReady: boolean;
  checking: boolean;
  waking: boolean;
}

export default function Home() {
  const router = useRouter();
  const [status, setStatus] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [macAddress, setMacAddress] = useState<string>('');
  const [ipAddress, setIpAddress] = useState<string>('');
  const [deviceName, setDeviceName] = useState<string>('');
  const [sshUsername, setSshUsername] = useState<string>('');
  const [sshPassword, setSshPassword] = useState<string>('');
  const [savedDevices, setSavedDevices] = useState<Device[]>([]);
  const [showSaveForm, setShowSaveForm] = useState<boolean>(false);
  const [selectedDeviceId, setSelectedDeviceId] = useState<number | null>(null);
  const [deviceStatuses, setDeviceStatuses] = useState<Map<number, DeviceStatus>>(new Map());
  const [currentUser, setCurrentUser] = useState<string>('');
  const statusCheckInterval = useRef<NodeJS.Timeout | null>(null);
  const wakeMonitorTimeout = useRef<NodeJS.Timeout | null>(null);

  // Load saved devices on mount
  useEffect(() => {
    loadDevices();
    checkSession();
    return () => {
      if (statusCheckInterval.current) clearInterval(statusCheckInterval.current);
      if (wakeMonitorTimeout.current) clearTimeout(wakeMonitorTimeout.current);
    };
  }, []);

  const checkSession = async () => {
    try {
      const response = await fetch('/api/auth/session');
      const data = await response.json();
      if (data.authenticated && data.user) {
        setCurrentUser(data.user.username);
      }
    } catch (error) {
      console.error('Failed to check session:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  // Start periodic status checks
  useEffect(() => {
    if (savedDevices.length > 0) {
      checkAllDeviceStatuses();
      statusCheckInterval.current = setInterval(() => {
        checkAllDeviceStatuses();
      }, 30000); // Check every 30 seconds
    }

    return () => {
      if (statusCheckInterval.current) {
        clearInterval(statusCheckInterval.current);
      }
    };
  }, [savedDevices]);

  const loadDevices = async () => {
    try {
      const response = await fetch('/api/devices');
      const data = await response.json();
      if (response.ok) {
        setSavedDevices(data.devices);
      }
    } catch (error) {
      console.error('Failed to load devices:', error);
    }
  };

  const checkDeviceStatus = async (device: Device): Promise<DeviceStatus> => {
    if (!device.ip_address) {
      return { online: false, rdpReady: false, checking: false, waking: false };
    }

    try {
      const response = await fetch('/api/status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ipAddress: device.ip_address }),
      });

      const data = await response.json();

      if (response.ok) {
        return {
          online: data.online,
          rdpReady: data.rdpReady,
          checking: false,
          waking: false,
        };
      }
    } catch (error) {
      console.error(`Failed to check status for ${device.name}:`, error);
    }

    return { online: false, rdpReady: false, checking: false, waking: false };
  };

  const checkAllDeviceStatuses = useCallback(async () => {
    const newStatuses = new Map<number, DeviceStatus>();

    for (const device of savedDevices) {
      if (device.ip_address) {
        setDeviceStatuses(prev => new Map(prev.set(device.id, {
          ...prev.get(device.id),
          checking: true,
          online: prev.get(device.id)?.online || false,
          rdpReady: prev.get(device.id)?.rdpReady || false,
          waking: prev.get(device.id)?.waking || false,
        })));

        const deviceStatus = await checkDeviceStatus(device);
        newStatuses.set(device.id, {
          ...deviceStatus,
          waking: deviceStatuses.get(device.id)?.waking || false,
        });
      }
    }

    setDeviceStatuses(prev => {
      const updated = new Map(prev);
      newStatuses.forEach((status, id) => {
        updated.set(id, status);
      });
      return updated;
    });
  }, [savedDevices]);

  const monitorDeviceAfterWake = async (device: Device) => {
    if (!device.ip_address) return;

    const maxAttempts = 12; // Monitor for 60 seconds (12 * 5 seconds)
    let attempts = 0;

    const checkStatus = async () => {
      attempts++;
      const deviceStatus = await checkDeviceStatus(device);

      setDeviceStatuses(prev => new Map(prev.set(device.id, {
        ...deviceStatus,
        waking: !deviceStatus.online && attempts < maxAttempts,
      })));

      if (deviceStatus.online) {
        if (deviceStatus.rdpReady) {
          setStatus(`${device.name} is online and ready for Remote Desktop!`);
        } else {
          setStatus(`${device.name} is online but RDP is not ready yet`);
        }
        return;
      }

      if (attempts < maxAttempts) {
        wakeMonitorTimeout.current = setTimeout(checkStatus, 5000);
      } else {
        setDeviceStatuses(prev => new Map(prev.set(device.id, {
          ...prev.get(device.id),
          waking: false,
          online: false,
          rdpReady: false,
          checking: false,
        })));
        setStatus(`${device.name} did not respond after wake attempt`);
      }
    };

    setTimeout(checkStatus, 3000); // Start checking after 3 seconds
  };

  const handleWake = async () => {
    if (!macAddress) {
      setStatus('Please enter a MAC address');
      return;
    }

    setLoading(true);
    setStatus('Sending Wake-on-LAN packet...');

    try {
      const response = await fetch('/api/wake', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ macAddress }),
      });

      const data = await response.json();

      if (response.ok) {
        setStatus(`Success! Wake packet sent to ${data.macAddress}`);

        // Find the device and start monitoring
        const device = savedDevices.find(d => d.mac_address === macAddress);
        if (device && device.ip_address) {
          setDeviceStatuses(prev => new Map(prev.set(device.id, {
            online: false,
            rdpReady: false,
            checking: false,
            waking: true,
          })));
          monitorDeviceAfterWake(device);
        }
      } else {
        setStatus(`Error: ${data.error}`);
      }
    } catch (error) {
      setStatus('Failed to connect to server');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDiscoverIp = async () => {
    if (!macAddress) {
      setStatus('Please enter a MAC address first');
      return;
    }

    setStatus('Discovering IP address...');

    try {
      const response = await fetch('/api/discover-ip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ macAddress }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setIpAddress(data.ipAddress);
        setStatus(`Found IP address: ${data.ipAddress}`);
      } else {
        setStatus(data.message || 'Could not find IP address');
      }
    } catch (error) {
      setStatus('Failed to discover IP address');
      console.error(error);
    }
  };

  const handleSaveDevice = async () => {
    if (!deviceName || !macAddress) {
      setStatus('Please enter both device name and MAC address');
      return;
    }

    try {
      const response = await fetch('/api/devices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: deviceName,
          macAddress,
          ipAddress: ipAddress || undefined,
          sshUsername: sshUsername || undefined,
          sshPassword: sshPassword || undefined,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setStatus(`Device "${deviceName}" saved successfully!`);
        setDeviceName('');
        setIpAddress('');
        setSshUsername('');
        setSshPassword('');
        setShowSaveForm(false);
        await loadDevices();
      } else {
        setStatus(`Error: ${data.error}`);
      }
    } catch (error) {
      setStatus('Failed to save device');
      console.error(error);
    }
  };

  const handleDeleteDevice = async (id: number) => {
    if (!confirm('Are you sure you want to delete this device?')) {
      return;
    }

    try {
      const response = await fetch(`/api/devices/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setStatus('Device deleted successfully');
        if (selectedDeviceId === id) {
          setSelectedDeviceId(null);
          setMacAddress('');
          setIpAddress('');
        }
        setDeviceStatuses(prev => {
          const updated = new Map(prev);
          updated.delete(id);
          return updated;
        });
        await loadDevices();
      } else {
        const data = await response.json();
        setStatus(`Error: ${data.error}`);
      }
    } catch (error) {
      setStatus('Failed to delete device');
      console.error(error);
    }
  };

  const handleSelectDevice = (device: Device) => {
    setMacAddress(device.mac_address);
    setIpAddress(device.ip_address || '');
    setSelectedDeviceId(device.id);
    setStatus(`Selected: ${device.name}`);
  };

  const handleShutdown = async (deviceId: number) => {
    const device = savedDevices.find(d => d.id === deviceId);
    if (!device) return;

    if (!device.ssh_username || !device.ssh_password) {
      setStatus('SSH credentials not configured for this device. Please edit and add SSH credentials.');
      return;
    }

    if (!confirm(`Are you sure you want to shutdown ${device.name}?`)) {
      return;
    }

    setLoading(true);
    setStatus(`Sending shutdown command to ${device.name}...`);

    try {
      const response = await fetch('/api/shutdown', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ deviceId }),
      });

      const data = await response.json();

      if (response.ok) {
        setStatus(`Success! Shutdown command sent to ${device.name}`);
      } else {
        setStatus(`Error: ${data.error}${data.details ? ' - ' + data.details : ''}`);
      }
    } catch (error) {
      setStatus('Failed to send shutdown command');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSleep = async (deviceId: number) => {
    const device = savedDevices.find(d => d.id === deviceId);
    if (!device) return;

    if (!device.ssh_username || !device.ssh_password) {
      setStatus('SSH credentials not configured for this device. Please edit and add SSH credentials.');
      return;
    }

    if (!confirm(`Are you sure you want to sleep ${device.name}?`)) {
      return;
    }

    setLoading(true);
    setStatus(`Sending sleep command to ${device.name}...`);

    try {
      const response = await fetch('/api/sleep', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ deviceId }),
      });

      const data = await response.json();

      if (response.ok) {
        setStatus(`Success! Sleep command sent to ${device.name}`);
      } else {
        setStatus(`Error: ${data.error}${data.details ? ' - ' + data.details : ''}`);
      }
    } catch (error) {
      setStatus('Failed to send sleep command');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (device: Device) => {
    const deviceStatus = deviceStatuses.get(device.id);

    if (!device.ip_address) {
      return (
        <span className="text-xs px-2 py-1 rounded bg-gray-500/20 text-gray-300">
          No IP
        </span>
      );
    }

    if (deviceStatus?.checking) {
      return (
        <span className="text-xs px-2 py-1 rounded bg-blue-500/20 text-blue-300 flex items-center gap-1">
          <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Checking
        </span>
      );
    }

    if (deviceStatus?.waking) {
      return (
        <span className="text-xs px-2 py-1 rounded bg-yellow-500/20 text-yellow-300 flex items-center gap-1 animate-pulse">
          <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
            <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z" />
          </svg>
          Waking
        </span>
      );
    }

    if (deviceStatus?.online) {
      if (deviceStatus.rdpReady) {
        return (
          <span className="text-xs px-2 py-1 rounded bg-green-500/20 text-green-300 flex items-center gap-1">
            <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            RDP Ready
          </span>
        );
      }
      return (
        <span className="text-xs px-2 py-1 rounded bg-green-500/20 text-green-300 flex items-center gap-1">
          <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          Online
        </span>
      );
    }

    return (
      <span className="text-xs px-2 py-1 rounded bg-red-500/20 text-red-300">
        Offline
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 flex items-center justify-center p-4">
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-8 w-full max-w-4xl border border-white/20">
        <div className="flex justify-between items-center mb-8">
          <div className="text-center flex-1">
            <h1 className="text-4xl font-bold text-white mb-2">
              PC Remote Wake
            </h1>
            <p className="text-blue-200">Wake your Windows 11 PC remotely</p>
          </div>
          <div className="flex items-center gap-4">
            {currentUser && (
              <span className="text-blue-200 text-sm">
                {currentUser}
              </span>
            )}
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-200 hover:text-red-100 border border-red-500/50 rounded-lg transition-colors text-sm font-medium"
              title="Logout"
            >
              Logout
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Left column - Wake controls */}
          <div className="space-y-6">
            <div>
              <label
                htmlFor="macAddress"
                className="block text-sm font-medium text-blue-100 mb-2"
              >
                PC MAC Address
              </label>
              <input
                id="macAddress"
                type="text"
                value={macAddress}
                onChange={(e) => setMacAddress(e.target.value)}
                placeholder="XX:XX:XX:XX:XX:XX"
                className="w-full px-4 py-3 bg-white/10 border border-white/30 rounded-lg text-white placeholder-blue-300/50 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
              />
              <p className="mt-1 text-xs text-blue-200">
                Format: XX:XX:XX:XX:XX:XX or XX-XX-XX-XX-XX-XX
              </p>
            </div>

            <button
              onClick={handleWake}
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:from-gray-500 disabled:to-gray-600 text-white font-semibold py-4 px-6 rounded-lg shadow-lg transition-all duration-200 transform hover:scale-105 disabled:scale-100 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg
                    className="animate-spin h-5 w-5 mr-3"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Sending...
                </span>
              ) : (
                '⚡ Wake PC'
              )}
            </button>

            {!showSaveForm ? (
              <button
                onClick={() => setShowSaveForm(true)}
                className="w-full bg-white/10 hover:bg-white/20 text-white font-medium py-3 px-6 rounded-lg border border-white/30 transition-colors"
              >
                💾 Save This Device
              </button>
            ) : (
              <div className="space-y-3 p-4 bg-white/5 rounded-lg border border-white/20">
                <input
                  type="text"
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                  placeholder="Device name (e.g., Gaming PC)"
                  className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white placeholder-blue-300/50 focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={ipAddress}
                      onChange={(e) => setIpAddress(e.target.value)}
                      placeholder="IP Address (optional)"
                      className="flex-1 px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white placeholder-blue-300/50 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                    <button
                      onClick={handleDiscoverIp}
                      className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors whitespace-nowrap"
                      title="Auto-discover IP from MAC address"
                    >
                      🔍 Find IP
                    </button>
                  </div>
                  <p className="text-xs text-blue-200">
                    IP address enables status monitoring. Click Find IP to auto-discover.
                  </p>
                </div>
                <div className="space-y-2 pt-2 border-t border-white/10">
                  <p className="text-xs text-blue-200 font-medium">
                    SSH Credentials (for Shutdown/Sleep)
                  </p>
                  <input
                    type="text"
                    value={sshUsername}
                    onChange={(e) => setSshUsername(e.target.value)}
                    placeholder="SSH Username (optional)"
                    className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white placeholder-blue-300/50 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                  <input
                    type="password"
                    value={sshPassword}
                    onChange={(e) => setSshPassword(e.target.value)}
                    placeholder="SSH Password (optional)"
                    className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white placeholder-blue-300/50 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                  <p className="text-xs text-blue-200">
                    Required for remote shutdown/sleep. Ensure OpenSSH server is enabled on Windows.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveDevice}
                    className="flex-1 bg-green-500 hover:bg-green-600 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setShowSaveForm(false);
                      setDeviceName('');
                      setIpAddress('');
                      setSshUsername('');
                      setSshPassword('');
                    }}
                    className="flex-1 bg-red-500 hover:bg-red-600 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right column - Saved devices with status */}
          <div>
            <h3 className="text-white font-semibold mb-3">Saved Devices</h3>
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {savedDevices.length === 0 ? (
                <p className="text-blue-200 text-sm text-center py-4">
                  No saved devices yet
                </p>
              ) : (
                savedDevices.map((device) => (
                  <div
                    key={device.id}
                    className={`p-3 rounded-lg border transition-all cursor-pointer ${
                      selectedDeviceId === device.id
                        ? 'bg-blue-500/30 border-blue-400'
                        : 'bg-white/5 border-white/20 hover:bg-white/10'
                    }`}
                    onClick={() => handleSelectDevice(device)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="text-white font-medium">
                            {device.name}
                          </h4>
                          {getStatusBadge(device)}
                        </div>
                        <p className="text-blue-200 text-xs">
                          {device.mac_address}
                        </p>
                        {device.ip_address && (
                          <p className="text-blue-300 text-xs mt-1">
                            IP: {device.ip_address}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteDevice(device.id);
                        }}
                        className="text-red-300 hover:text-red-100 transition-colors ml-2"
                        title="Delete device"
                      >
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </div>
                    {device.ssh_username && device.ssh_password && deviceStatuses.get(device.id)?.online && (
                      <div className="flex gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleSleep(device.id)}
                          disabled={loading}
                          className="flex-1 px-3 py-1.5 bg-yellow-500/20 hover:bg-yellow-500/30 disabled:bg-gray-500/20 border border-yellow-500/50 text-yellow-100 text-xs font-medium rounded transition-colors disabled:cursor-not-allowed"
                          title="Put device to sleep"
                        >
                          💤 Sleep
                        </button>
                        <button
                          onClick={() => handleShutdown(device.id)}
                          disabled={loading}
                          className="flex-1 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 disabled:bg-gray-500/20 border border-red-500/50 text-red-100 text-xs font-medium rounded transition-colors disabled:cursor-not-allowed"
                          title="Shutdown device"
                        >
                          🔴 Shutdown
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {status && (
          <div
            className={`mt-6 p-4 rounded-lg ${
              status.includes('Success') || status.includes('saved') || status.includes('ready')
                ? 'bg-green-500/20 border border-green-500/50 text-green-100'
                : status.includes('Error') || status.includes('Failed') || status.includes('not respond')
                ? 'bg-red-500/20 border border-red-500/50 text-red-100'
                : 'bg-blue-500/20 border border-blue-500/50 text-blue-100'
            }`}
          >
            <p className="text-sm text-center">{status}</p>
          </div>
        )}

        <div className="mt-8 pt-6 border-t border-white/20">
          <h2 className="text-white font-semibold mb-3">Setup Instructions:</h2>
          <ol className="text-sm text-blue-200 space-y-2 list-decimal list-inside">
            <li>Enable Wake-on-LAN in your PC BIOS/UEFI</li>
            <li>Enable WOL in Windows Network Adapter settings</li>
            <li>Find your PC MAC address (ipconfig /all)</li>
            <li>Add IP address for status monitoring (optional)</li>
            <li>Ensure PC and Raspberry Pi are on same network</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
