// Roadmap builder for Tanqidiy fikrlash. Delegates to the shared v2 engine
// (see programs.js for the adapter).
import { buildProgramsFor, buildSkillGrowthFor } from './programs.js';

export function buildCtPrograms(r, aiRoadmap) { return buildProgramsFor('CRITICAL_THINKING', r, aiRoadmap); }
export function buildCtSkillGrowth(r) { return buildSkillGrowthFor('CRITICAL_THINKING', r); }
