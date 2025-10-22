/**
 * PC Remote Wake Homebridge Plugin
 *
 * Exposes Windows PC metrics and controls to Apple HomeKit
 *
 * Single consolidated accessory per device with services:
 * - Device Status (Occupancy Sensor) - "Occupied" = PC ON, "Not Occupied" = PC OFF
 * - Power (Stateful Switch) - ON = PC running, OFF = PC sleeping/powered off
 *   - Turn ON when OFF → Instantly shows ON, sends WOL command
 *   - Turn OFF when ON → Instantly shows OFF, sends Shutdown command
 *   - Uses optimistic updates for instant feedback
 *   - Background polling (every 30s) corrects state if PC was manually controlled
 * - Sleep (Momentary Button) - Put PC to sleep via SSH (auto-turns off after 1s)
 *   - After sleep command, Power switch instantly turns OFF
 * - CPU Usage (Temperature Sensor) - °C = CPU %
 * - RAM Usage (Humidity Sensor) - % = RAM %
 * - GPU Usage (Temperature Sensor) - °C = GPU %
 * - Power Consumption (Light Sensor) - lux = Watts
 *
 * All controls and sensors appear together on the device page in Home app.
 */

const fetch = require('node-fetch');

let Service, Characteristic;

module.exports = (homebridge) => {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;

  homebridge.registerPlatform('homebridge-pc-remote-wake', 'PCRemoteWake', PCRemoteWakePlatform);
};

class PCRemoteWakePlatform {
  constructor(log, config, api) {
    this.log = log;
    this.config = config;
    this.api = api;

    // Initialize arrays first (before any early returns)
    this.accessories = [];
    this.devices = [];

    // Configuration
    this.baseUrl = config.baseUrl || 'http://localhost:3000';
    this.apiKey = config.apiKey;
    this.pollingInterval = (config.pollingInterval || 30) * 1000; // Convert to milliseconds

    if (!this.apiKey) {
      this.log.error('API key is required. Please generate an API key via the web UI and add it to your config.');
      return;
    }

    if (api) {
      this.api.on('didFinishLaunching', () => {
        this.log('Finished launching, discovering devices and accessories...');
        this.discoverAccessories();
      });
    }
  }

  configureAccessory(accessory) {
    this.log('Loading cached accessory:', accessory.displayName);
    this.accessories.push(accessory);
  }

  async discoverAccessories() {
    this.log('Discovering devices from API...');

    try {
      // Fetch all devices from the API
      const response = await fetch(`${this.baseUrl}/api/devices`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch devices: ${response.statusText}`);
      }

      const data = await response.json();
      this.devices = data.devices || [];

      if (this.devices.length === 0) {
        this.log.warn('No devices found in the database. Add devices via the web UI.');
        return;
      }

      this.log(`Found ${this.devices.length} device(s)`);

      // Create consolidated accessory for each device (all controls + sensors in one)
      const accessories = [];
      for (const device of this.devices) {
        const deviceName = device.name;
        this.log(`Creating consolidated accessory for device: ${deviceName} (ID: ${device.id})`);

        accessories.push(new PCAccessory(this, device));
      }

      this.accessories = accessories;
      this.api.registerPlatformAccessories('homebridge-pc-remote-wake', 'PCRemoteWake', accessories.map(a => a.accessory));

      // Start polling for metrics
      this.startPolling();
    } catch (error) {
      this.log.error('Failed to discover devices:', error.message);
    }
  }

  async startPolling() {
    const poll = async () => {
      try {
        // Poll metrics and status for all devices
        for (const device of this.devices) {
          const metrics = await this.fetchMetrics(device.id);
          const status = await this.fetchStatus(device);

          // Update accessories for this device
          this.accessories.forEach(accessory => {
            if (accessory.device && accessory.device.id === device.id && accessory.updateFromMetrics) {
              accessory.updateFromMetrics(metrics, status);
            }
          });
        }
      } catch (error) {
        this.log.error('Error polling metrics:', error.message);
      }
    };

    // Initial poll
    await poll();

    // Periodic polling
    setInterval(poll, this.pollingInterval);
  }

  async fetchMetrics(deviceId) {
    const response = await fetch(`${this.baseUrl}/api/metrics/${deviceId}/latest`, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch metrics for device ${deviceId}: ${response.statusText}`);
    }

    const data = await response.json();
    return data.metrics;
  }

