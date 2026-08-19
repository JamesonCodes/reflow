# Future embedding support

Reflow intentionally begins with deterministic evidence signatures and ordered
sequence similarity. Browser observations already provide structured signals
such as approved systems, normalized paths, action types, element roles,
semantic input tokens, and generalized labels. Keeping the initial clustering
pipeline deterministic makes its results reproducible, explainable, and easy to
trace back to source observations.

## When embeddings would help

Embedding-assisted clustering should be considered only when benchmark traces
show that deterministic matching produces unacceptable false splits, such as:

- different systems expressing the same task with unrelated paths and labels;
- departments using different terminology for equivalent work;
- UI redesigns changing surface-level evidence while preserving task meaning;
- recurring tasks being fragmented into many near-duplicate clusters.

Embeddings should not replace sequence evidence or become the sole source of a
cluster identity. They would act as a candidate-retrieval signal, followed by
deterministic compatibility checks using systems, actions, ordering, and source
provenance. Conservative thresholds must prevent semantically similar but
operationally different tasks from being merged.

## Integration constraints

Any future implementation must:

- call embeddings through Vercel AI Gateway using `gateway.embeddingModel()`;
- configure the model with `REFLOW_EMBEDDING_MODEL`;
- record the provider-neutral model identifier, vector dimensions, and an
  embedding version with every stored vector;
- compare vectors only when their model, dimensions, and version match;
- validate the returned vector length when the worker starts;
- keep analyst corrections and original observation evidence intact;
- provide deterministic benchmark results demonstrating an improvement before
  enabling embeddings in the default pipeline.

The vector dimension should be selected alongside the future Gateway model
rather than fixed prematurely. A model change requires a new embedding version
and re-embedding; existing vectors must never be silently mixed with new ones.

## Evaluation gate

Before adding vector storage, Reflow should maintain a labeled benchmark of
equivalent and non-equivalent task pairs across systems, roles, and UI variants.
Embeddings are justified only if they materially improve recall without causing
unsafe false merges and the improvement outweighs their added cost, latency,
versioning, and operational complexity.
