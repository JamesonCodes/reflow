export interface EffectiveProcessCandidateSource {
  apparentOutcome: string;
  confidence: number;
  id: string;
  instanceIds: string[];
  neutralLabel: string;
  participatingSystems: string[];
}

export interface EffectiveProcessCandidateCorrection {
  correctionType: 'rename' | 'merge' | 'split' | 'reject' | 'confirm';
  createdAt: string;
  id: string;
  replacementLabels: string[];
  selectedProcessInstanceIds: string[];
  sourceCandidateIds: string[];
}

export interface EffectiveProcessCandidate {
  apparentOutcome: string;
  confidence: number;
  correctionId: string | null;
  effectiveId: string;
  instanceIds: string[];
  neutralLabel: string;
  participatingSystems: string[];
  sourceCandidateIds: string[];
  status: 'discovered' | 'confirmed';
}

function fromSource(
  source: EffectiveProcessCandidateSource,
): EffectiveProcessCandidate {
  return {
    ...source,
    correctionId: null,
    effectiveId: source.id,
    sourceCandidateIds: [source.id],
    status: 'discovered',
  };
}

export function resolveEffectiveProcessCandidates(
  sources: EffectiveProcessCandidateSource[],
  corrections: EffectiveProcessCandidateCorrection[],
) {
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const claimed = new Set<string>();
  const effective: EffectiveProcessCandidate[] = [];
  const rejectedSourceCandidateIds: string[] = [];
  const newestFirst = [...corrections].sort(
    (left, right) =>
      right.createdAt.localeCompare(left.createdAt) ||
      right.id.localeCompare(left.id),
  );
  const statusBySource = new Map<
    string,
    Extract<
      EffectiveProcessCandidateCorrection['correctionType'],
      'confirm' | 'reject'
    >
  >();
  for (const correction of newestFirst) {
    if (
      correction.correctionType !== 'confirm' &&
      correction.correctionType !== 'reject'
    )
      continue;
    for (const sourceId of correction.sourceCandidateIds)
      if (!statusBySource.has(sourceId))
        statusBySource.set(sourceId, correction.correctionType);
  }
  for (const correction of newestFirst) {
    if (
      correction.correctionType === 'confirm' ||
      correction.correctionType === 'reject'
    )
      continue;
    const correctionSources = correction.sourceCandidateIds
      .map((id) => sourceById.get(id))
      .filter((source): source is EffectiveProcessCandidateSource =>
        Boolean(source),
      );
    if (
      correctionSources.length !== correction.sourceCandidateIds.length ||
      correctionSources.some((source) => claimed.has(source.id))
    )
      continue;
    correctionSources.forEach((source) => claimed.add(source.id));
    if (
      correctionSources.some(
        (source) => statusBySource.get(source.id) === 'reject',
      )
    ) {
      rejectedSourceCandidateIds.push(
        ...correctionSources.map((source) => source.id),
      );
      continue;
    }
    const shared = {
      apparentOutcome: correctionSources
        .map((source) => source.apparentOutcome)
        .join(' / '),
      confidence: Math.min(
        ...correctionSources.map((source) => source.confidence),
      ),
      correctionId: correction.id,
      participatingSystems: [
        ...new Set(
          correctionSources.flatMap((source) => source.participatingSystems),
        ),
      ].sort(),
      sourceCandidateIds: correctionSources.map((source) => source.id),
      status: correctionSources.every(
        (source) => statusBySource.get(source.id) === 'confirm',
      )
        ? ('confirmed' as const)
        : ('discovered' as const),
    };
    const allInstanceIds = correctionSources.flatMap(
      (source) => source.instanceIds,
    );
    if (correction.correctionType === 'split') {
      const selected = new Set(correction.selectedProcessInstanceIds);
      const first = allInstanceIds.filter((id) => !selected.has(id));
      const second = allInstanceIds.filter((id) => selected.has(id));
      if (first.length === 0 || second.length === 0) continue;
      effective.push(
        {
          ...shared,
          effectiveId: `${correction.id}:1`,
          instanceIds: first,
          neutralLabel: correction.replacementLabels[0]!,
        },
        {
          ...shared,
          effectiveId: `${correction.id}:2`,
          instanceIds: second,
          neutralLabel: correction.replacementLabels[1]!,
        },
      );
    } else {
      effective.push({
        ...shared,
        effectiveId: `${correction.id}:1`,
        instanceIds: allInstanceIds,
        neutralLabel:
          correction.replacementLabels[0] ?? correctionSources[0]!.neutralLabel,
      });
    }
  }
  for (const source of sources.filter(
    (candidate) => !claimed.has(candidate.id),
  )) {
    const status = statusBySource.get(source.id);
    if (status === 'reject') rejectedSourceCandidateIds.push(source.id);
    else
      effective.push({
        ...fromSource(source),
        status: status === 'confirm' ? 'confirmed' : 'discovered',
      });
  }
  return {
    candidates: effective.sort((left, right) =>
      left.effectiveId.localeCompare(right.effectiveId),
    ),
    rejectedSourceCandidateIds: rejectedSourceCandidateIds.sort(),
  };
}
