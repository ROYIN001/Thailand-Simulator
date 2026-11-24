import { readFileSync } from 'node:fs';
import type { Scenario } from '../../src/engine/scenario-types.ts';

export const scenario = JSON.parse(readFileSync('src/engine/scenario.oil-fund-2569.json', 'utf8')) as Scenario;
