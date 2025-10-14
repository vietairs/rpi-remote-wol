/**
 * Test data constants for e2e tests
 */

export const TEST_USERS = {
  admin: {
    username: 'testadmin',
    password: 'testpass123',
  },
  secondary: {
    username: 'testuser2',
    password: 'password456',
  },
};

export const TEST_DEVICES = {
  valid: {
    name: 'Test PC',
    macAddress: 'AA:BB:CC:DD:EE:FF',
    ipAddress: '192.168.1.100',
    sshUsername: 'testuser',
    sshPassword: 'testpass',
  },
  withDashes: {
    name: 'Gaming PC',
    macAddress: 'AA-BB-CC-DD-EE-11',
    ipAddress: '192.168.1.101',
  },
  noIp: {
    name: 'No IP Device',
    macAddress: '11:22:33:44:55:66',
  },
  noSsh: {
    name: 'No SSH Device',
    macAddress: 'AA:11:BB:22:CC:33',
    ipAddress: '192.168.1.102',
  },
  withAllFields: {
    name: 'Full Config Device',
    macAddress: 'FF:EE:DD:CC:BB:AA',
    ipAddress: '192.168.1.103',
    sshUsername: 'admin',
    sshPassword: 'secure123',
  },
};

export const INVALID_DEVICES = {
  invalidMac: {
    name: 'Invalid MAC',
    macAddress: 'ZZ:ZZ:ZZ:ZZ:ZZ:ZZ',
  },
  invalidIp: {
    name: 'Invalid IP',
    macAddress: 'AA:BB:CC:DD:EE:22',
    ipAddress: '999.999.999.999',
  },
  missingName: {
    macAddress: 'AA:BB:CC:DD:EE:33',
  },
  missingMac: {
    name: 'Missing MAC',
  },
};

export const TEST_TIMEOUTS = {
  statusCheck: 2000,
  wakeMonitor: 5000,
  autoRefresh: 30000,
  sshCommand: 10000,
};

export const TEST_PORTS = {
  smb: 445,
  rdp: 3389,
};
