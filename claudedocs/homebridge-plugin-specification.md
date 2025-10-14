# Homebridge Plugin Implementation Specification

## Overview

This document provides a detailed technical specification for implementing a Homebridge plugin that integrates with the PC Remote Wake web application. The plugin exposes each managed PC as a HomeKit Switch accessory, allowing Wake-on-LAN, Sleep, and Shutdown control through Apple HomeKit ecosystem.

**Plugin Type**: Dynamic Platform Plugin (Recommended)

**Plugin Name**: `homebridge-pc-remote-wake`

**Platform Name**: `PCRemoteWake`

---

## 1. Plugin Structure

### 1.1 Recommended Architecture: Dynamic Platform Plugin

**Reasoning**:
- Supports multiple PC devices dynamically fetched from webapp API
- Allows runtime device discovery without config changes
- Simplifies accessory lifecycle management
- Better state synchronization with webapp backend

**Alternative**: Accessory Plugin (Not Recommended)
- Would require hardcoding each device in config
- No dynamic discovery
- More complex multi-device management

### 1.2 File Structure

```
homebridge-pc-remote-wake/
├── package.json                    # Plugin metadata & dependencies
├── config.schema.json              # Configuration UI schema for Homebridge UI
├── tsconfig.json                   # TypeScript configuration
├── src/
│   ├── index.ts                    # Plugin entry point
│   ├── platform.ts                 # Main Platform class
│   ├── accessory.ts                # PC Switch Accessory class
│   ├── api-client.ts               # HTTP client for webapp API
│   ├── types.ts                    # TypeScript interfaces
│   └── constants.ts                # Constants and configuration
└── dist/                           # Compiled JavaScript (gitignored)
```

---

## 2. Package Configuration

### 2.1 package.json

```json
{
  "name": "homebridge-pc-remote-wake",
  "displayName": "PC Remote Wake",
  "version": "1.0.0",
  "description": "Homebridge plugin for Wake-on-LAN and remote PC management",
  "license": "MIT",
  "author": "Your Name",
  "keywords": [
    "homebridge-plugin",
    "wake-on-lan",
    "wol",
    "pc-control",
    "remote-wake",
    "raspberry-pi"
  ],
  "repository": {
    "type": "git",
    "url": "https://github.com/yourusername/homebridge-pc-remote-wake.git"
  },
  "bugs": {
    "url": "https://github.com/yourusername/homebridge-pc-remote-wake/issues"
  },
  "engines": {
    "node": ">=18.0.0",
    "homebridge": ">=1.6.0"
  },
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "watch": "tsc --watch",
    "prepublishOnly": "npm run build",
    "lint": "eslint src --ext .ts",
    "test": "jest"
  },
  "dependencies": {
    "axios": "^1.6.0",
    "axios-retry": "^4.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "homebridge": "^1.6.0",
    "typescript": "^5.0.0",
    "eslint": "^8.0.0",
    "@typescript-eslint/eslint-plugin": "^6.0.0",
    "@typescript-eslint/parser": "^6.0.0"
  }
}
```

### 2.2 Key Dependencies

- **axios**: HTTP client for API communication
- **axios-retry**: Automatic retry logic for network failures
- **homebridge**: Peer dependency for plugin development

---

## 3. Configuration Schema

### 3.1 config.schema.json

Provides Homebridge Config UI X integration for user-friendly configuration.

```json
{
  "pluginAlias": "PCRemoteWake",
  "pluginType": "platform",
  "singular": true,
  "headerDisplay": "PC Remote Wake plugin for Homebridge - Control your PCs via HomeKit",
  "footerDisplay": "For more information visit [GitHub](https://github.com/yourusername/homebridge-pc-remote-wake)",
  "schema": {
    "type": "object",
    "properties": {
      "name": {
        "title": "Platform Name",
        "type": "string",
        "default": "PC Remote Wake",
        "required": true,
        "description": "Platform name displayed in Homebridge logs"
      },
      "webappUrl": {
        "title": "Webapp URL",
        "type": "string",
        "default": "http://localhost:3000",
        "required": true,
        "format": "uri",
        "description": "Base URL of the PC Remote Wake webapp (e.g., http://raspberrypi.local:3000)"
      },
      "username": {
        "title": "Username",
        "type": "string",
        "required": true,
        "description": "Username for webapp authentication"
      },
      "password": {
        "title": "Password",
        "type": "string",
        "required": true,
        "description": "Password for webapp authentication"
      },
      "offAction": {
        "title": "Off Action",
        "type": "string",
        "default": "sleep",
        "required": true,
        "oneOf": [
          {
            "title": "Sleep",
            "enum": ["sleep"]
          },
          {
            "title": "Shutdown",
            "enum": ["shutdown"]
          }
        ],
        "description": "Action when switch is turned off in HomeKit"
      },
      "pollingInterval": {
        "title": "Polling Interval (seconds)",
        "type": "integer",
        "default": 45,
        "minimum": 15,
        "maximum": 300,
        "required": false,
        "description": "How often to check device status (15-300 seconds)"
      },
      "statusCheckTimeout": {
        "title": "Status Check Timeout (ms)",
        "type": "integer",
        "default": 5000,
        "minimum": 2000,
        "maximum": 15000,
        "required": false,
        "description": "Timeout for status API calls (2000-15000ms)"
      },
      "wakeTimeout": {
        "title": "Wake Timeout (seconds)",
        "type": "integer",
        "default": 60,
        "minimum": 30,
        "maximum": 180,
        "required": false,
        "description": "Max time to wait for PC to wake after WOL packet (30-180 seconds)"
      },
      "deviceFilter": {
        "title": "Device Filter (optional)",
        "type": "array",
        "items": {
          "type": "string"
        },
        "required": false,
        "description": "Optional: Only expose specific devices by name (leave empty for all devices)"
      },
      "debug": {
        "title": "Enable Debug Logging",
        "type": "boolean",
        "default": false,
        "required": false,
        "description": "Enable verbose debug logging for troubleshooting"
      }
    }
  },
  "layout": [
    {
      "type": "section",
      "title": "Connection Settings",
      "expandable": false,
      "items": [
        "name",
        "webappUrl",
        "username",
        "password"
      ]
    },
    {
      "type": "section",
      "title": "Behavior Settings",
      "expandable": true,
      "expanded": false,
      "items": [
        "offAction",
        "pollingInterval",
        "statusCheckTimeout",
        "wakeTimeout"
      ]
    },
    {
      "type": "section",
      "title": "Advanced Settings",
      "expandable": true,
      "expanded": false,
      "items": [
        "deviceFilter",
        "debug"
      ]
    }
  ]
}
```

