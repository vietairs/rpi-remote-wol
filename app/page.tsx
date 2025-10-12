'use client';

import { useState, useEffect } from 'react';

interface Device {
  id: number;
  name: string;
  mac_address: string;
  created_at: string;
  updated_at: string;
}

export default function Home() {
  const [status, setStatus] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [macAddress, setMacAddress] = useState<string>('');
  const [deviceName, setDeviceName] = useState<string>('');
  const [savedDevices, setSavedDevices] = useState<Device[]>([]);
  const [showSaveForm, setShowSaveForm] = useState<boolean>(false);
  const [selectedDeviceId, setSelectedDeviceId] = useState<number | null>(null);

  // Load saved devices on mount
  useEffect(() => {
    loadDevices();
  }, []);

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
        body: JSON.stringify({ name: deviceName, macAddress }),
      });

      const data = await response.json();

      if (response.ok) {
        setStatus(`Device "${deviceName}" saved successfully!`);
        setDeviceName('');
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
        }
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
    setSelectedDeviceId(device.id);
    setStatus(`Selected: ${device.name}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 flex items-center justify-center p-4">
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-8 w-full max-w-2xl border border-white/20">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            PC Remote Wake
          </h1>
          <p className="text-blue-200">Wake your Windows 11 PC remotely</p>
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
                    }}
                    className="flex-1 bg-red-500 hover:bg-red-600 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right column - Saved devices */}
          <div>
            <h3 className="text-white font-semibold mb-3">Saved Devices</h3>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
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
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h4 className="text-white font-medium">
                          {device.name}
                        </h4>
                        <p className="text-blue-200 text-xs mt-1">
                          {device.mac_address}
                        </p>
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
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {status && (
          <div
            className={`mt-6 p-4 rounded-lg ${
              status.includes('Success') || status.includes('saved')
                ? 'bg-green-500/20 border border-green-500/50 text-green-100'
                : status.includes('Error') || status.includes('Failed')
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
            <li>Ensure PC and Raspberry Pi are on same network</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
