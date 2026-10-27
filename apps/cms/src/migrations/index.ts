import * as migration_20261026_233707_initial from './20261026_233707_initial';
import * as migration_20261027_032500_media_storage from './20261027_032500_media_storage';

export const migrations = [
  {
    up: migration_20261026_233707_initial.up,
    down: migration_20261026_233707_initial.down,
    name: '20261026_233707_initial',
  },
  {
    up: migration_20261027_032500_media_storage.up,
    down: migration_20261027_032500_media_storage.down,
    name: '20261027_032500_media_storage'
  },
];