### 3.2 Example User Configuration

```json
{
  "platforms": [
    {
      "platform": "PCRemoteWake",
      "name": "PC Remote Wake",
      "webappUrl": "http://192.168.1.100:3000",
      "username": "admin",
      "password": "your-secure-password",
      "offAction": "sleep",
      "pollingInterval": 45,
      "statusCheckTimeout": 5000,
      "wakeTimeout": 60,
      "deviceFilter": [],
      "debug": false
    }
  ]
}
```

---

## 4. TypeScript Type Definitions

### 4.1 src/types.ts

```typescript
import { PlatformConfig } from 'homebridge';

/**
 * Platform configuration interface extending Homebridge's base config
 */
export interface PCRemoteWakePlatformConfig extends PlatformConfig {
  /** Base URL of the PC Remote Wake webapp */
  webappUrl: string;

  /** Authentication username */
  username: string;

  /** Authentication password */
  password: string;

  /** Action to perform when switch is turned off ('sleep' | 'shutdown') */
  offAction: 'sleep' | 'shutdown';

  /** Status polling interval in seconds (default: 45) */
  pollingInterval?: number;

  /** Status check API timeout in milliseconds (default: 5000) */
  statusCheckTimeout?: number;

  /** Max wait time for PC to wake in seconds (default: 60) */
  wakeTimeout?: number;

  /** Optional array of device names to expose (empty = all devices) */
  deviceFilter?: string[];

  /** Enable debug logging (default: false) */
  debug?: boolean;
}

/**
 * Device information from webapp API
 */
export interface Device {
  id: number;
  name: string;
  mac_address: string;
  ip_address: string | null;
  ssh_username: string | null;
  ssh_password: string | null;
}

/**
 * Device status response from webapp API
 */
export interface DeviceStatus {
  ipAddress: string;
  online: boolean;
  rdpReady: boolean;
  checkedAt: string;
}

/**
 * Authentication response from webapp API
 */
export interface AuthResponse {
  success: boolean;
  token?: string;
  error?: string;
}

/**
 * Generic API response wrapper
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  details?: string;
}

/**
 * Wake-on-LAN request payload
 */
export interface WakeRequest {
  macAddress: string;
}

/**
 * Sleep/Shutdown request payload
 */
export interface PowerActionRequest {
  deviceId: number;
}

/**
 * Status check request payload
 */
export interface StatusRequest {
  ipAddress: string;
}
```

---

## 5. API Client Implementation

### 5.1 src/api-client.ts

