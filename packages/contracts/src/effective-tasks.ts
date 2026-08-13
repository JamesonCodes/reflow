export interface EffectiveTaskSource {
  apparentObjective: string;
  confidence: number;
  endStepOrdinal: number;
  id: string;
  inferenceRunId: string;
  neutralLabel: string;
  participatingSystems: string[];
  startStepOrdinal: number;
}

export interface EffectiveTaskCorrection {
  correctionType: 'rename' | 'merge' | 'split' | 'reject';
  createdAt: string;
  id: string;
  replacementLabels: string[];
  sourceTaskInstanceIds: string[];
  splitAfterStepOrdinal: number | null;
}

export interface EffectiveTaskInstance {
  apparentObjective: string;
  confidence: number;
  correctionId: string | null;
  effectiveId: string;
  endStepOrdinal: number;
  neutralLabel: string;
  participatingSystems: string[];
  sourceTaskInstanceIds: string[];
  startStepOrdinal: number;
}

export interface EffectiveTaskResolution {
  rejectedSourceTaskIds: string[];
  tasks: EffectiveTaskInstance[];
}

function fromSource(source: EffectiveTaskSource): EffectiveTaskInstance {
  return {
    apparentObjective: source.apparentObjective,
    confidence: source.confidence,
    correctionId: null,
    effectiveId: source.id,
    endStepOrdinal: source.endStepOrdinal,
    neutralLabel: source.neutralLabel,
    participatingSystems: source.participatingSystems,
    sourceTaskInstanceIds: [source.id],
    startStepOrdinal: source.startStepOrdinal,
  };
}

export function resolveEffectiveTasks(
  sources: EffectiveTaskSource[],
  corrections: EffectiveTaskCorrection[],
): EffectiveTaskResolution {
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const claimed = new Set<string>();
  const corrected: EffectiveTaskInstance[] = [];
  const rejectedSourceTaskIds: string[] = [];

  const newestFirst = [...corrections].sort(
    (left, right) =>
      right.createdAt.localeCompare(left.createdAt) ||
      right.id.localeCompare(left.id),
  );
  for (const correction of newestFirst) {
    const correctionSources = correction.sourceTaskInstanceIds
      .map((id) => sourceById.get(id))
      .filter((source): source is EffectiveTaskSource => Boolean(source))
      .sort((left, right) => left.startStepOrdinal - right.startStepOrdinal);
    if (
      correctionSources.length !== correction.sourceTaskInstanceIds.length ||
      correctionSources.some((source) => claimed.has(source.id))
    )
      continue;
    correctionSources.forEach((source) => claimed.add(source.id));

    const first = correctionSources[0]!;
    const last = correctionSources.at(-1)!;
    const systems = [
      ...new Set(
        correctionSources.flatMap((source) => source.participatingSystems),
      ),
    ].sort();
    const shared = {
      confidence: Math.min(
        ...correctionSources.map((source) => source.confidence),
      ),
      correctionId: correction.id,
      participatingSystems: systems,
      sourceTaskInstanceIds: correctionSources.map((source) => source.id),
    };

    if (correction.correctionType === 'reject') {
      rejectedSourceTaskIds.push(
        ...correctionSources.map((source) => source.id),
      );
    } else if (correction.correctionType === 'split') {
      const split = correction.splitAfterStepOrdinal!;
      corrected.push(
        {
          ...shared,
          apparentObjective: first.apparentObjective,
          effectiveId: `${correction.id}:1`,
          endStepOrdinal: split,
          neutralLabel: correction.replacementLabels[0]!,
          startStepOrdinal: first.startStepOrdinal,
        },
        {
          ...shared,
          apparentObjective: first.apparentObjective,
          effectiveId: `${correction.id}:2`,
          endStepOrdinal: last.endStepOrdinal,
          neutralLabel: correction.replacementLabels[1]!,
          startStepOrdinal: split + 1,
        },
      );
    } else {
      corrected.push({
        ...shared,
        apparentObjective:
          correction.correctionType === 'merge'
            ? correctionSources
                .map((source) => source.apparentObjective)
                .join(' / ')
            : first.apparentObjective,
        effectiveId: `${correction.id}:1`,
        endStepOrdinal: last.endStepOrdinal,
        neutralLabel: correction.replacementLabels[0]!,
        startStepOrdinal: first.startStepOrdinal,
      });
    }
  }

  const untouched = sources
    .filter((source) => !claimed.has(source.id))
    .map(fromSource);
  return {
    rejectedSourceTaskIds: rejectedSourceTaskIds.sort(),
    tasks: [...corrected, ...untouched].sort(
      (left, right) => left.startStepOrdinal - right.startStepOrdinal,
    ),
  };
}
