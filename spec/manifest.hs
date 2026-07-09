{-# LANGUAGE DataKinds       #-}
{-# LANGUAGE GADTs           #-}
{-# LANGUAGE KindSignatures  #-}

-- | Type-level manifest of rdf-cli.
--
-- This is a /signature-level/ spec, not compiled code. It mirrors @src/@ so the
-- whole system can be reviewed through Haskell's types. It is the executable-looking
-- companion to @spec/rdf-cli semantics.md@ and @spec/stream-algebra.md@.
--
-- Conventions used to map the JavaScript onto types:
--
--   * @IO a@            — touches the filesystem, stdin, or stdout.
--   * @Either Error a@  — the JS implementation @throw@s on this path.
--   * @Maybe a@         — the JS returns @null@ / @undefined@ on this path.
--   * @IO a@ that "never returns" — the JS calls @process.exit@ (noted inline).
--   * @Stream a@        — an async, single-pass sequence (a Node @Readable@ in object
--                         mode, or an async generator). Produced lazily, consumed once.
--
-- Graph policy, in one line: a 'Quad' always carries a graph term; 'DefaultGraph'
-- means "graphless", and nothing turns graphless into named implicitly.

module RdfCli.Manifest where

--------------------------------------------------------------------------------
-- RDF core (the RDF/JS data model, as provided by rdf-ext)
--------------------------------------------------------------------------------

type Iri      = String
type Lexical  = String
type LangTag  = String
type Datatype = Iri

data Term
  = NamedNode    Iri
  | BlankNode    String
  | Literal      Lexical (Maybe LangTag) Datatype
  | DefaultGraph                            -- ^ the "no graph" graph term

-- | Positional roles are not enforced at the type level here, but the intent is:
-- subject ∈ {NamedNode, BlankNode}, predicate ∈ {NamedNode},
-- object ∈ {NamedNode, BlankNode, Literal}, graph ∈ {NamedNode, BlankNode, DefaultGraph}.
data Quad = Quad
  { subject   :: Term
  , predicate :: Term
  , object    :: Term
  , graph     :: Term
  }

data Dataset     -- ^ @rdf.dataset()@: an in-memory, de-duplicated set of quads.
data Store       -- ^ oxigraph in-memory triplestore (opaque; the SPARQL engine).

type Error = String

--------------------------------------------------------------------------------
-- Stream carriers (what actually flows over a Unix pipe)
--------------------------------------------------------------------------------

data Stream a    -- ^ async, single-pass sequence.

type QuadStream     = Stream Quad       -- ^ the "dataset stream"; wire encoding = N-Quads.
type BindingsStream = Stream Row        -- ^ SPARQL SELECT results.
type PathStream     = Stream FilePath   -- ^ one path per line.
type Row            = [(Var, Term)]     -- ^ one SELECT solution.
type Var            = String
type Line           = String
type Byte           = Int

-- | The closed set of stream kinds the CLI tags each command with (the @io@
-- metadata in every command module, surfaced by @scripts/manifest.js@).
data StreamKind
  = RDF                 -- ^ serialized RDF /bytes/, any supported media type (read's stdin).
  | NQuads              -- ^ the normalized dataset stream on the wire.
  | JSONLinesBindings   -- ^ select's output: one JSON object per line.
  | Text                -- ^ a sink's human/text output.
  | PathLines           -- ^ one file path per line (from-paths' stdin).

--------------------------------------------------------------------------------
-- Formats  (src/formats.js)
--------------------------------------------------------------------------------

type MimeType = String
type Token    = String   -- ^ a user-facing format token, e.g. "ttl", "nq", "trig".
type Sample   = String   -- ^ leading bytes of an input, decoded as text.

nquads, ntriples, turtle, trig :: MimeType

-- | Token (case-insensitive) → MIME type; unknown tokens pass through unchanged.
resolveFormat :: Maybe Token -> Maybe MimeType
-- | By file extension.
guessMimeType :: FilePath -> Maybe MimeType
-- | Content sniffing over the first ~500 bytes (Turtle/JSON-LD/RDF-XML/TriG/N-Quads/N-Triples).
detectFormat  :: Sample -> Maybe MimeType

--------------------------------------------------------------------------------
-- Sources  (src/sources)
--------------------------------------------------------------------------------

data GraphFrom = Path       -- ^ the only accepted @--graph-from@ value.

data ReadOpts = ReadOpts
  { graphFrom :: Maybe GraphFrom                 -- ^ Just Path ⇒ default graph := file:// IRI.
  , onError   :: Maybe (FilePath -> Error -> IO ())
  }

-- | Parse one file into quads. @throw@s when the format cannot be resolved.
streamFileQuads :: FilePath -> Maybe MimeType -> Either Error QuadStream

-- | Parse each path independently; per-file failures go to 'onError', the rest continue.
readFromPaths :: PathStream -> ReadOpts -> QuadStream
-- | Expand globs, then 'readFromPaths'.
readFromGlob  :: [Pattern] -> ReadOpts -> QuadStream
type Pattern = String

-- | Read RDF bytes from stdin. With a hint, stream directly; without, buffer and
-- 'detectFormat'. Calls @process.exit 1@ when the format cannot be detected.
readFromStdin :: Maybe MimeType -> IO QuadStream

--------------------------------------------------------------------------------
-- Transforms  (src/transforms) — dataset → dataset unless noted
--------------------------------------------------------------------------------

type Pipe a b = Stream a -> Stream b
type QuadPipe = Pipe Quad Quad

assignGraph :: Iri -> QuadPipe      -- ^ graphless → the named graph; existing graphs kept.
dropGraph   :: QuadPipe             -- ^ every graph term → DefaultGraph.
skolemize   :: Iri -> QuadPipe      -- ^ blank nodes → stable IRIs under a base IRI.

type Query = String

-- SPARQL: materialization is its own step, so one Store feeds many query ops
-- instead of each op re-draining the source. Store-level ops are pure over the
-- store (oxigraph queries run synchronously).
materialize :: QuadStream -> IO Store           -- ^ drains the stream into a store.
select      :: Store -> Query -> BindingsStream -- ^ leaves RDF space.
construct   :: Store -> Query -> QuadStream      -- ^ output graphless (engine can't emit graphs).

-- SHACL validation.
type BuiltinName = String    -- ^ "shacl" | "skos".
type ShapeSource = Pattern

data Report                  -- ^ shacl-engine validation report (opaque).

data ValidationResult = ValidationResult
  { stream   :: QuadStream   -- ^ original data ++ the report in a named graph.
  , conforms :: Bool
  , report   :: Report
  }

resolveBuiltinShapes :: BuiltinName -> Maybe FilePath
-- | Consumes the same 'Store' (the shacl dataset is derived from it), so validation
-- composes with the SPARQL ops over a single materialization. Costs a transient
-- second copy while shacl-engine runs.
validate :: Store -> [ShapeSource] -> Iri {- reportGraph -} -> IO ValidationResult

data Violation = Violation
  { focusNode        :: String
  , path             :: String
  , severity         :: String
  , sourceConstraint :: String
  , message          :: String
  , value            :: String
  }

data Summary = Summary
  { summaryConforms  :: Bool
  , violationCount   :: Int
  , results          :: [Violation]
  }

summarizeReport      :: Report -> Summary
formatMarkdownReport :: Summary -> String {- label -} -> Text
type Text = String

--------------------------------------------------------------------------------
-- Sinks  (src/sinks) — terminal effects: bytes/text to stdout
--------------------------------------------------------------------------------

toReadable      :: Stream a -> Stream a          -- ^ idempotent coercion to a Readable.
writeQuads      :: QuadStream -> MimeType -> IO ()          -- ^ default MimeType = nquads.

loadPrefixes    :: Maybe FilePath -> IO Prefixes           -- ^ discovers .prefixes.json / prefixes.json.
datasetToString :: Dataset -> MimeType -> Prefixes -> IO Text
-- | Default format = trig. nquads/ntriples delegate to 'writeQuads' (ntriples drops graphs).
writePretty     :: QuadStream -> MimeType -> Prefixes -> IO ()

bindingToJSONL  :: Row -> Text
writeBindings   :: BindingsStream -> IO ()

data TableFormat = CSV | TSV | JSONL
writeTable      :: Stream Line -> TableFormat -> IO ()

type Prefixes = [(Prefix, Iri)]
type Prefix   = String

--------------------------------------------------------------------------------
-- Utils  (src/utils.js)
--------------------------------------------------------------------------------

collectDataset :: QuadStream -> IO Dataset
readLines      :: Stream Byte -> Stream Line     -- ^ trimmed, non-empty lines.

--------------------------------------------------------------------------------
-- The CLI as a typed stream algebra  (spec/stream-algebra.md, made checkable)
--
-- Each verb is indexed by the stream kind it consumes and the kind it produces.
-- Composition typechecks only when adjacent wire kinds agree — that is the whole
-- point of the "N-Quads between transforms" rule.
--------------------------------------------------------------------------------

data Cmd (i :: StreamKind) (o :: StreamKind) where
  Read        :: Cmd 'RDF        'NQuads              -- ^ or file args → NQuads (bytes-in variant).
  FromPaths   :: Cmd 'PathLines  'NQuads
  Select      :: Query -> Cmd 'NQuads 'JSONLinesBindings
  Construct   :: Query -> Cmd 'NQuads 'NQuads
  Validate    :: Cmd 'NQuads 'NQuads                  -- ^ exit code 1 on non-conformance.
  GraphAssign :: Iri -> Cmd 'NQuads 'NQuads
  GraphDrop   :: Cmd 'NQuads 'NQuads
  Skolem      :: Cmd 'NQuads 'NQuads
  Pretty      :: Cmd 'NQuads 'Text
  Table       :: Cmd 'JSONLinesBindings 'Text

-- | A pipeline is a chain of commands whose wire kinds line up end to end.
data Pipeline (i :: StreamKind) (o :: StreamKind) where
  Last :: Cmd i o -> Pipeline i o
  (:|) :: Cmd i m -> Pipeline m o -> Pipeline i o
infixr 5 :|

-- Well-typed:   Read :| Select q :| Last Table        :: Pipeline 'RDF 'Text
-- Ill-typed:    Read :| Last Table   -- NQuads ≠ JSONLinesBindings, rejected.

--------------------------------------------------------------------------------
-- Operations & provenance  (proposed — the composable, lineage-tracking layer)
--
-- The 'Cmd' algebra above is the user-facing CLI projection. Underneath, each step
-- is an 'Op': a node in a DAG. Running the DAG yields BOTH the final value and one
-- 'OpResult' per node — the provenance array the caller asked for.
--
-- The key invariant ties this layer to 'materialize': a 'QuadStream' is single-pass,
-- so any node consumed by more than one downstream node MUST be a 'Store' (multi-read).
-- Fan-out in the DAG therefore lands exactly on materialization points — extracting
-- the store is what makes a branching provenance DAG expressible in the first place.
--------------------------------------------------------------------------------

type OpId = String

-- | The value carried on an edge between operations.
data Value
  = VQuads    QuadStream     -- ^ single-pass: at most one consumer.
  | VStore    Store          -- ^ multi-read: the legal fan-out / branch point.
  | VBindings BindingsStream -- ^ single-pass.
  | VReport   Report
  | VText     Text

-- | What each operation does. Extensible: a new transform is one more constructor,
-- and it composes with the rest for free because it shares the 'Value' vocabulary.
data Op
  = OpReadPaths   [Pattern] ReadOpts
  | OpReadStdin
  | OpFromPaths   ReadOpts
  | OpMaterialize                       -- ^ QuadStream -> Store; the branch enabler.
  | OpSelect      Query
  | OpConstruct   Query
  | OpValidate    [ShapeSource] Iri
  | OpAssignGraph Iri
  | OpDropGraph
  | OpSkolem      Iri
  | OpPretty      MimeType Prefixes
  | OpTable       TableFormat

-- | A node: an operation applied to the outputs of its input nodes.
data Node = Node
  { nodeId :: OpId
  , op     :: Op
  , inputs :: [OpId]      -- ^ references to other nodes, forming the DAG.
  }

data Dag = Dag
  { nodes  :: [Node]
  , output :: OpId        -- ^ the node whose 'Value' is the pipeline result.
  }

-- | Per-node provenance: what ran, over what, what came out, and measured facts.
data OpResult = OpResult
  { resultId :: OpId
  , resultOp :: Op
  , usedIds  :: [OpId]    -- ^ prov:used (its input nodes).
  , produced :: Value     -- ^ prov:generated.
  , meta     :: Meta
  }

-- | Measured facts kept in lineage. Grows independently of 'Op'.
data Meta = Meta
  { startedAt     :: Timestamp
  , durationMs    :: Int
  , quadsIn       :: Maybe Int
  , quadsOut      :: Maybe Int
  , droppedIn     :: Maybe Int    -- ^ quads oxigraph refused (the materialize warning).
  , metaConforms  :: Maybe Bool   -- ^ validate only.
  }
type Timestamp = String

-- | Execute the DAG as a topological fold. The in-memory 'OpResult' array is the
-- runtime source of truth; the final 'Value' is the 'output' node's product.
run :: Dag -> IO (Value, [OpResult])

-- | Render provenance to PROV-O RDF on demand (opt-in, off the hot path):
--   OpResult  -> prov:Activity  (prov:startedAtTime, durationMs/counts as typed literals)
--   usedIds   -> prov:used
--   produced  -> prov:generated (a prov:Entity)
--   input→output edges -> prov:wasDerivedFrom
provenanceToDataset :: [OpResult] -> Dataset

--------------------------------------------------------------------------------
-- Public library surface  (src/index.js)
--
--   import { sources, transforms, sinks } from 'rdf-cli'
--
-- Only these three namespaces are exported; command modules stay internal.
--------------------------------------------------------------------------------
