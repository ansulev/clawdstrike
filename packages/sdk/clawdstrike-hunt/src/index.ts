export {
  HuntError,
  QueryError,
  ParseError,
  IoError,
  CorrelationError,
  IocError,
  WatchError,
  ReportError,
} from './errors.js';

export {
  EventSourceType,
  TimelineEventKind,
  NormalizedVerdict,
  QueryVerdict,
  RuleSeverity,
  IocType,
} from './types.js';

export type {
  TimelineEvent,
  HuntQuery,
  RuleCondition,
  RuleOutput,
  CorrelationRule,
  Alert,
  IocEntry,
  IocMatch,
  EvidenceItem,
  HuntReport,
  WatchConfig,
  WatchStats,
} from './types.js';

export { parseHumanDuration } from './duration.js';

export {
  parseEventSource,
  parseEventSourceList,
  streamName,
  subjectFilter,
  allEventSources,
  parseQueryVerdict,
  createHuntQuery,
  effectiveSources,
  matchesQuery,
} from './query.js';

export { parseEnvelope, mergeTimeline } from './timeline.js';

export { defaultLocalDirs, queryLocalFiles } from './local.js';

// Correlate
export {
  CorrelationEngine,
  containsWordBounded,
  detectIocType,
  IocDatabase,
  loadRulesFromFiles,
  parseRule,
  validateRule,
} from './correlate/index.js';

// Report
export {
  buildReport,
  evidenceFromAlert,
  evidenceFromEvents,
  evidenceFromIocMatches,
  signReport,
  verifyReport,
} from './report.js';

// Watch
export { runWatch } from './watch.js';