```typescript
import axios, { AxiosInstance, AxiosError } from 'axios';
import axiosRetry from 'axios-retry';
import { Logger } from 'homebridge';
import {
  Device,
  DeviceStatus,
  AuthResponse,
  ApiResponse,
  WakeRequest,
  PowerActionRequest,
  StatusRequest,
} from './types';

/**
 * HTTP client for PC Remote Wake webapp API
 *
 * Features:
 * - Automatic JWT token refresh
 * - Retry logic for network failures
 * - Comprehensive error handling
 * - Request/response logging
 */
export class ApiClient {
  private axiosInstance: AxiosInstance;
  private jwtToken: string | null = null;
  private tokenExpiry: number = 0;
  private readonly baseUrl: string;
  private readonly username: string;
  private readonly password: string;
  private readonly log: Logger;
  private readonly debug: boolean;

  constructor(
    baseUrl: string,
    username: string,
    password: string,
    log: Logger,
    debug: boolean = false,
    timeout: number = 10000,
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.username = username;
    this.password = password;
    this.log = log;
    this.debug = debug;

    // Create axios instance with base configuration
    this.axiosInstance = axios.create({
      baseURL: this.baseUrl,
      timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Configure retry logic
    axiosRetry(this.axiosInstance, {
      retries: 3,
      retryDelay: axiosRetry.exponentialDelay,
      retryCondition: (error: AxiosError) => {
        // Retry on network errors and 5xx server errors
        return axiosRetry.isNetworkOrIdempotentRequestError(error) ||
               (error.response?.status ?? 0) >= 500;
      },
      onRetry: (retryCount, error) => {
        this.log.warn(`API request retry ${retryCount}: ${error.message}`);
      },
    });

    // Add request interceptor for JWT token
    this.axiosInstance.interceptors.request.use(
      async (config) => {
        // Check if token needs refresh
        if (this.needsTokenRefresh()) {
          await this.authenticate();
        }

        // Add JWT token to requests (except auth endpoints)
        if (this.jwtToken && !config.url?.includes('/api/auth/login')) {
          config.headers.Authorization = `Bearer ${this.jwtToken}`;
        }

        if (this.debug) {
          this.log.debug(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
        }

        return config;
      },
      (error) => Promise.reject(error),
    );

    // Add response interceptor for error handling
    this.axiosInstance.interceptors.response.use(
      (response) => {
        if (this.debug) {
          this.log.debug(`API Response: ${response.status} ${response.config.url}`);
        }
        return response;
      },
      async (error: AxiosError) => {
        // Handle 401 Unauthorized by refreshing token
        if (error.response?.status === 401 && !error.config?.url?.includes('/api/auth/login')) {
          this.log.warn('Token expired, re-authenticating...');
          await this.authenticate();
          // Retry original request with new token
          return this.axiosInstance.request(error.config!);
        }
        return Promise.reject(error);
      },
    );
  }

  /**
   * Check if JWT token needs refresh
   */
  private needsTokenRefresh(): boolean {
    if (!this.jwtToken) {
      return true;
    }
    // Refresh token 5 minutes before expiry
    const refreshThreshold = Date.now() + (5 * 60 * 1000);
    return this.tokenExpiry < refreshThreshold;
  }

  /**
   * Authenticate with webapp and obtain JWT token
   */
  async authenticate(): Promise<void> {
    try {
      const response = await this.axiosInstance.post<AuthResponse>(
        '/api/auth/login',
        {
          username: this.username,
          password: this.password,
        },
      );

      if (response.data.success && response.data.token) {
        this.jwtToken = response.data.token;
        // JWT tokens have 7-day expiry according to CLAUDE.md
        this.tokenExpiry = Date.now() + (7 * 24 * 60 * 60 * 1000);
        this.log.info('Successfully authenticated with webapp');
      } else {
        throw new Error(response.data.error || 'Authentication failed');
      }
    } catch (error) {
      this.handleError('Authentication failed', error);
      throw error;
    }
  }

  /**
   * Fetch all devices from webapp
   */
  async getDevices(): Promise<Device[]> {
    try {
      const response = await this.axiosInstance.get<{ devices: Device[] }>('/api/devices');
      return response.data.devices || [];
    } catch (error) {
      this.handleError('Failed to fetch devices', error);
      return [];
    }
  }

  /**
   * Send Wake-on-LAN packet to device
   */
  async wakeDevice(macAddress: string): Promise<boolean> {
    try {
      const payload: WakeRequest = { macAddress };
      const response = await this.axiosInstance.post<ApiResponse<unknown>>(
        '/api/wake',
        payload,
      );
      return response.data.success === true;
    } catch (error) {
      this.handleError(`Failed to wake device ${macAddress}`, error);
      return false;
    }
  }

  /**
   * Send sleep command to device via SSH
   */
  async sleepDevice(deviceId: number): Promise<boolean> {
    try {
      const payload: PowerActionRequest = { deviceId };
      const response = await this.axiosInstance.post<ApiResponse<unknown>>(
        '/api/sleep',
        payload,
      );
      return response.data.success === true;
    } catch (error) {
      this.handleError(`Failed to sleep device ${deviceId}`, error);
      return false;
    }
  }

  /**
   * Send shutdown command to device via SSH
   */
  async shutdownDevice(deviceId: number): Promise<boolean> {
    try {
      const payload: PowerActionRequest = { deviceId };
      const response = await this.axiosInstance.post<ApiResponse<unknown>>(
        '/api/shutdown',
        payload,
      );
      return response.data.success === true;
    } catch (error) {
      this.handleError(`Failed to shutdown device ${deviceId}`, error);
      return false;
    }
  }

  /**
   * Check device online status
   */
  async getDeviceStatus(ipAddress: string | null): Promise<DeviceStatus | null> {
    if (!ipAddress) {
      return null;
    }

    try {
      const payload: StatusRequest = { ipAddress };
      const response = await this.axiosInstance.post<DeviceStatus>(
        '/api/status',
        payload,
      );
      return response.data;
    } catch (error) {
      this.handleError(`Failed to check status for ${ipAddress}`, error);
      return null;
    }
  }

  /**
   * Test connection to webapp
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.authenticate();
      const devices = await this.getDevices();
      this.log.info(`Connected to webapp, found ${devices.length} device(s)`);
      return true;
    } catch (error) {
      this.log.error('Connection test failed:', this.getErrorMessage(error));
      return false;
    }
  }

  /**
   * Handle and log API errors
   */
  private handleError(context: string, error: unknown): void {
    const message = this.getErrorMessage(error);
    this.log.error(`${context}: ${message}`);

    if (this.debug && error instanceof AxiosError) {
      this.log.debug('Error details:', JSON.stringify({
        status: error.response?.status,
        data: error.response?.data,
        config: {
          url: error.config?.url,
          method: error.config?.method,
        },
      }));
    }
  }

  /**
   * Extract error message from various error types
   */
  private getErrorMessage(error: unknown): string {
    if (error instanceof AxiosError) {
      if (error.response?.data?.error) {
        return error.response.data.error;
      }
      if (error.response?.data?.details) {
        return error.response.data.details;
      }
      if (error.message) {
        return error.message;
      }
    }
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }
}
```

### 5.2 Key API Client Features

1. **Automatic JWT Token Management**:
   - Token obtained on first request
   - Automatic refresh 5 minutes before expiry
   - 401 error handling with automatic re-authentication

2. **Retry Logic**:
   - 3 retry attempts for network/5xx errors
   - Exponential backoff delay
   - Configurable via axios-retry

3. **Error Handling**:
   - Comprehensive error logging
   - Graceful degradation (returns null/false instead of throwing)
   - Debug mode for detailed error information

4. **Request Interceptors**:
   - Automatic Bearer token injection
   - Pre-request token validation
   - Debug logging for all requests

---

## 6. Platform Implementation

### 6.1 src/platform.ts

