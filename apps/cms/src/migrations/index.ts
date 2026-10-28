import * as migration_20261026_233707_initial from './20261026_233707_initial';
import * as migration_20261027_032500_media_storage from './20261027_032500_media_storage';
import * as migration_20261027_223256_autosave from './20261027_223256_autosave';
import * as migration_20261027_230216_store_content from './20261027_230216_store_content';
import * as migration_20261028_004658_webhook_events from './20261028_004658_webhook_events';

export const migrations = [
  {
    up: migration_20261026_233707_initial.up,
    down: migration_20261026_233707_initial.down,
    name: '20261026_233707_initial',
  },
  {
    up: migration_20261027_032500_media_storage.up,
    down: migration_20261027_032500_media_storage.down,
    name: '20261027_032500_media_storage',
  },
  {
    up: migration_20261027_223256_autosave.up,
    down: migration_20261027_223256_autosave.down,
    name: '20261027_223256_autosave',
  },
  {
    up: migration_20261027_230216_store_content.up,
    down: migration_20261027_230216_store_content.down,
    name: '20261027_230216_store_content',
  },
  {
    up: migration_20261028_004658_webhook_events.up,
    down: migration_20261028_004658_webhook_events.down,
    name: '20261028_004658_webhook_events'
  },
];
