import { createOfflineClient } from './localStorageEngine';

// Always use local storage engine (no Base44 dependency)
export const base44 = createOfflineClient();