  async fetchStatus(device) {
    if (!device.ip_address) {
      return { online: false };
    }

    // Check device status
    const statusResponse = await fetch(`${this.baseUrl}/api/status`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ipAddress: device.ip_address }),
    });

    if (!statusResponse.ok) {
      return { online: false };
    }

    return await statusResponse.json();
  }

  async wakeDevice(device) {
    const wakeResponse = await fetch(`${this.baseUrl}/api/wake`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ macAddress: device.mac_address }),
    });

    if (!wakeResponse.ok) {
      throw new Error('Failed to wake device');
    }

    return await wakeResponse.json();
  }

  async sleepDevice(device) {
    const response = await fetch(`${this.baseUrl}/api/sleep`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ deviceId: device.id }),
    });

    if (!response.ok) {
      throw new Error('Failed to sleep device');
    }

    return await response.json();
  }

  async shutdownDevice(device) {
    const response = await fetch(`${this.baseUrl}/api/shutdown`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ deviceId: device.id }),
    });

    if (!response.ok) {
      throw new Error('Failed to shutdown device');
    }

    return await response.json();
  }
}

// Consolidated PC Accessory - Single accessory with all controls and sensors
class PCAccessory {
  constructor(platform, device) {
    this.platform = platform;
    this.device = device;
    this.log = platform.log;
    this.name = device.name;
    this.uuid = platform.api.hap.uuid.generate(`${device.id}-${device.name}`);

    // Create the accessory
    this.accessory = new platform.api.platformAccessory(this.name, this.uuid);
    this.accessory.context.deviceId = device.id;

    // Set accessory information
    this.accessory
      .getService(Service.AccessoryInformation)
      .setCharacteristic(Characteristic.Manufacturer, 'PC Remote Wake')
      .setCharacteristic(Characteristic.Model, 'Remote PC Control')
      .setCharacteristic(Characteristic.SerialNumber, this.uuid);

    // Device Status (Occupancy Sensor) - shows online/offline as PRIMARY display
    // This is added FIRST, making it the primary service by default
    // Shows "Occupied" when PC is online, "Not Occupied" when offline
    this.statusService = this.accessory.addService(Service.OccupancySensor, this.name, 'status');
    this.statusService.setCharacteristic(Characteristic.OccupancyDetected, Characteristic.OccupancyDetected.OCCUPANCY_NOT_DETECTED);

    // Power Switch - Reflects PC state and controls Wake/Shutdown
    // ON = PC is running, OFF = PC is powered off
    // Turning ON when OFF = Wake PC
    // Turning OFF when ON = Shutdown PC
    this.powerSwitch = this.accessory.addService(Service.Switch, 'Power', 'power-switch');
    this.powerSwitch.setCharacteristic(Characteristic.Name, 'Power');
    this.powerSwitch.setCharacteristic(Characteristic.On, false); // Default to OFF
    this.powerSwitch
      .getCharacteristic(Characteristic.On)
      .on('set', async (value, callback) => {
        try {
          if (value) {
            // User turned switch ON → Wake the PC
            this.log(`Power switch turned ON - Waking ${this.device.name}`);
            // Optimistic update: assume success immediately
            this.powerSwitch.updateCharacteristic(Characteristic.On, true);
            await this.platform.wakeDevice(this.device);
            callback(null);
          } else {
            // User turned switch OFF → Shutdown the PC
            this.log(`Power switch turned OFF - Shutting down ${this.device.name}`);
            // Optimistic update: assume success immediately
            this.powerSwitch.updateCharacteristic(Characteristic.On, false);
            await this.platform.shutdownDevice(this.device);
            callback(null);
          }
        } catch (error) {
          this.log.error('Failed to control power:', error.message);
          // On error, revert to opposite state
          this.powerSwitch.updateCharacteristic(Characteristic.On, !value);
          callback(error);
        }
      });

    // Sleep Button - Momentary switch (auto-turns off after 1s)
    this.sleepService = this.accessory.addService(Service.Switch, 'Sleep', 'sleep');
    this.sleepService.setCharacteristic(Characteristic.Name, 'Sleep');
    this.sleepService.setCharacteristic(Characteristic.On, false);
    this.sleepService
      .getCharacteristic(Characteristic.On)
      .on('set', async (value, callback) => {
        if (value) {
          try {
            await this.platform.sleepDevice(this.device);
            this.log(`Sleep command sent for ${this.device.name}`);

            // Optimistic update: PC is now sleeping, so turn off Power switch
            this.powerSwitch.updateCharacteristic(Characteristic.On, false);

            // Auto-turn off Sleep button after 1 second (momentary button behavior)
            setTimeout(() => {
              this.sleepService.updateCharacteristic(Characteristic.On, false);
            }, 1000);
            callback(null);
          } catch (error) {
            this.log.error('Failed to sleep device:', error.message);
            callback(error);
          }
        } else {
          callback(null);
        }
      });

    // CPU Usage (Temperature Sensor)
    // Note: Shows as °C but represents CPU percentage (45°C = 45%)
    this.cpuService = this.accessory.addService(Service.TemperatureSensor, 'CPU Usage', 'cpu');
    this.cpuService.setCharacteristic(Characteristic.Name, 'CPU %');
    this.cpuService.setCharacteristic(Characteristic.CurrentTemperature, 0);

    // RAM Usage (Humidity Sensor)
    // Note: Shows as % humidity but represents RAM usage (67% = 67% RAM)
    this.ramService = this.accessory.addService(Service.HumiditySensor, 'RAM Usage', 'ram');
    this.ramService.setCharacteristic(Characteristic.Name, 'RAM %');
    this.ramService.setCharacteristic(Characteristic.CurrentRelativeHumidity, 0);

    // GPU Usage (Temperature Sensor)
    // Note: Shows as °C but represents GPU percentage (80°C = 80%)
    this.gpuService = this.accessory.addService(Service.TemperatureSensor, 'GPU Usage', 'gpu');
    this.gpuService.setCharacteristic(Characteristic.Name, 'GPU %');
    this.gpuService.setCharacteristic(Characteristic.CurrentTemperature, 0);

    // Power Consumption (Light Sensor)
    // Note: Shows as lux but represents Watts (350 lux = 350W)
    this.powerService = this.accessory.addService(Service.LightSensor, 'Power', 'power');
    this.powerService.setCharacteristic(Characteristic.Name, 'Power (W)');
    this.powerService.setCharacteristic(Characteristic.CurrentAmbientLightLevel, 0.0001);
  }

