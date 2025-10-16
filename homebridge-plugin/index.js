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
      new DeviceStatusAccessory(this, 'Device Status'),
      new WakeSwitchAccessory(this, 'Wake PC'),
      new SleepSwitchAccessory(this, 'Sleep PC'),
      new ShutdownSwitchAccessory(this, 'Shutdown PC'),
      new CPUAccessory(this, 'CPU Usage'),
      new RAMAccessory(this, 'RAM Usage'),
      new GPUAccessory(this, 'GPU Usage'),
      new PowerAccessory(this, 'Power Consumption'),
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
class DeviceStatusAccessory extends BaseAccessory {
  constructor(platform, name) {
    super(platform, name, Service.ContactSensor);
  }

  updateFromMetrics(metrics, status) {
    const isOnline = status && status.online;
    this.service.updateCharacteristic(
      Characteristic.ContactSensorState,
      isOnline ? Characteristic.ContactSensorState.CONTACT_DETECTED : Characteristic.ContactSensorState.CONTACT_NOT_DETECTED
    );
  }
}

// Wake Switch Accessory
class WakeSwitchAccessory extends BaseAccessory {
  constructor(platform, name) {
    super(platform, name, Service.Switch);

    this.service
      .getCharacteristic(Characteristic.On)
      .on('set', this.setOn.bind(this));
  }

  async setOn(value, callback) {
    if (value) {
      try {
        await this.platform.wakeDevice();
        this.log('Device wake command sent');

        // Auto-turn off after 2 seconds
        setTimeout(() => {
          this.service.updateCharacteristic(Characteristic.On, false);
        }, 2000);

        callback(null);
      } catch (error) {
        this.log.error('Failed to wake device:', error.message);
        callback(error);
      }
    } else {
      callback(null);
    }
  }

  updateFromMetrics(metrics, status) {
    // Keep switch off by default
    this.service.updateCharacteristic(Characteristic.On, false);
  }
}

// Sleep Switch Accessory
class SleepSwitchAccessory extends BaseAccessory {
  constructor(platform, name) {
    super(platform, name, Service.Switch);

    this.service
      .getCharacteristic(Characteristic.On)
      .on('set', this.setOn.bind(this));
  }

  async setOn(value, callback) {
    if (value) {
      try {
        await this.platform.sleepDevice();
        this.log('Device sleep command sent');

        // Auto-turn off after 2 seconds
        setTimeout(() => {
          this.service.updateCharacteristic(Characteristic.On, false);
        }, 2000);

        callback(null);
      } catch (error) {
        this.log.error('Failed to sleep device:', error.message);
        callback(error);
      }
    } else {
      callback(null);
    }
  }

  updateFromMetrics(metrics, status) {
    // Keep switch off by default
    this.service.updateCharacteristic(Characteristic.On, false);
  }
}

// Shutdown Switch Accessory
class ShutdownSwitchAccessory extends BaseAccessory {
  constructor(platform, name) {
    super(platform, name, Service.Switch);

    this.service
      .getCharacteristic(Characteristic.On)
      .on('set', this.setOn.bind(this));
  }

  async setOn(value, callback) {
    if (value) {
      try {
        await this.platform.shutdownDevice();
        this.log('Device shutdown command sent');

        // Auto-turn off after 2 seconds
        setTimeout(() => {
          this.service.updateCharacteristic(Characteristic.On, false);
        }, 2000);

        callback(null);
      } catch (error) {
        this.log.error('Failed to shutdown device:', error.message);
        callback(error);
      }
    } else {
      callback(null);
    }
  }

  updateFromMetrics(metrics, status) {
    // Keep switch off by default
    this.service.updateCharacteristic(Characteristic.On, false);
  }
}

// CPU Usage Accessory (Temperature Sensor)
class CPUAccessory extends BaseAccessory {
  constructor(platform, name) {
    super(platform, name, Service.TemperatureSensor);
  }

  updateFromMetrics(metrics, status) {
    if (metrics && metrics.cpu !== null) {
      // Use CPU percentage as temperature (0-100°C)
      this.service.updateCharacteristic(Characteristic.CurrentTemperature, metrics.cpu);
    }
  }
}

// RAM Usage Accessory (Humidity Sensor)
class RAMAccessory extends BaseAccessory {
  constructor(platform, name) {
    super(platform, name, Service.HumiditySensor);
  }

  updateFromMetrics(metrics, status) {
    if (metrics && metrics.ram && metrics.ram.percent !== null) {
      // Use RAM percentage as humidity (0-100%)
      this.service.updateCharacteristic(Characteristic.CurrentRelativeHumidity, metrics.ram.percent);
    }
  }
}

// GPU Usage Accessory (Temperature Sensor)
class GPUAccessory extends BaseAccessory {
  constructor(platform, name) {
    super(platform, name, Service.TemperatureSensor);
  }

  updateFromMetrics(metrics, status) {
    if (metrics && metrics.gpu && metrics.gpu.usage !== null) {
      // Use GPU percentage as temperature (0-100°C)
      this.service.updateCharacteristic(Characteristic.CurrentTemperature, metrics.gpu.usage);
    }
  }
}

// Power Consumption Accessory (Light Sensor)
class PowerAccessory extends BaseAccessory {
  constructor(platform, name) {
    super(platform, name, Service.LightSensor);
  }

  updateFromMetrics(metrics, status) {
    if (metrics && metrics.power && metrics.power.watts !== null) {
      // Use watts as lux (0.0001 - 100000 lux range)
      // Map 0-1000W to lux range
      const lux = Math.max(0.0001, Math.min(metrics.power.watts, 100000));
      this.service.updateCharacteristic(Characteristic.CurrentAmbientLightLevel, lux);
    }
  }
}