```typescript
import {
  API,
  DynamicPlatformPlugin,
  Logger,
  PlatformAccessory,
  PlatformConfig,
  Service,
  Characteristic,
} from 'homebridge';

import { PLATFORM_NAME, PLUGIN_NAME } from './constants';
import { PCRemoteWakePlatformConfig, Device } from './types';
import { ApiClient } from './api-client';
import { PCAccessory } from './accessory';

/**
 * PC Remote Wake Platform
 *
 * Responsibilities:
 * - Discover devices from webapp
 * - Create/update/remove HomeKit accessories
 * - Manage accessory lifecycle
 * - Handle platform-level configuration
 */
export class PCRemoteWakePlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;

  // Track registered accessories
  public readonly accessories: PlatformAccessory[] = [];

  // Track active PC accessory instances
  private readonly pcAccessories: Map<string, PCAccessory> = new Map();

  // API client for webapp communication
  private readonly apiClient: ApiClient;

  // Configuration with defaults
  private readonly config: Required<PCRemoteWakePlatformConfig>;

  // Device discovery interval
  private discoveryInterval?: NodeJS.Timeout;

  constructor(
    public readonly log: Logger,
    config: PlatformConfig,
    public readonly api: API,
  ) {
    // Merge user config with defaults
    this.config = {
      ...config,
      webappUrl: config.webappUrl || 'http://localhost:3000',
      username: config.username || '',
      password: config.password || '',
      offAction: config.offAction || 'sleep',
      pollingInterval: config.pollingInterval || 45,
      statusCheckTimeout: config.statusCheckTimeout || 5000,
      wakeTimeout: config.wakeTimeout || 60,
      deviceFilter: config.deviceFilter || [],
      debug: config.debug || false,
    } as Required<PCRemoteWakePlatformConfig>;

    // Validate required configuration
    if (!this.config.webappUrl || !this.config.username || !this.config.password) {
      this.log.error('Missing required configuration: webappUrl, username, or password');
      this.log.error('Platform will not initialize');
      return;
    }

    // Initialize API client
    this.apiClient = new ApiClient(
      this.config.webappUrl,
      this.config.username,
      this.config.password,
      this.log,
      this.config.debug,
      this.config.statusCheckTimeout,
    );

    this.log.info('Initializing platform:', this.config.name);

    if (this.config.debug) {
      this.log.debug('Platform configuration:', JSON.stringify({
        webappUrl: this.config.webappUrl,
        username: this.config.username,
        offAction: this.config.offAction,
        pollingInterval: this.config.pollingInterval,
        deviceFilter: this.config.deviceFilter,
      }));
    }

    // Wait for Homebridge to finish launching
    this.api.on('didFinishLaunching', () => {
      this.log.debug('Executed didFinishLaunching callback');
      this.discoverDevices();

      // Set up periodic device discovery (every 5 minutes)
      this.discoveryInterval = setInterval(() => {
        this.discoverDevices();
      }, 5 * 60 * 1000);
    });

    // Clean up on shutdown
    this.api.on('shutdown', () => {
      if (this.discoveryInterval) {
        clearInterval(this.discoveryInterval);
      }
      // Stop all accessories
      this.pcAccessories.forEach(accessory => accessory.destroy());
    });
  }

  /**
   * Configure cached accessory restored from disk
   * Called by Homebridge during startup for each cached accessory
   */
  configureAccessory(accessory: PlatformAccessory): void {
    this.log.info('Loading accessory from cache:', accessory.displayName);
    this.accessories.push(accessory);
  }

  /**
   * Discover devices from webapp and create/update accessories
   */
  async discoverDevices(): Promise<void> {
    try {
      this.log.debug('Discovering devices from webapp...');

      // Test connection first
      const connected = await this.apiClient.testConnection();
      if (!connected) {
        this.log.error('Failed to connect to webapp, skipping device discovery');
        return;
      }

      // Fetch devices
      const devices = await this.apiClient.getDevices();
      this.log.info(`Discovered ${devices.length} device(s) from webapp`);

      // Apply device filter if configured
      const filteredDevices = this.config.deviceFilter.length > 0
        ? devices.filter(device => this.config.deviceFilter.includes(device.name))
        : devices;

      if (this.config.deviceFilter.length > 0) {
        this.log.info(`Filtered to ${filteredDevices.length} device(s) based on deviceFilter`);
      }

      // Track which devices are still present
      const activeDeviceIds = new Set<string>();

      // Create or update accessories for each device
      for (const device of filteredDevices) {
        const uuid = this.api.hap.uuid.generate(device.mac_address);
        activeDeviceIds.add(uuid);

        // Check if accessory already exists
        const existingAccessory = this.accessories.find(acc => acc.UUID === uuid);

        if (existingAccessory) {
          // Update existing accessory
          this.log.info('Restoring existing accessory:', device.name);
          existingAccessory.context.device = device;
          this.api.updatePlatformAccessories([existingAccessory]);

          // Update or create PC accessory instance
          if (!this.pcAccessories.has(uuid)) {
            this.pcAccessories.set(
              uuid,
              new PCAccessory(this, existingAccessory, device),
            );
          }
        } else {
          // Create new accessory
          this.log.info('Adding new accessory:', device.name);
          const accessory = new this.api.platformAccessory(device.name, uuid);
          accessory.context.device = device;

          // Create PC accessory instance
          this.pcAccessories.set(
            uuid,
            new PCAccessory(this, accessory, device),
          );

          // Register with Homebridge
          this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
          this.accessories.push(accessory);
        }
      }

      // Remove accessories that are no longer in device list
      const accessoriesToRemove = this.accessories.filter(
        acc => !activeDeviceIds.has(acc.UUID),
      );

      for (const accessory of accessoriesToRemove) {
        this.log.info('Removing accessory:', accessory.displayName);

        // Stop accessory
        const pcAccessory = this.pcAccessories.get(accessory.UUID);
        if (pcAccessory) {
          pcAccessory.destroy();
          this.pcAccessories.delete(accessory.UUID);
        }

        // Unregister from Homebridge
        this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);

        // Remove from tracked accessories
        const index = this.accessories.indexOf(accessory);
        if (index > -1) {
          this.accessories.splice(index, 1);
        }
      }

    } catch (error) {
      this.log.error('Device discovery failed:', error);
    }
  }

  /**
   * Get API client instance
   */
  getApiClient(): ApiClient {
    return this.apiClient;
  }

  /**
   * Get platform configuration
   */
  getConfig(): Required<PCRemoteWakePlatformConfig> {
    return this.config;
  }
}
```