  updateFromMetrics(metrics, status) {
    // Update device status (Occupancy Sensor)
    if (status) {
      const isOnline = status.online;
      // Occupied = PC is ON, Not Occupied = PC is OFF
      this.statusService.updateCharacteristic(
        Characteristic.OccupancyDetected,
        isOnline ? Characteristic.OccupancyDetected.OCCUPANCY_DETECTED : Characteristic.OccupancyDetected.OCCUPANCY_NOT_DETECTED
      );

      // Sync Power switch with PC state
      // ON = PC is running and responding
      // OFF = PC is sleeping, powered off, or unreachable
      this.powerSwitch.updateCharacteristic(Characteristic.On, isOnline);
    }

    // Update metrics
    if (metrics) {
      // CPU
      if (metrics.cpu !== null && metrics.cpu !== undefined) {
        this.cpuService.updateCharacteristic(Characteristic.CurrentTemperature, metrics.cpu);
      }

      // RAM
      if (metrics.ram && metrics.ram.percent !== null && metrics.ram.percent !== undefined) {
        this.ramService.updateCharacteristic(Characteristic.CurrentRelativeHumidity, metrics.ram.percent);
      }

      // GPU
      if (metrics.gpu && metrics.gpu.usage !== null && metrics.gpu.usage !== undefined) {
        this.gpuService.updateCharacteristic(Characteristic.CurrentTemperature, metrics.gpu.usage);
      }

      // Power
      if (metrics.power && metrics.power.watts !== null && metrics.power.watts !== undefined) {
        const lux = Math.max(0.0001, Math.min(metrics.power.watts, 100000));
        this.powerService.updateCharacteristic(Characteristic.CurrentAmbientLightLevel, lux);
      }
    }

    // Keep Sleep button off (momentary switch)
    // Note: Power switch state is synced with PC status above
    this.sleepService.updateCharacteristic(Characteristic.On, false);
  }
}
