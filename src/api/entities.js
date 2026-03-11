/**
 * Entity storage — localStorage-backed CRUD, no external dependencies.
 * Drop-in replacement for base44.entities.*
 */
import { createOfflineClient } from './localStorageEngine';

const { entities } = createOfflineClient();
export { entities };