### 6.2 Platform Key Responsibilities

1. **Accessory Lifecycle Management**:
   - `configureAccessory()`: Restore cached accessories on startup
   - `discoverDevices()`: Fetch devices and create/update/remove accessories
   - Track active accessories in `accessories` array

2. **Device Discovery**:
   - Initial discovery on `didFinishLaunching`
   - Periodic re-discovery every 5 minutes
   - Device filtering based on configuration

3. **Configuration Management**:
   - Merge user config with sensible defaults
   - Validate required fields
   - Provide config access to accessories

---

## 7. Accessory Implementation

### 7.1 src/accessory.ts

```typescript
import {
  Service,
  PlatformAccessory,
  CharacteristicValue,
} from 'homebridge';

import { PCRemoteWakePlatform } from './platform';
import { Device, DeviceStatus } from './types';

/**
 * PC Switch Accessory
 *
 * Represents a single PC as a HomeKit Switch accessory
 *
 * Characteristics:
 * - On: Power state (true = on, false = off)
 * - StatusActive: PC is responsive
 * - Name: Device name
 *
 * Behaviors:
 * - Set On=true: Send WOL packet, poll until online or timeout
 * - Set On=false: Send sleep/shutdown command (configurable)
 * - Get On: Return current online status
 */
export class PCAccessory {
  private service: Service;
  private statusPollingInterval?: NodeJS.Timeout;
  private currentStatus: DeviceStatus | null = null;
  private lastStatusCheck: number = 0;
  private isWaking: boolean = false;
  private wakeStartTime: number = 0;

  constructor(
    private readonly platform: PCRemoteWakePlatform,
    private readonly accessory: PlatformAccessory,
    private device: Device,
  ) {
    // Set accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'PC Remote Wake')
      .setCharacteristic(this.platform.Characteristic.Model, 'PC Switch')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, device.mac_address)
      .setCharacteristic(this.platform.Characteristic.FirmwareRevision, '1.0.0');

    // Get or create Switch service
    this.service = this.accessory.getService(this.platform.Service.Switch) ||
                   this.accessory.addService(this.platform.Service.Switch);

    // Set service name
    this.service.setCharacteristic(
      this.platform.Characteristic.Name,
      device.name,
    );

    // Register handlers for On characteristic
    this.service.getCharacteristic(this.platform.Characteristic.On)
      .onSet(this.setOn.bind(this))
      .onGet(this.getOn.bind(this));

    // Start status polling
    this.startStatusPolling();

    // Perform initial status check
    this.updateStatus();

    this.platform.log.debug(`Accessory initialized: ${device.name}`);
  }

  /**
   * Handle SET requests for On characteristic
   */
  async setOn(value: CharacteristicValue): Promise<void> {
    const isOn = value as boolean;
    const apiClient = this.platform.getApiClient();
    const config = this.platform.getConfig();

    this.platform.log.info(`${this.device.name}: Set power to ${isOn ? 'ON' : 'OFF'}`);

    try {
      if (isOn) {
        // Wake device
        await this.handleWake();
      } else {
        // Sleep or shutdown device
        await this.handlePowerOff(config.offAction);
      }
    } catch (error) {
      this.platform.log.error(`${this.device.name}: Power control failed:`, error);
      throw new this.platform.api.hap.HapStatusError(
        this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE,
      );
    }
  }

  /**
   * Handle GET requests for On characteristic
   */
  async getOn(): Promise<CharacteristicValue> {
    const isOn = this.currentStatus?.online ?? false;

    this.platform.log.debug(`${this.device.name}: Get power state: ${isOn}`);

    return isOn;
  }

  /**
   * Handle wake operation
   */
  private async handleWake(): Promise<void> {
    const apiClient = this.platform.getApiClient();
    const config = this.platform.getConfig();

    // Send WOL packet
    this.platform.log.info(`${this.device.name}: Sending WOL packet to ${this.device.mac_address}`);
    const wakeSuccess = await apiClient.wakeDevice(this.device.mac_address);

    if (!wakeSuccess) {
      this.platform.log.error(`${this.device.name}: Failed to send WOL packet`);
      throw new Error('WOL packet failed');
    }

    // Set waking state
    this.isWaking = true;
    this.wakeStartTime = Date.now();

    // Wait for device to come online
    this.platform.log.info(`${this.device.name}: Waiting for device to wake (timeout: ${config.wakeTimeout}s)`);

    const startTime = Date.now();
    const timeout = config.wakeTimeout * 1000;
    const checkInterval = 5000; // Check every 5 seconds

    while (Date.now() - startTime < timeout) {
      // Wait before checking
      await new Promise(resolve => setTimeout(resolve, checkInterval));

      // Check status
      await this.updateStatus();

      if (this.currentStatus?.online) {
        this.platform.log.info(`${this.device.name}: Device is now online`);
        this.isWaking = false;
        this.service.updateCharacteristic(
          this.platform.Characteristic.On,
          true,
        );
        return;
      }
    }

    // Timeout reached
    this.isWaking = false;
    this.platform.log.warn(`${this.device.name}: Wake timeout reached, device may still be starting`);

    // Update characteristic to reflect actual state
    this.service.updateCharacteristic(
      this.platform.Characteristic.On,
      this.currentStatus?.online ?? false,
    );
  }

  /**
   * Handle power off operation (sleep or shutdown)
   */
  private async handlePowerOff(action: 'sleep' | 'shutdown'): Promise<void> {
    const apiClient = this.platform.getApiClient();

    // Check if device has required SSH credentials
    if (!this.device.ssh_username || !this.device.ssh_password) {
      this.platform.log.error(
        `${this.device.name}: SSH credentials not configured, cannot ${action}`,
      );
      throw new Error('SSH credentials required');
    }

    if (!this.device.ip_address) {
      this.platform.log.error(
        `${this.device.name}: IP address not configured, cannot ${action}`,
      );
      throw new Error('IP address required');
    }

    // Check if device is online before attempting power off
    if (!this.currentStatus?.online) {
      this.platform.log.warn(
        `${this.device.name}: Device appears offline, ${action} may fail`,
      );
    }

    // Send appropriate command
    this.platform.log.info(`${this.device.name}: Sending ${action} command`);

    const success = action === 'sleep'
      ? await apiClient.sleepDevice(this.device.id)
      : await apiClient.shutdownDevice(this.device.id);

    if (!success) {
      this.platform.log.error(`${this.device.name}: ${action} command failed`);
      throw new Error(`${action} command failed`);
    }

    this.platform.log.info(`${this.device.name}: ${action} command sent successfully`);

    // Update status after a short delay
    setTimeout(() => {
      this.updateStatus();
    }, 3000);
  }

  /**
   * Update device status from webapp
   */
  private async updateStatus(): Promise<void> {
    // Skip if no IP address configured
    if (!this.device.ip_address) {
      this.platform.log.debug(`${this.device.name}: No IP address, cannot check status`);
      return;
    }

    // Rate limit status checks (minimum 5 seconds between checks)
    const now = Date.now();
    if (now - this.lastStatusCheck < 5000 && !this.isWaking) {
      return;
    }
    this.lastStatusCheck = now;

    try {
      const apiClient = this.platform.getApiClient();
      const status = await apiClient.getDeviceStatus(this.device.ip_address);

      if (status) {
        const wasOnline = this.currentStatus?.online ?? false;
        const isNowOnline = status.online;

        this.currentStatus = status;

        // Log status changes
        if (wasOnline !== isNowOnline) {
          this.platform.log.info(
            `${this.device.name}: Status changed to ${isNowOnline ? 'ONLINE' : 'OFFLINE'}`,
          );
        }

        // Update HomeKit characteristic
        this.service.updateCharacteristic(
          this.platform.Characteristic.On,
          isNowOnline,
        );

        // Update StatusActive characteristic (optional)
        if (this.service.testCharacteristic(this.platform.Characteristic.StatusActive)) {
          this.service.updateCharacteristic(
            this.platform.Characteristic.StatusActive,
            isNowOnline,
          );
        }
      }
    } catch (error) {
      this.platform.log.error(`${this.device.name}: Status check failed:`, error);
    }
  }

  /**
   * Start periodic status polling
   */
  private startStatusPolling(): void {
    const config = this.platform.getConfig();
    const interval = config.pollingInterval * 1000;

    this.platform.log.debug(
      `${this.device.name}: Starting status polling (interval: ${config.pollingInterval}s)`,
    );

    this.statusPollingInterval = setInterval(() => {
      this.updateStatus();
    }, interval);
  }

  /**
   * Stop status polling and clean up
   */
  destroy(): void {
    if (this.statusPollingInterval) {
      clearInterval(this.statusPollingInterval);
      this.statusPollingInterval = undefined;
    }
    this.platform.log.debug(`${this.device.name}: Accessory destroyed`);
  }

  /**
   * Update device information
   */
  updateDevice(device: Device): void {
    this.device = device;
    this.accessory.context.device = device;

    // Update service name if changed
    this.service.updateCharacteristic(
      this.platform.Characteristic.Name,
      device.name,
    );

    this.platform.log.debug(`${device.name}: Device information updated`);
  }
}
```

