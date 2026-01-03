import type { AutoBuildPhase } from '@/src/types';

export function formatTime(dateStr: string | undefined | null): string {
  if (!dateStr) return 'Unknown';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function getPhaseLabel(phase: AutoBuildPhase): string {
  switch (phase) {
    case 'selecting': return 'Selecting';
    case 'working': return 'Working';
    case 'selfReviewing': return 'Self Review';
    case 'auditing': return 'Auditing';
    case 'testing': return 'Testing';
    case 'fixing': return 'Fixing';
    case 'reviewing': return 'Review';
    case 'committing': return 'Committing';
    default: return '';
  }
}

export function getPhaseIcon(phase?: AutoBuildPhase): string {
  switch (phase) {
    case 'working': return 'wrench';
    case 'selfReviewing': return 'eye';
    case 'auditing': return 'search';
    case 'testing': return 'flask';
    case 'fixing': return 'wrench';
    case 'committing': return 'git-square';
    case 'reviewing': return 'eye';
    default: return 'bolt';
  }
}
