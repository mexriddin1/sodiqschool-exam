// Roadmap builder for Tanqidiy fikrlash. Delegates to the shared v2 engine
// (see programs.js for the adapter).
import { buildProgramsFor, buildSkillGrowthFor } from './programs.js';

export function buildCtPrograms(r, aiRoadmap, catalog) { return buildProgramsFor('CRITICAL_THINKING', r, aiRoadmap, catalog); }
export function buildCtSkillGrowth(r) { return buildSkillGrowthFor('CRITICAL_THINKING', r); }