### 7.2 Accessory State Management

**Power State Flow**:
```
ON Request → Send WOL packet → Poll status every 5s →
  → Device online? → Update characteristic to ON
  → Timeout? → Update characteristic to actual state, log warning

OFF Request → Validate SSH config → Send sleep/shutdown command →
  → Wait 3s → Update status
```

**Status Polling**:
- Configurable interval (default: 45 seconds)
- Rate-limited to minimum 5 seconds between checks
- Accelerated polling during wake operation
- Updates HomeKit characteristic on status change

**Error Handling**:
- Missing SSH credentials → Log error, throw exception
- WOL packet failure → Log error, throw exception
- Status check failure → Log error, continue polling
- API errors → Return HAP status error to HomeKit

---

## 8. Constants and Entry Point

### 8.1 src/constants.ts

```typescript
/**
 * Plugin constants
 */

/** Plugin name must match package.json "name" field */
export const PLUGIN_NAME = 'homebridge-pc-remote-wake';

/** Platform name must match config.schema.json "pluginAlias" field */
export const PLATFORM_NAME = 'PCRemoteWake';
```

### 8.2 src/index.ts

```typescript
import { API } from 'homebridge';
import { PLATFORM_NAME } from './constants';
import { PCRemoteWakePlatform } from './platform';

/**
 * This method registers the platform with Homebridge
 */
export = (api: API) => {
  api.registerPlatform(PLATFORM_NAME, PCRemoteWakePlatform);
};
```

---

## 9. Error Handling Strategy

### 9.1 Error Categories and Responses

**Network Errors**:
- **Symptoms**: Connection timeouts, DNS failures, unreachable host
- **Handling**:
  - Retry with exponential backoff (via axios-retry)
  - Log warnings for transient failures
  - Return graceful defaults (offline status)
  - Do not throw exceptions to HomeKit

**Authentication Errors**:
- **Symptoms**: 401 Unauthorized, invalid credentials
- **Handling**:
  - Automatic token refresh on 401
  - Re-authenticate and retry request
  - Log error if credentials are invalid
  - Prevent platform initialization if auth fails

**API Errors**:
- **Symptoms**: 4xx/5xx status codes, malformed responses
- **Handling**:
  - Parse error messages from response body
  - Log detailed error information in debug mode
  - Return boolean false for failed operations
  - Update HomeKit with actual device state

**Device Configuration Errors**:
- **Symptoms**: Missing IP address, missing SSH credentials
- **Handling**:
  - Validate before attempting operations
  - Return descriptive error messages
  - Allow WOL operations (no IP required)
  - Block sleep/shutdown without SSH config

