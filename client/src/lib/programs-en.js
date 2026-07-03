// Roadmap builder for Ingliz tili. Delegates to the shared v2 engine —
// the programs.js file contains the shape adapter (kept in one place so
// all three subjects render identically in StageDetail.astro).
import { buildProgramsFor, buildSkillGrowthFor } from './programs.js';

export function buildEnglishPrograms(r) { return buildProgramsFor('ENGLISH', r); }
export function buildEnglishSkillGrowth(r) { return buildSkillGrowthFor('ENGLISH', r); }
