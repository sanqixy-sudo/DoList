import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerZIP } from '@electron-forge/maker-zip';

const config: ForgeConfig = {
  packagerConfig: {
    name: 'DoList',
    executableName: 'DoList',
    icon: './resources/icon',
    asar: true,
    appCopyright: 'Copyright 2024 DoList Team',
  },
  rebuildConfig: {},
  makers: [
    new MakerZIP({}, ['win32']),
  ],
};

export default config;
