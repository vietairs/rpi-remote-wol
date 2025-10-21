/**
 * PC Remote Wake Homebridge Plugin
 *
 * Exposes Windows PC metrics and controls to Apple HomeKit
 *
 * Accessories:
 * - Device Status (Contact Sensor)
 * - Wake Switch (Switch)
 * - Sleep Switch (Switch)
 * - Shutdown Switch (Switch)
 * - CPU Usage (Temperature Sensor)
 * - RAM Usage (Humidity Sensor)
 * - GPU Usage (Temperature Sensor)
 * - Power Consumption (Light Sensor)
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

    // Configuration
    this.baseUrl = config.baseUrl || 'http://localhost:3000';
    this.apiKey = config.apiKey;
    this.deviceId = config.deviceId;
    this.deviceName = config.deviceName || 'PC';
    this.pollingInterval = (config.pollingInterval || 30) * 1000; // Convert to milliseconds

    if (!this.apiKey) {
      this.log.error('API key is required. Please generate an API key via the web UI and add it to your config.');
      return;
    }

    if (!this.deviceId) {
      this.log.error('Device ID is required. Check the web UI for your device ID.');
      return;
    }

    this.accessories = [];

    if (api) {
      this.api.on('didFinishLaunching', () => {
        this.log('Finished launching, discovering accessories...');
        this.discoverAccessories();
      });
    }
  }

  configureAccessory(accessory) {
    this.log('Loading cached accessory:', accessory.displayName);
    this.accessories.push(accessory);
  }

  discoverAccessories() {
    this.log('Discovering PC Remote Wake accessories...');

    const accessories = [
      new DeviceStatusAccessory(this, 'Status'),
      new PCControlAccessory(this, 'Control'), // Single accessory with 3 buttons
      new CPUAccessory(this, 'CPU %'),
      new RAMAccessory(this, 'RAM %'),
      new GPUAccessory(this, 'GPU %'),
      new PowerAccessory(this, 'Power (W)'),
    ];

    this.accessories = accessories;
    this.api.registerPlatformAccessories('homebridge-pc-remote-wake', 'PCRemoteWake', accessories.map(a => a.accessory));

    // Start polling for metrics
    this.startPolling();
  }

  async startPolling() {
    const poll = async () => {
      try {
        const metrics = await this.fetchMetrics();
        const status = await this.fetchStatus();

        this.accessories.forEach(accessory => {
          if (accessory.updateFromMetrics) {
            accessory.updateFromMetrics(metrics, status);
          }
        });
      } catch (error) {
        this.log.error('Error polling metrics:', error.message);
      }
    };

    // Initial poll
    await poll();

    // Periodic polling
    setInterval(poll, this.pollingInterval);
  }

  async fetchMetrics() {
    const response = await fetch(`${this.baseUrl}/api/metrics/${this.deviceId}/latest`, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch metrics: ${response.statusText}`);
    }

    const data = await response.json();
    return data.metrics;
  }

  async fetchStatus() {
    const response = await fetch(`${this.baseUrl}/api/devices`, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch devices: ${response.statusText}`);
    }

    const data = await response.json();
    const device = data.devices.find(d => d.id === this.deviceId);

    if (!device || !device.ip_address) {
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

  async wakeDevice() {
    const response = await fetch(`${this.baseUrl}/api/devices`, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
      },
    });

    const data = await response.json();
    const device = data.devices.find(d => d.id === this.deviceId);

    if (!device) {
      throw new Error('Device not found');
    }

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

  async sleepDevice() {
    const response = await fetch(`${this.baseUrl}/api/sleep`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ deviceId: this.deviceId }),
    });

    if (!response.ok) {
      throw new Error('Failed to sleep device');
    }

    return await response.json();
  }

  async shutdownDevice() {
    const response = await fetch(`${this.baseUrl}/api/shutdown`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ deviceId: this.deviceId }),
    });

    if (!response.ok) {
      throw new Error('Failed to shutdown device');
    }

    return await response.json();
  }
}

// Base Accessory Class
class BaseAccessory {
  constructor(platform, name, serviceType) {
    this.platform = platform;
    this.log = platform.log;
    this.name = `${platform.deviceName} ${name}`;
    this.uuid = platform.api.hap.uuid.generate(this.name);

    this.accessory = new platform.api.platformAccessory(this.name, this.uuid);
    this.accessory.context.type = serviceType;

    this.service = this.accessory.addService(serviceType, this.name);

    this.accessory
      .getService(Service.AccessoryInformation)
      .setCharacteristic(Characteristic.Manufacturer, 'PC Remote Wake')
      .setCharacteristic(Characteristic.Model, serviceType.name)
      .setCharacteristic(Characteristic.SerialNumber, this.uuid);
  }
}

// Device Status Accessory (Contact Sensor)
// Shows "Detected" when PC is online, "Not Detected" when offline
class DeviceStatusAccessory extends BaseAccessory {
  constructor(platform, name) {
    super(platform, name, Service.ContactSensor);

    // Add helpful name
    this.service.setCharacteristic(Characteristic.Name, `${platform.deviceName} Online Status`);
  }

  updateFromMetrics(metrics, status) {
    const isOnline = status && status.online;
    // Detected = PC is online, Not Detected = PC is offline
    this.service.updateCharacteristic(
      Characteristic.ContactSensorState,
      isOnline ? Characteristic.ContactSensorState.CONTACT_DETECTED : Characteristic.ContactSensorState.CONTACT_NOT_DETECTED
    );
  }
}

// PC Control Accessory - Single device with 3 switches (Wake, Sleep, Shutdown)
class PCControlAccessory {
  constructor(platform, name) {
    this.platform = platform;
    this.log = platform.log;
    this.name = `${platform.deviceName}`;
    this.uuid = platform.api.hap.uuid.generate(this.name + ' Control');

    this.accessory = new platform.api.platformAccessory(this.name, this.uuid);

    this.accessory
      .getService(Service.AccessoryInformation)
      .setCharacteristic(Characteristic.Manufacturer, 'PC Remote Wake')
      .setCharacteristic(Characteristic.Model, 'PC Control')
      .setCharacteristic(Characteristic.SerialNumber, this.uuid);

    // Switch 1: Wake
    this.wakeService = this.accessory.addService(Service.Switch, 'Wake', 'wake');
    this.wakeService
      .getCharacteristic(Characteristic.On)
      .on('set', async (value, callback) => {
        if (value) {
          try {
            await this.platform.wakeDevice();
            this.log('Wake command sent');
            // Auto-turn off after 1 second
            setTimeout(() => {
              this.wakeService.updateCharacteristic(Characteristic.On, false);
            }, 1000);
            callback(null);
          } catch (error) {
            this.log.error('Failed to wake device:', error.message);
            callback(error);
          }
        } else {
          callback(null);
        }
      });

    // Switch 2: Sleep
    this.sleepService = this.accessory.addService(Service.Switch, 'Sleep', 'sleep');
    this.sleepService
      .getCharacteristic(Characteristic.On)
      .on('set', async (value, callback) => {
        if (value) {
          try {
            await this.platform.sleepDevice();
            this.log('Sleep command sent');
            // Auto-turn off after 1 second
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

    // Switch 3: Shutdown
    this.shutdownService = this.accessory.addService(Service.Switch, 'Shutdown', 'shutdown');
    this.shutdownService
      .getCharacteristic(Characteristic.On)
      .on('set', async (value, callback) => {
        if (value) {
          try {
            await this.platform.shutdownDevice();
            this.log('Shutdown command sent');
            // Auto-turn off after 1 second
            setTimeout(() => {
              this.shutdownService.updateCharacteristic(Characteristic.On, false);
            }, 1000);
            callback(null);
          } catch (error) {
            this.log.error('Failed to shutdown device:', error.message);
            callback(error);
          }
        } else {
          callback(null);
        }
      });
  }

  updateFromMetrics(metrics, status) {
    // Keep all switches off by default
    this.wakeService.updateCharacteristic(Characteristic.On, false);
    this.sleepService.updateCharacteristic(Characteristic.On, false);
    this.shutdownService.updateCharacteristic(Characteristic.On, false);
  }
}

// CPU Usage Accessory (Temperature Sensor)
// Note: HomeKit doesn't have a CPU sensor type, so we use Temperature
// The value shows as "°C" but represents CPU percentage (e.g., 45°C = 45% CPU)
class CPUAccessory extends BaseAccessory {
  constructor(platform, name) {
    super(platform, name, Service.TemperatureSensor);

    // Add helpful name that shows in some HomeKit apps
    this.service.setCharacteristic(Characteristic.Name, `${platform.deviceName} CPU Percent`);
  }

  updateFromMetrics(metrics, status) {
    if (metrics && metrics.cpu !== null) {
      // Display CPU percentage as temperature (45% shows as 45°C)
      this.service.updateCharacteristic(Characteristic.CurrentTemperature, metrics.cpu);
    }
  }
}

// RAM Usage Accessory (Humidity Sensor)
// Note: HomeKit doesn't have a RAM sensor type, so we use Humidity
// The value shows as "%" humidity but represents RAM usage (e.g., 67% = 67% RAM used)
class RAMAccessory extends BaseAccessory {
  constructor(platform, name) {
    super(platform, name, Service.HumiditySensor);

    // Add helpful name that shows in some HomeKit apps
    this.service.setCharacteristic(Characteristic.Name, `${platform.deviceName} RAM Percent`);
  }

  updateFromMetrics(metrics, status) {
    if (metrics && metrics.ram && metrics.ram.percent !== null) {
      // Display RAM percentage as humidity (67% RAM shows as 67% humidity)
      this.service.updateCharacteristic(Characteristic.CurrentRelativeHumidity, metrics.ram.percent);
    }
  }
}

// GPU Usage Accessory (Temperature Sensor)
// Note: HomeKit doesn't have a GPU sensor type, so we use Temperature
// The value shows as "°C" but represents GPU percentage (e.g., 80°C = 80% GPU)
class GPUAccessory extends BaseAccessory {
  constructor(platform, name) {
    super(platform, name, Service.TemperatureSensor);

    // Add helpful name that shows in some HomeKit apps
    this.service.setCharacteristic(Characteristic.Name, `${platform.deviceName} GPU Percent`);
  }

  updateFromMetrics(metrics, status) {
    if (metrics && metrics.gpu && metrics.gpu.usage !== null) {
      // Display GPU percentage as temperature (80% shows as 80°C)
      this.service.updateCharacteristic(Characteristic.CurrentTemperature, metrics.gpu.usage);
    }
  }
}

// Power Consumption Accessory (Light Sensor)
// Note: HomeKit doesn't have a Power sensor type, so we use Light
// The value shows as "lux" but represents Watts (e.g., 350 lux = 350 Watts)
class PowerAccessory extends BaseAccessory {
  constructor(platform, name) {
    super(platform, name, Service.LightSensor);

    // Add helpful name that shows in some HomeKit apps
    this.service.setCharacteristic(Characteristic.Name, `${platform.deviceName} Power Watts`);
  }

  updateFromMetrics(metrics, status) {
    if (metrics && metrics.power && metrics.power.watts !== null) {
      // Display Watts as Lux (350W shows as 350 lux)
      // HomeKit light sensor range: 0.0001 - 100000 lux
      const lux = Math.max(0.0001, Math.min(metrics.power.watts, 100000));
      this.service.updateCharacteristic(Characteristic.CurrentAmbientLightLevel, lux);
    }
  }
}
