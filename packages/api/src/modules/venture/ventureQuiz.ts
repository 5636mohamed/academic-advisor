// Spec §16.1 — the Venture Interest Form, shown after a YES answer to the
// Venture Gate. Same shape as §6's best-fit department quiz
// (QuizQuestion/QuizOption with traitTags[]) — deliberately reused rather
// than inventing a second trait-tagging mechanism, per §3.5b's note.
export interface VentureQuizOption {
  id: string;
  label: string;
  traitTags: string[];
}

export interface VentureQuizQuestion {
  id: string;
  text: string;
  options: VentureQuizOption[];
}

export type VentureQuizAnswers = Record<string, string>; // questionId -> optionId

export const VENTURE_QUIZ: VentureQuizQuestion[] = [
  {
    id: 'v1_domain',
    text: 'Which technical area excites you most right now?',
    options: [
      { id: 'v1_ml', label: 'Machine learning / data science', traitTags: ['machine_learning', 'data_science'] },
      { id: 'v1_embedded', label: 'Embedded systems / microcontrollers', traitTags: ['embedded_systems', 'hardware'] },
      { id: 'v1_circuits', label: 'Circuit design / analog electronics', traitTags: ['circuit_design', 'hardware'] },
      { id: 'v1_rf', label: 'RF / wireless communications', traitTags: ['rf_communications', 'hardware'] },
    ],
  },
  {
    id: 'v2_goal',
    text: 'What kind of opportunity are you most drawn to?',
    options: [
      { id: 'v2_research', label: 'Academic research — publishing, going deep on one problem', traitTags: ['research', 'data_science'] },
      { id: 'v2_startup', label: "A commercial spin-off — building something people will use", traitTags: ['commercialization', 'robotics'] },
      { id: 'v2_hardware', label: 'Hands-on hardware/prototype building', traitTags: ['embedded_systems', 'robotics', 'hardware'] },
      { id: 'v2_software', label: 'Software/algorithms at the core of the project', traitTags: ['machine_learning', 'data_science'] },
    ],
  },
  {
    id: 'v3_role',
    text: "On a small technical team, you'd rather be the person who…",
    options: [
      { id: 'v3_integrate', label: 'Gets the hardware and software talking to each other', traitTags: ['embedded_systems', 'rf_communications'] },
      { id: 'v3_model', label: 'Builds and tunes the model/algorithm', traitTags: ['machine_learning', 'data_science'] },
      { id: 'v3_design', label: 'Designs the circuit/board itself', traitTags: ['circuit_design', 'hardware'] },
      { id: 'v3_pitch', label: 'Figures out if/how it could become a real product', traitTags: ['commercialization'] },
    ],
  },
];
