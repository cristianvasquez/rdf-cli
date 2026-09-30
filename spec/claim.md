---
uuid: ecf2782d-2017-49d7-8b40-a86ee9a14a7e
repo-group: rdf
tldr: design rationale for `rdf claim`.
tags: [spec/rdf]
---

# Claimers: the pipe is the cascade

Types and laws: `Claimers` section of [`manifest.hs`](manifest.hs). This note gives the reasons.

A claimer is one claim (SHACL shapes: "these are the quads I read") plus a fan-out of named views (CONSTRUCTs over the claimed quads only). One document defines one claimer, and `rdf claim` applies one claimer per process — so a cascade of claimers is just a pipe, and precedence is pipe order. There is no order metadata anywhere.

What makes this sound is that claimed-vs-rest is marked by the graph term itself, reusing the graph policy (see the readme rules):

- the working set is the **graphless** subset of the incoming stream;
- claiming moves **owned** quads (the ones a constraint read) out of graphless space — they land in the claimer's `:source` graph (provenance), and each view's output lands in the view's own graph;
- a claim also **borrows** a frontier: the quads its target navigation read (e.g. `rdf:type` for `sh:targetClass`). The frontier feeds the views but stays graphless in the rest — shared navigation vocabulary never starves later claimers targeting the same class. Copies land in the `:frontier` graph, so `:source` ∪ `:frontier` is exactly what the views were fed. A shape that wants to *own* its target quads says so with an explicit constraint (e.g. `[ sh:path rdf:type ]`);
- the rest stays graphless, still claimable by the next claimer;
- quads that already carry a named graph were claimed upstream and pass through untouched.

So "a later claimer cannot take an earlier claimer's quads" is not a runtime check — it is impossible by construction, and any intermediate wire can be inspected to see exactly what is claimed and by whom. Making named data claimable is explicit, like every other graph-policy change: pipe `rdf map -g default` first.

```bash
rdf read ./data/**/*.ttl \
  | rdf claim ./claimers/person.trig \
  | rdf claim ./claimers/organization.trig \
  | rdf pretty --format trig
```

### Two ways to put CONSTRUCTs together

The cascade above and a view's own queries are different operations, and the difference is which one *sees* the other's output:

| | reads | order | use it for |
|---|---|---|---|
| cascade of claimers | the graphless rest left by the previous claimer | pipe order decides **ownership** precedence | several claimers competing for one wire |
| fan-out across views | the same claimed feed, always | none — views commute | independent aspects of one claim |
| chain within a view | only the previous step's output | significant | deriving something, then using it |

A view declares a chain with `cascade:queries`, an RDF list — order matters, and a list is the only ordered structure RDF offers:

```turtle
<urn:example:view/diagram> cascade:queries (
  "CONSTRUCT { ?s ?p ?o . ?t ex:short ?curie } WHERE { ... }"
  "CONSTRUCT { ... } WHERE { ... ?t ex:short ?curie ... }"
) .
```

Step n+1 sees **only** step n's output, so a step that wants to keep its input re-emits it — that is why the first query above constructs `?s ?p ?o` as well as the fact it derives.

Reach for the chain when a rule would otherwise be repeated at every site that needs it. Reach for the cascade only when ownership actually changes hands: a second claimer re-runs the claim, which is wasted work if the same quads are simply being read again.