**State Desynchronization**:
- **Symptoms**: HomeKit shows ON but device is OFF
- **Handling**:
  - Periodic status polling refreshes state
  - Force status update after power operations
  - Update characteristic immediately on status change
  - Log all state transitions

### 9.2 Graceful Degradation

**Offline Webapp**:
- Log connection failure
- Skip device discovery
- Continue using cached devices
- Retry on next discovery interval (5 minutes)

**Device Unreachable**:
- Status check returns offline
- WOL still attempted (UDP broadcast doesn't require reachability)
- Sleep/shutdown operations fail gracefully
- HomeKit reflects actual offline state

**Partial Configuration**:
- Devices without IP address: WOL works, status checks skipped
- Devices without SSH credentials: WOL works, power off operations fail
- Missing device filter: All devices exposed

### 9.3 Logging Strategy

**Log Levels**:
- `error`: Authentication failures, API errors, critical failures
- `warn`: Timeouts, transient failures, configuration warnings
- `info`: Device discovery, status changes, power operations
- `debug`: API requests/responses, polling intervals, state updates (enabled by debug flag)

**Debug Mode Benefits**:
- Full request/response logging
- Detailed error information
- Status check timestamps
- Configuration dump on startup

---

## 10. Testing and Validation

### 10.1 Manual Testing Checklist

**Initial Setup**:
- [ ] Install plugin via Homebridge UI or npm
- [ ] Configure platform with webapp URL and credentials
- [ ] Verify plugin appears in Homebridge logs
- [ ] Check authentication success message

**Device Discovery**:
- [ ] Verify devices appear in HomeKit
- [ ] Check device names match webapp
- [ ] Validate device filtering (if configured)
- [ ] Confirm periodic re-discovery works

**Wake-on-LAN**:
- [ ] Turn on device via HomeKit
- [ ] Verify WOL packet sent (check logs)
- [ ] Confirm device wakes and comes online
- [ ] Validate status updates in HomeKit
- [ ] Test wake timeout behavior

**Power Off**:
- [ ] Configure SSH credentials in webapp
- [ ] Turn off device via HomeKit (sleep mode)
- [ ] Verify SSH command sent
- [ ] Confirm device sleeps/shuts down
- [ ] Test with shutdown mode configuration

**Status Polling**:
- [ ] Observe periodic status updates in logs
- [ ] Manually power on/off PC outside HomeKit
- [ ] Verify HomeKit reflects actual state
- [ ] Check polling interval matches configuration

**Error Handling**:
- [ ] Test with invalid credentials
- [ ] Test with unreachable webapp
- [ ] Test with device without SSH credentials
- [ ] Test with device without IP address
- [ ] Verify graceful error handling

**Edge Cases**:
- [ ] Remove device from webapp, check accessory removal
- [ ] Add new device to webapp, check accessory creation
- [ ] Rename device in webapp, check HomeKit name update
- [ ] Restart Homebridge, verify accessories restored

### 10.2 Configuration Validation Tests

**Valid Configuration**:
```json
{
  "platform": "PCRemoteWake",
  "webappUrl": "http://192.168.1.100:3000",
  "username": "admin",
  "password": "password123",
  "offAction": "sleep",
  "pollingInterval": 60,
  "deviceFilter": ["Gaming PC", "Office PC"]
}
```

**Minimal Configuration**:
```json
{
  "platform": "PCRemoteWake",
  "webappUrl": "http://localhost:3000",
  "username": "admin",
  "password": "password123"
}
```

**Invalid Configuration** (should fail gracefully):
```json
{
  "platform": "PCRemoteWake",
  "webappUrl": "http://invalid-url",
  "username": "",
  "password": ""
}
```

---

## 11. Deployment and Distribution

### 11.1 Build Process

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run build

# Output to dist/ directory
# dist/index.js is the entry point
```

### 11.2 NPM Package Publishing

```bash
# Update version in package.json
npm version patch|minor|major

# Build distribution files
npm run build

# Publish to npm registry
npm publish
```

### 11.3 Installation Methods

**Via Homebridge UI** (Recommended):
1. Open Homebridge Config UI X
2. Navigate to Plugins tab
3. Search for "homebridge-pc-remote-wake"
4. Click Install
5. Configure via UI (uses config.schema.json)

**Via npm** (Command Line):
```bash
# Global installation
sudo npm install -g homebridge-pc-remote-wake

# Add platform configuration to Homebridge config.json
```

**Via GitHub** (Development):
```bash
# Clone repository
git clone https://github.com/yourusername/homebridge-pc-remote-wake.git
cd homebridge-pc-remote-wake

# Install and build
npm install
npm run build

# Link for local testing
sudo npm link

# Homebridge will discover the plugin
```

---

## 12. Security Considerations

### 12.1 Credential Storage

**Problem**: Webapp credentials stored in Homebridge config.json

**Mitigation**:
- Homebridge config.json should have restricted file permissions (600)
- Consider environment variables for sensitive data
- Warn users not to expose config publicly

### 12.2 JWT Token Handling

**Security**:
- Tokens stored in memory only (not persisted)
- Automatic expiration and refresh
- Bearer token passed in Authorization header

### 12.3 Network Security

**Considerations**:
- Plugin designed for local network use only
- No HTTPS enforcement (local network assumption)
- Webapp should not be exposed to internet
- Consider VPN for remote HomeKit access

### 12.4 SSH Credentials

**Risk**: SSH credentials stored in webapp database

**Mitigation**:
- Plugin does not handle SSH credentials directly
- Credentials managed by webapp
- Consider key-based SSH authentication in webapp

---

## 13. Performance Optimization

### 13.1 Polling Efficiency

**Default Interval**: 45 seconds
- Balances responsiveness with network overhead
- Configurable per user preference
- Rate-limited to minimum 5 seconds

**Accelerated Polling**:
- During wake operations: 5-second checks
- Reduces perceived latency
- Automatic fallback to normal polling

### 13.2 API Request Batching

**Current**: Individual requests per device
**Future Enhancement**: Batch status checks
```typescript
// Future API endpoint
POST /api/devices/status/batch
{ deviceIds: [1, 2, 3] }
```

### 13.3 Caching Strategy

**Current**:
- Device list cached until discovery interval (5 minutes)
- Status cached with rate-limiting (minimum 5 seconds)

**Benefits**:
- Reduces API load
- Improves responsiveness
- Handles temporary network issues

---

## 14. Future Enhancements

### 14.1 Advanced Features

**RDP Ready Indicator**:
- Expose as separate HomeKit sensor
- Allows automation based on RDP availability

**Power Consumption Estimation**:
- HomeKit Energy Service support
- Estimate based on online/offline state

**Multi-Action Support**:
- Configurable per-device off actions
- Sleep vs Shutdown vs Hibernate

**Wake Reason Logging**:
- Track WOL requests
- HomeKit automation vs manual trigger

### 14.2 Webapp Integration Improvements

**Device Events**:
- Webapp webhook for instant status updates
- Eliminates polling delay
- Reduces network overhead

**Batch API Endpoints**:
- Get status for multiple devices
- Reduces API calls from N to 1

**Device Discovery Webhook**:
- Instant accessory creation/removal
- No 5-minute discovery delay

### 14.3 HomeKit Features

**Scene Support**:
- "Movie Time" → Wake Gaming PC + TV
- "Bedtime" → Sleep all PCs

**Automation Ideas**:
- Wake PC when arriving home
- Sleep PC at midnight
- Wake PC when opening remote desktop app

---

## 15. Troubleshooting Guide

### 15.1 Common Issues

**Plugin not appearing in HomeKit**:
- Check Homebridge logs for errors
- Verify config.json syntax
- Ensure plugin installed correctly
- Restart Homebridge

**Authentication failures**:
- Verify webapp URL is correct and reachable
- Check username/password in config
- Test webapp login via browser
- Check JWT_SECRET is set in webapp

**Devices not discovered**:
- Verify webapp is running
- Check device list in webapp
- Review device filter configuration
- Check Homebridge logs for API errors

**Status not updating**:
- Verify device has IP address configured
- Check network connectivity to device
- Review status check timeout setting
- Enable debug mode for detailed logs

**WOL not working**:
- Verify WOL enabled in PC BIOS
- Check network adapter WOL settings in Windows
- Ensure PC and Homebridge on same subnet
- Test WOL from webapp directly

**Sleep/Shutdown failing**:
- Verify SSH credentials configured
- Check OpenSSH server running on Windows
- Test SSH connection manually
- Review device IP address configuration

### 15.2 Debug Mode

**Enable debug logging**:
```json
{
  "platform": "PCRemoteWake",
  "debug": true,
  ...
}
```

**Debug information includes**:
- All API requests and responses
- Status check results
- Configuration dump
- Detailed error messages
- State transition logs

### 15.3 Log Analysis

**Successful wake operation**:
```
[PCRemoteWake] Gaming PC: Set power to ON
[PCRemoteWake] Gaming PC: Sending WOL packet to AA:BB:CC:DD:EE:FF
[PCRemoteWake] Gaming PC: Waiting for device to wake (timeout: 60s)
[PCRemoteWake] Gaming PC: Status changed to ONLINE
[PCRemoteWake] Gaming PC: Device is now online
```

**Failed authentication**:
```
[PCRemoteWake] Authentication failed: Invalid credentials
[PCRemoteWake] Connection test failed: Request failed with status code 401
[PCRemoteWake] Failed to connect to webapp, skipping device discovery
```

**Device offline**:
```
[PCRemoteWake] Gaming PC: Status changed to OFFLINE
[PCRemoteWake] Gaming PC: Get power state: false
```

---

## 16. Conclusion

This specification provides a complete blueprint for implementing a Homebridge plugin that integrates with the PC Remote Wake webapp. The plugin follows Homebridge best practices and provides robust error handling, graceful degradation, and user-friendly configuration.

### Key Design Decisions

1. **Dynamic Platform Plugin**: Supports multiple devices without config changes
2. **API-First Design**: All operations delegated to webapp API
3. **Graceful Error Handling**: Never crashes, always returns sensible defaults
4. **Configurable Behavior**: User controls polling interval, off action, device filtering
5. **Debug Mode**: Comprehensive logging for troubleshooting

### Implementation Roadmap

1. **Phase 1**: Core platform and accessory implementation
2. **Phase 2**: API client with authentication and retry logic
3. **Phase 3**: Configuration schema and Homebridge UI integration
4. **Phase 4**: Testing, documentation, and NPM publishing
5. **Phase 5**: Future enhancements (webhooks, batch APIs, advanced features)

### Success Criteria

- [x] Each PC device exposed as HomeKit Switch
- [x] ON = Wake PC (WOL)
- [x] OFF = Sleep/Shutdown (configurable)
- [x] Status polling (30-60 seconds, configurable)
- [x] Graceful offline handling
- [x] Comprehensive error handling
- [x] User-friendly configuration
- [x] Debug mode for troubleshooting

### File References

- **Webapp API**: `/Users/hvnguyen/Projects/rpi-remote-wol/app/api/`
- **Database Layer**: `/Users/hvnguyen/Projects/rpi-remote-wol/lib/db.ts`
- **Authentication**: `/Users/hvnguyen/Projects/rpi-remote-wol/lib/auth.ts`
- **Project Docs**: `/Users/hvnguyen/Projects/rpi-remote-wol/CLAUDE.md`

---

**Document Version**: 1.0.0
**Last Updated**: 2025-10-14
**Target Homebridge Version**: >=1.6.0
**Target Node Version**: >=18.0.0
