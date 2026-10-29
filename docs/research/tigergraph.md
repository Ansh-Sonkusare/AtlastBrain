# TigerGraph Community Edition 4.2.x (image `tigergraph/community:4.2.5`): vector search + graph traversal

Researched 2026-10-29. Sources are primary only: docs.tigergraph.com (now redirects to www.tigergraph.com/docs), the `tigergraph/ecosys` GitHub repo, and the Docker Hub registry data for the image.
Nothing here was run against a live container (another agent owns the container). Items I could not confirm are marked **UNCONFIRMED**.
Items I checked by reading the actual image layers or by doing arithmetic myself are marked **VERIFIED-BY-ME**.

Shorthand for citations:
- [DOCKER-HUB] https://hub.docker.com/r/tigergraph/community
- [VEC-REF] https://www.tigergraph.com/docs/gsql-ref/4.2/vector (same page as https://docs.tigergraph.com/gsql-ref/4.2/vector)
- [VEC-TUT] https://github.com/tigergraph/ecosys/blob/master/tutorials/VectorSearch.md
- [GSQL-EP] https://www.tigergraph.com/docs/tigergraph-server/4.2/api/gsql-endpoints
- [REST-EP] https://www.tigergraph.com/docs/tigergraph-server/4.2/api/built-in-endpoints
- [REST-INTRO] https://www.tigergraph.com/docs/tigergraph-server/4.2/api/
- [RN] https://www.tigergraph.com/docs/tigergraph-server/4.2/release-notes

---

## 1. Docker CE startup

### Exact command

The ecosys Docker README gives this command for the 4.2 Community image ([README](https://github.com/tigergraph/ecosys/blob/master/demos/guru_scripts/docker/README.md), which pins tag 4.2.0; swap in 4.2.5):

```bash
docker run -d --init -p 14240:14240 --name tigergraph tigergraph/community:4.2.5
```

Optional extras (not required for CE):
```bash
# OPTIONAL and PARTLY UNCONFIRMED: see the caveats below the block; the minimal command above is the verified one.
# UNCONFIRMED for CE: --ulimit is copied from the Enterprise-image doc.
# UNCONFIRMED path: the tg-data mount target is my guess from the install layout; drop that line if unsure.
docker run -d --init \
  -p 14240:14240 \
  -p 14022:22 \
  --ulimit nofile=1000000:1000000 \
  -v tg-data:/home/tigergraph/tigergraph/data \
  --name tigergraph tigergraph/community:4.2.5
```
- `--ulimit nofile=1000000:1000000` and `-p 14022:22` come from the Enterprise-image page ([Get Started with Docker 4.2](https://www.tigergraph.com/docs/tigergraph-server/4.2/getting-started/docker)). That page is for `tigergraph/tigergraph`, not `community`. Whether CE needs the ulimit is **UNCONFIRMED**.
- The `-v tg-data:...` data path is my guess from the install layout (`/home/tigergraph/tigergraph/...`). The Enterprise page mounts `-v tg-data:/home/tigergraph`. Whether CE data persists across `docker rm` is **UNCONFIRMED**.
- Tag 4.2.5 exists. Last pushed 2026-09-01 per the Docker Hub API (https://hub.docker.com/v2/repositories/tigergraph/community/tags?name=4.2). Image is amd64 only (registry config, VERIFIED-BY-ME). The Docker page says "TigerGraph on Docker is not supported for ARM processors".

### Do services start automatically? YES in 4.2.5 (VERIFIED-BY-ME)

I downloaded the small image layers from the Docker registry (no `docker run`) and read the entrypoint. Registry manifest: `https://registry-1.docker.io/v2/tigergraph/community/manifests/4.2.5`.

```
ENTRYPOINT ["/bin/sh","-c","bash -c /home/tigergraph/entrypoint.sh"]   # USER tigergraph, WORKDIR /home/tigergraph
# entrypoint.sh (last lines)
sudo /usr/sbin/sshd -h /home/tigergraph/.ssh/sshd_rsa
/home/tigergraph/tigergraph/app/cmd/gadmin start all
tail -f /dev/null
```
- So `gadmin start all` runs on every container start. No manual start is needed on this tag.
- The docs still say "If you are using Docker ... you must run `gadmin start all` after starting the Docker container" ([manage-services 4.2](https://www.tigergraph.com/docs/tigergraph-server/4.2/system-management/manage-services)) and the ecosys README still lists `gadmin start all` as a step. That is stale for the 4.2.5 image. Running it again is harmless.
- Image sets Linux user `tigergraph` with password `tigergraph` (build step `echo 'tigergraph:tigergraph' | chpasswd`, VERIFIED-BY-ME in the registry config history).
- The image `EXPOSE`s only 22. You must publish 14240 yourself.

Check state from the host or inside the container:
```bash
docker exec -it tigergraph /home/tigergraph/tigergraph/app/cmd/gadmin status   # all services should be Online
curl -s http://localhost:14240/api/ping    # {"error":"false","message":"pong","results":{}}  (no auth)
```
`GET /api/ping` is documented as "listens on port 14240 and does not require authentication" ([REST-EP](https://www.tigergraph.com/docs/tigergraph-server/4.2/api/built-in-endpoints)). The `gadmin` full path comes from my layer read. The image's own `run_demo.sh` exports `/home/tigergraph/tigergraph/app/cmd/` onto PATH before calling `gsql`, which suggests `gsql` and `gadmin` are not on PATH in a non-login `docker exec` (inference, **UNCONFIRMED**). Container owner: use the full path, or `docker exec tigergraph bash -lc 'gadmin status'`.

### Credentials and ports
- Default DB user / password: `tigergraph` / `tigergraph` ([VEC-TUT](https://github.com/tigergraph/ecosys/blob/master/tutorials/VectorSearch.md): "user is `tigergraph`, password is `tigergraph`"). GraphStudio is at http://localhost:14240.
- Port 14240 is the single entry point (nginx). It serves GraphStudio, `/gsql/...` (GSQL server) and `/restpp/...` (RESTPP). Docs: "For self-installed systems, send requests to the NGINX proxy server (port 14240)" ([REST-INTRO](https://www.tigergraph.com/docs/tigergraph-server/4.2/api/)).
- Port 9000: "In 4.1.0 and later, port 9000 is no longer exposed for external access ... Port 9000 remains available for local access on the host machine" ([REST-EP](https://www.tigergraph.com/docs/tigergraph-server/4.2/api/built-in-endpoints)). Do not rely on `-p 9000:9000`. Use `/restpp/...` on 14240.

### Memory
- Vector tutorial: "8 CPUs and 20 GB of RAM or at minimum 4 CPUs and 16 GB of RAM" ([VEC-TUT](https://github.com/tigergraph/ecosys/blob/master/tutorials/VectorSearch.md)).
- General Docker page: recommended 8 cores / 24 GB; minimum 4 cores / 8 GB ([Docker 4.2](https://www.tigergraph.com/docs/tigergraph-server/4.2/getting-started/docker)). The two docs conflict. For vector work, plan on 16 GB or more.
- WSL2 note (my inference): the default WSL2 memory cap is half of host RAM. Set `memory=` in `.wslconfig` if the host has under 32 GB.

### Startup time
- Docs: `gadmin start all` "may take up to one minute" ([Docker 4.2](https://www.tigergraph.com/docs/tigergraph-server/4.2/getting-started/docker)). Vector tutorial: loading from S3 "wait 2 minutes" (that is load time, not boot).
- Measured boot time on 4.2.5: **UNCONFIRMED** (not run). Poll `/api/ping` and then `gadmin status`. Do not assume ping alone means GSQL is ready; also poll a real call such as `POST /gsql/v1/statements` with `ls`.

---

## 2. Schema DDL: vertex with a vector attribute

### Exact syntax
From [VEC-REF](https://www.tigergraph.com/docs/gsql-ref/4.2/vector):

```
ALTER VERTEX vertex_name ADD VECTOR ATTRIBUTE vec_name(vertex_params);

where vertex_params =
    DIMENSION=dim,
    METRIC=metr
    [, INDEXTYPE=i_type]
    [, DATATYPE=d_type]

ALTER VERTEX vertex_name DROP VECTOR ATTRIBUTE vec_name;
```

| Param | Values (per VEC-REF) |
|---|---|
| DIMENSION | INT 1..4096 (Community). Table text; the spec table says Enterprise allows 32768 |
| METRIC | `"COSINE"`, `"L2"`, `"IP"` (the doc table labels L2 "(Manhattan)", which looks like a doc error; L2 is Euclidean, see `gds.vector.l2_distance`) |
| INDEXTYPE | `"HNSW"` (default, the only option listed) |
| DATATYPE | `"FLOAT"` (default, the only option listed) |

- Parameter names are case-insensitive. The tutorial uses lowercase `dimension=3`.
- METRIC defaults to cosine ([VEC-TUT](https://github.com/tigergraph/ecosys/blob/master/tutorials/VectorSearch.md): "By default, the cosine metric is used"). So `ALTER VERTEX Claim ADD VECTOR ATTRIBUTE embedding(DIMENSION=384, METRIC="COSINE")` is valid form.
- It must go in a SCHEMA_CHANGE job: "A vector attribute is always added to an existing vertex type, using the ALTER VERTEX statement with a SCHEMA_CHANGE job" ([VEC-REF](https://www.tigergraph.com/docs/gsql-ref/4.2/vector)). The vertex must already exist. I found no example that creates the vertex and the vector in the same job.
- HNSW tuning params such as M / ef_construction in DDL: not documented. **UNCONFIRMED** (none listed in VEC-REF).

### Global vertex path (what the official tutorial uses)
From the tutorial DDL ([00_ddl.gsql / VEC-TUT](https://github.com/tigergraph/ecosys/blob/master/tutorials/VectorSearch.md)):
```
CREATE VERTEX Claim (id STRING PRIMARY KEY, text STRING)
CREATE GLOBAL SCHEMA_CHANGE JOB add_claim_vec {
  ALTER VERTEX Claim ADD VECTOR ATTRIBUTE embedding(DIMENSION=384, METRIC="COSINE");
}
RUN GLOBAL SCHEMA_CHANGE JOB add_claim_vec
CREATE GRAPH MyGraph (*)
```
(Claim and column names are mine; the pattern is from the tutorial.)

### Local graph path (graph owns its own vertex types)
From [VEC-TUT](https://github.com/tigergraph/ecosys/blob/master/tutorials/VectorSearch.md), "Global and Local Schema Change":
```
USE GLOBAL
CREATE GRAPH MyGraph()
USE GRAPH MyGraph
CREATE SCHEMA_CHANGE JOB add_v FOR GRAPH MyGraph {
  ADD VERTEX Claim (id STRING PRIMARY KEY, text STRING);
  ADD DIRECTED EDGE supports (FROM Claim, TO Claim);
}
RUN SCHEMA_CHANGE JOB add_v
CREATE SCHEMA_CHANGE JOB add_vec FOR GRAPH MyGraph {
  ALTER VERTEX Claim ADD VECTOR ATTRIBUTE embedding(DIMENSION=384, METRIC="COSINE");
}
RUN SCHEMA_CHANGE JOB add_vec
```
- The tutorial shows the vertex creation and the vector `ALTER` as two separate jobs. Combining them is **UNCONFIRMED**.
- Global vs local: both work. Global vertex types "can only be modified from the global scope" ([VEC-TUT](https://github.com/tigergraph/ecosys/blob/master/tutorials/VectorSearch.md)). For a single-app hackathon, a local graph is simpler.
- Gotcha: schema changes reinstall all affected queries. Use `RUN SCHEMA_CHANGE JOB x -N` (or `RUN GLOBAL SCHEMA_CHANGE JOB x -N`) to skip reinstall, then reinstall by hand ([modify schema 4.2](https://www.tigergraph.com/docs/gsql-ref/4.2/ddl-and-loading/modifying-a-graph-schema)). VEC-REF also says "Use the -N option when you run a schema change job to modify vector attributes."
- Schema DDL over HTTP: there is also `POST /gsql/v1/schema/jobs/{jobName}?gsql=true&type=global` to create a job and `POST /gsql/v1/schema/change` ([GSQL-EP](https://www.tigergraph.com/docs/tigergraph-server/4.2/api/gsql-endpoints)). Whether the JSON schema-change body supports vector attributes is **UNCONFIRMED**. Safer: send raw GSQL via `POST /gsql/v1/statements` (section 6).

---

## 3. Loading vectors

### A. RESTPP JSON upsert: WORKS in 4.2, vector is a JSON list
From [VEC-REF](https://www.tigergraph.com/docs/gsql-ref/4.2/vector) and [VEC-TUT](https://github.com/tigergraph/ecosys/blob/master/tutorials/VectorSearch.md):

```bash
curl -X POST "http://localhost:14240/restpp/graph/MyGraph" -d '
{
  "vertices": {
    "Claim": {
      "c1": {
        "text":      { "value": "hello" },
        "embedding": { "value": [0.01, -0.02, 0.03] }
      }
    }
  }
}'
```
- The vector goes in as `"<vec_attr>": {"value": [floats...]}` in the same JSON object as normal attributes. Docs: "The upsert data for a vertex can include zero or more standard attributes and zero or more standard vector attributes, in the same JSON structure."
- Silent failure: "if the specified vector attribute does not exist, TigerGraph will not return an error. Double-check attribute names" ([VEC-REF](https://www.tigergraph.com/docs/gsql-ref/4.2/vector)). After loading, query a vertex with `PRINT v WITH VECTOR` to confirm.
- Edges go in the same payload under `"edges"` (standard upsert format, [upsert-rest](https://www.tigergraph.com/docs/tigergraph-server/4.2/api/upsert-rest)). Max request body size and recommended batch size for 384-dim vectors: **UNCONFIRMED**.
- Vector attribute values can be sent with no auth on a default CE install (RESTPP auth is off by default; see section 6).

### B. Loading job with SPLIT: also works in 4.2
```
CREATE LOADING JOB load_emb FOR GRAPH MyGraph {
  DEFINE FILENAME file1;
  LOAD file1 TO VERTEX Claim VALUES ($1, $2) USING SEPARATOR="|";
  LOAD file1 TO VECTOR ATTRIBUTE embedding ON VERTEX Claim VALUES ($1, SPLIT($3, ",")) USING SEPARATOR="|", HEADER="false";
}
```
(Pattern from [VEC-TUT](https://github.com/tigergraph/ecosys/blob/master/tutorials/VectorSearch.md) "Create Loading Job".)
- Clause shape: `LOAD file_object TO VECTOR ATTRIBUTE vec_name ON VERTEX vertex_name VALUES (id_col, SPLIT(vec_col, elem_sep)) USING SEPARATOR = field_sep;` ([VEC-REF](https://www.tigergraph.com/docs/gsql-ref/4.2/vector)).
- Use `|` as the field separator because the vector elements are comma-separated.
- Brackets in the data. Three facts: (1) VEC-REF says nested token functions fail to compile: `SPLIT(gsql_replace(gsql_replace($3,"[",""),"]","")) will fail to compile`. (2) The tutorial ([VEC-TUT](https://github.com/tigergraph/ecosys/blob/master/tutorials/VectorSearch.md), "Create Loading Job") shows that same nested form anyway. (3) So the docs conflict. Strip the brackets in your own code before loading.
- Run over HTTP: `POST /restpp/ddl/{graph}?tag={job}&filename={file_var}&sep=|` with `--data-binary @file` ([VEC-TUT](https://github.com/tigergraph/ecosys/blob/master/tutorials/VectorSearch.md)).

### Which to use
Both work. For a hackathon app, RESTPP JSON upsert is the shortest path and needs no loading job. Use it in batches. Use a loading job only for bulk files.

---

## 4. `vectorSearch()` in GSQL

### Signature ([VEC-REF](https://www.tigergraph.com/docs/gsql-ref/4.2/vector))
```
result = vectorSearch(vectorAttributes, queryVector, k, optionalParam)
```
| Arg | Meaning |
|---|---|
| `vectorAttributes` | Set of `VertexType.VectorName`, e.g. `{Account.emb1, Phone.emb1}` |
| `queryVector` | Query vector: a `LIST<FLOAT>` query parameter or a `ListAccum<FLOAT>` |
| `k` | Top-k count (INT; the tutorial passes a query param `int k`) |
| `optionalParam` | Map: `{candidate_set: vset, ef: 20, distance_map: @@distmap}` |

- `candidate_set` is a vertex set variable; `ef` is the HNSW exploration factor; `distance_map` is a **global** `MapAccum<Vertex, Float>` that receives the top-k (vertex, distance) pairs.
- `ef` default and valid range: **UNCONFIRMED** (not documented). If `ef` < `k`, results may be fewer than `k` (my inference from HNSW; not from the docs).
- The result is a vertex set, not vectors. Use `PRINT v WITH VECTOR;` to see embeddings.
- Queries that use it are written `SYNTAX v3`.

### Basic top-k ([03_q1.gsql](https://raw.githubusercontent.com/tigergraph/ecosys/master/tutorials/vector/03_q1.gsql))
```
CREATE OR REPLACE QUERY q1 (LIST<float> query_vector) SYNTAX v3 {
  MapAccum<Vertex, Float> @@distances;
  v = vectorSearch({Account.emb1}, query_vector, 5, { distance_map: @@distances});
  print v WITH VECTOR;
  print @@distances;
}
```

### Can a traversal result be the filter? YES
The tutorial does this in q4 ([09_q4.gsql](https://raw.githubusercontent.com/tigergraph/ecosys/master/tutorials/vector/09_q4.gsql)): a pattern match builds a vertex set, then `candidate_set` restricts the ANN search to it.
```
CREATE OR REPLACE QUERY q4 (datetime low, datetime high, LIST<float> query_vector) SYNTAX v3 {
  MapAccum<Vertex, Float> @@distances1;
  MapAccum<Vertex, Float> @@distances2;
  c1 = SELECT b
       FROM (a:Account {name: "Scott"})-[e:transfer]->()-[e2:transfer]->(b:Account)
       WHERE e.date >= low AND e.date <= high and e.amount >500 and e2.amount>500;
  v = vectorSearch({Account.emb1}, query_vector, 2, {candidate_set: c1, distance_map: @@distances1});
  PRINT v WITH VECTOR;
  PRINT @@distances1;
  c2 = SELECT b
       FROM (a:Account {name: "Scott"})-[:transfer*1..]->(b:Account)
       WHERE a.name != b.name;
  v = vectorSearch({Account.emb1}, query_vector, 2, {candidate_set: c2, distance_map: @@distances2});
  PRINT v WITH VECTOR;
  PRINT @@distances2;
}
```
- A vertex set from a `SET<VERTEX<T>>` parameter also works: `v = {slist}; v = vectorSearch({Account.emb1}, query_vector, 1, {candidate_set: v});` ([06_q1c.gsql](https://raw.githubusercontent.com/tigergraph/ecosys/master/tutorials/vector/06_q1c.gsql)).
- Reverse pattern, vector search first and then traverse from the hits ([13_q6.gsql](https://raw.githubusercontent.com/tigergraph/ecosys/master/tutorials/vector/13_q6.gsql)):
```
CREATE OR REPLACE QUERY q6 (LIST<float> query_vector) SYNTAX v3 {
  R = vectorSearch({Account.emb1}, query_vector, 3);
  V = SELECT b FROM (a:R)-[e:transfer]->()-[e2:transfer]->(b:Account);
  print V;
}
```
- Optional-filter pattern from TigerGraph's own hybrid-search demo (`IF set_candidate.size() > 0 THEN ... vectorSearch(..., candidate_set: Candidates) ELSE ... vectorSearch(...)`): [api_search_Song_emb_1.gsql](https://github.com/tigergraph/ecosys/blob/master/demos/hybrid_search/demo/gsql/queries/api_search_Song_emb_1.gsql). Use this if a candidate set can be empty (an empty candidate set semantic is **UNCONFIRMED**).
- Exact (non-ANN) alternative: `ORDER BY gds.vector.cosine_distance(b.emb1, query_vector) ASC LIMIT 3`, which the tutorial calls expensive ([10_q4a.gsql](https://raw.githubusercontent.com/tigergraph/ecosys/master/tutorials/vector/10_q4a.gsql)). Needs `import package gds` and `install function gds.**` first.
- Whether the candidate filter is applied before or after the ANN walk (i.e. whether you always get k hits when the candidate set has at least k members): **UNCONFIRMED**. The tutorial text says "do vector top-k search on the candidate set".

### What the COSINE distance means (VERIFIED-BY-ME)
- The docs do not define it in words. The tutorial output [q3.out](https://raw.githubusercontent.com/tigergraph/ecosys/master/tutorials/vector/q3.out) shows distance `0` for the identical vector (Scott) and `0.0325563` for Steven.
- I computed `1 - cos_sim` for the tutorial's data ([account_emb.csv](https://raw.githubusercontent.com/tigergraph/ecosys/master/tutorials/data/account_emb.csv)): Scott `[-0.017733968794345856,-0.01019224338233471,-0.016571875661611557]` vs Steven `[-0.01505514420568943,-0.016819344833493233,-0.0221870020031929]` gives `0.0325563` (cos_sim 0.96744). It matches the tool output to 6 digits.
- So: **COSINE distance = 1 - cosine similarity**. Smaller is closer. Identical gives 0, orthogonal gives 1, opposite gives 2. The 0..2 range follows from the formula; the docs do not state the range. Similarity = `1 - distance`.
- For `IP` and `L2` the distance definitions are **UNCONFIRMED** (not read). Stay on COSINE.
- Range filtering (distance threshold): `WHERE gds.vector.distance(a.emb1, query_vector, "COSINE") < threshold` ([07_q2.gsql](https://raw.githubusercontent.com/tigergraph/ecosys/master/tutorials/vector/07_q2.gsql)). Exact scan, no ANN.

### Limitations stated in VEC-REF
- Nested `ListAccum<ListAccum<float>>` inside `vectorSearch()` is not supported.
- The `+` operator on a ListAccum inside `vectorSearch()` is not supported.
- Vector attributes directly in WHERE (e.g. `WHERE P.embAttr1.size() == 0`) are "generally not supported"; use ACCUM / POST-ACCUM. Installing with `-single` avoids NPEs in this case.
- Using a vertex's own embedding as the query: gather with `POST-ACCUM @@query_vector += a.emb1;` into a `ListAccum<float>` ([05_q1b.gsql](https://raw.githubusercontent.com/tigergraph/ecosys/master/tutorials/vector/05_q1b.gsql)).

---

## 5. Index freshness

Yes. Endpoint documented in two places.

[VEC-REF](https://www.tigergraph.com/docs/gsql-ref/4.2/vector) (global status):
```bash
curl -s -X GET "http://localhost:14240/restpp/vector/status"
```
"Rebuild_processing means the index is still rebuilding. Ready_for_query means rebuild is complete."

[VEC-TUT](https://github.com/tigergraph/ecosys/blob/master/tutorials/VectorSearch.md), "Delayed Update Visibility" (scoped forms):
```
GET /restpp/vector/status/{graph_name}/{vertex_type}/{vector_name}
GET /restpp/vector/status/{graph_name}/{vertex_type}
GET /restpp/vector/status/{graph_name}/{vertex_type}/{vector_name}?verbose=true
```
```bash
curl -X GET "http://localhost:14240/restpp/vector/status/g1/v1/embAttr1"
# {"version":{"edition":"enterprise","api":"v2","schema":0},"error":false,"message":"fetched status success","results":{"NeedRebuildServers":["GPE_1#1"]},"code":"REST-0000"}
```
- Reading the output: when `results.NeedRebuildServers` is non-empty the index is behind. The tutorial sample shows only the "needs rebuild" case. The exact JSON when up to date is **UNCONFIRMED** (probably an empty list, not seen in docs). The global form's `Rebuild_processing` / `Ready_for_query` strings are from VEC-REF only. The two docs describe different output shapes, so write the poller to handle both: treat "ready" as `Ready_for_query` appearing, or `NeedRebuildServers` empty/missing.
- Behavior: "Vectors which have not yet been indexed will not be included in vector search results" and "the index can lag behind the data updates" ([VEC-REF](https://www.tigergraph.com/docs/gsql-ref/4.2/vector)). Poll this endpoint after a bulk upsert and before the first search (demo code, tests).
- Also: "If you have many vertex types, index rebuild time increases proportionally" ([VEC-REF](https://www.tigergraph.com/docs/gsql-ref/4.2/vector)). A force-rebuild endpoint `GET/POST /restpp/rebuildnow/{graph_name}` exists ([REST-EP](https://www.tigergraph.com/docs/tigergraph-server/4.2/api/built-in-endpoints)); I did not confirm it rebuilds the vector index. **UNCONFIRMED**.

---

## 6. Authentication and HTTP APIs

### Auth model on a fresh CE 4.2
- **GSQL server (`/gsql/...`)** needs user credentials. Four ways, from [REST-INTRO](https://www.tigergraph.com/docs/tigergraph-server/4.2/api/):
  - `-u user:password` (basic auth)
  - `-H 'Authorization: Bearer <JWT-token>'`
  - `-H 'Authorization: Basic <base64 user:pass>'`
  - `-H 'Authorization: GSQL-Secret <gsql-secret>'`
- **RESTPP (`/restpp/...`)** auth is optional and off unless enabled: "If authentication is enabled on the RESTPP server, a request token needs to be included" ([REST-INTRO](https://www.tigergraph.com/docs/tigergraph-server/4.2/api/)). Enable with `gadmin config set RESTPP.Factory.EnableAuth true` ([enable auth 4.2](https://www.tigergraph.com/docs/tigergraph-server/4.2/user-access/enabling-user-authentication)).
- The official tutorial calls `/restpp/graph/...` and `/restpp/query/...` with no credentials, and uses `-u "tigergraph:tigergraph"` for `/gsql/v1/...` ([VEC-TUT](https://github.com/tigergraph/ecosys/blob/master/tutorials/VectorSearch.md)). The default for a fresh CE install not requiring RESTPP auth is therefore inferred from those examples, not stated outright. **VERIFY** with one call.
- Whether `/gsql/v1/...` accepts requests with no credentials while the default password is unchanged: the docs' `POST /gsql/v1/statements` example sends none ([GSQL-EP](https://www.tigergraph.com/docs/tigergraph-server/4.2/api/gsql-endpoints)) while other examples send `-u`. Always send `-u tigergraph:tigergraph`.
- Token flow if you need it (only when RESTPP auth is on). `POST /gsql/v1/tokens` ([GSQL-EP](https://www.tigergraph.com/docs/tigergraph-server/4.2/api/gsql-endpoints)) takes payload fields `secret`, `graph`, `lifetime`. All three are marked **not required**; `lifetime` defaults to one week. The only documented example passes a secret:
```bash
curl -H 'Content-Type: application/json' -X POST 'localhost:14240/gsql/v1/tokens' -d '{"secret": "<secret>"}'
# use it:
curl -H "Authorization: Bearer <JWT>" "http://localhost:14240/restpp/query/MyGraph/q1?..."
```
  - A no-secret path (basic-auth credentials plus `{"graph":"MyGraph"}`) is likely, given that `secret` is optional. **UNTESTED.**
  - JWTs are graph-scoped: "JWT token was requested on graph level, so user will only has the access to the specific graph" ([REST-INTRO](https://www.tigergraph.com/docs/tigergraph-server/4.2/api/)). So pass `graph`.
  - A secret is created in GSQL with `CREATE SECRET` (command name from my memory of GSQL; not verified in this research). Note the older doc page "Authentication (TigerGraph 3.x)" says the old `/requesttoken` flow applies to 3.x only.

### Run GSQL statements over HTTP (no `gsql` CLI)
`POST /gsql/v1/statements` ([GSQL-EP](https://www.tigergraph.com/docs/tigergraph-server/4.2/api/gsql-endpoints)). Executes "any GSQL command", sync or async. Params: `async` (default false), `timeout` (default 0 = none).
```bash
curl -u tigergraph:tigergraph -X POST -H "content-type: text/plain" \
  "http://localhost:14240/gsql/v1/statements" -d 'ls'
# async form: add ?async=true, then
curl -u tigergraph:tigergraph "http://localhost:14240/gsql/v1/statements/{requestId}"
```
- The only documented example is `ls`. Multi-line scripts with `CREATE ... SCHEMA_CHANGE JOB ... RUN ...`, `USE GRAPH x`, or `INSTALL QUERY` in one body: **UNCONFIRMED**. pyTigerGraph's `conn.gsql("""USE GLOBAL ... CREATE GLOBAL SCHEMA_CHANGE JOB ... RUN GLOBAL SCHEMA_CHANGE JOB ... CREATE GRAPH ...""")` shows multi-statement scripts work through that client ([VEC-TUT](https://github.com/tigergraph/ecosys/blob/master/tutorials/VectorSearch.md), "Create Schema"); I believe it uses the same server endpoint but did not confirm. Test with a small script first.

### Create + install a query over HTTP (documented endpoints, [GSQL-EP](https://www.tigergraph.com/docs/tigergraph-server/4.2/api/gsql-endpoints))
```bash
# create (body is the full CREATE QUERY text)
curl -u tigergraph:tigergraph -H 'Content-Type: text/plain' -X POST \
  'http://localhost:14240/gsql/v1/queries?graph=MyGraph' -d 'CREATE OR REPLACE QUERY q1 (LIST<float> query_vector) SYNTAX v3 { ... }'
# install (async); flags: -single | -force | -legacy | -debug | -cost
curl -u tigergraph:tigergraph -X GET -H "Content-type: text/plain" \
  'http://localhost:14240/gsql/v1/queries/install?graph=MyGraph&queries=q1&flag=-single'
#   -> {"requestId":"...","message":"Successfully submitted request","startTime":"..."}
# poll
curl -u tigergraph:tigergraph 'http://localhost:14240/gsql/v1/queries/install/{requestId}'
```
- Sample install-status response says `"Request ... is running"` while running. The finished-state JSON shape: **UNCONFIRMED**.
- `queries=*` or `all` installs everything. Whether `CREATE OR REPLACE QUERY` through this POST replaces an existing query: **UNCONFIRMED** (the sample shows plain `create query`).
- Alternative that avoids the CLI: send `CREATE QUERY ...` and `INSTALL QUERY q1` through `/gsql/v1/statements` (UNCONFIRMED, see above).

### Call an installed query
Two endpoints; both documented ([REST-EP](https://www.tigergraph.com/docs/tigergraph-server/4.2/api/built-in-endpoints), [GSQL-EP](https://www.tigergraph.com/docs/tigergraph-server/4.2/api/gsql-endpoints)).

1. RESTPP, JSON body, `LIST<FLOAT>` as a JSON array. Used in the vector tutorial for q3 (`LIST<float> query_vector, int k`):
```bash
curl -X POST "http://localhost:14240/restpp/query/MyGraph/q3" \
  -d '{"query_vector":[-0.017733968794345856, -0.01019224338233471, -0.016571875661611557], "k": 2}'
```
(from [VEC-TUT](https://github.com/tigergraph/ecosys/blob/master/tutorials/VectorSearch.md)). Add `-H 'Content-Type: application/json'` to be safe. If RESTPP auth is on, add `-H "Authorization: Bearer <JWT>"`.

2. RESTPP GET: repeat the parameter in the query string; the tutorial's pyTigerGraph example builds `query_vector=0.1&query_vector=0.2&...` ([VEC-TUT](https://github.com/tigergraph/ecosys/blob/master/tutorials/VectorSearch.md), "RESTPP endpoint"). A 384-float GET URL is long (about 7 KB). Prefer POST.

3. GSQL server endpoint with a `parameters` wrapper, also from the tutorial:
```bash
curl -u "tigergraph:tigergraph" -H 'Content-Type: application/json' -X POST \
  "http://127.0.0.1:14240/gsql/v1/queries/q1?graph=MyGraph" \
  -d '{"parameters":{"query_vector":[-0.0177, -0.0101, -0.0165]}}'
```
Note the two body formats differ: RESTPP takes bare `{"param": value}`; the GSQL endpoint takes `{"parameters": {...}}` ([comparison table, GSQL-EP](https://www.tigergraph.com/docs/tigergraph-server/4.2/api/gsql-endpoints)).

- Vertex params: RESTPP POST uses `{"v":{"id":"Jenny","type":"Person"}}` or just the id when typed; `SET<VERTEX<T>>` is an array of `{"id":...}` ([REST-EP](https://www.tigergraph.com/docs/tigergraph-server/4.2/api/built-in-endpoints)).
- Response shape: `{"version":{...},"error":false,"message":"","results":[ {...one object per PRINT...} ]}` ([q3.out](https://raw.githubusercontent.com/tigergraph/ecosys/master/tutorials/vector/q3.out)). With `PRINT v WITH VECTOR`, each vertex has `v_id`, `v_type`, `attributes`, and `Embeddings: {emb1: [...]}`. `PRINT @@distances` gives `{"@@distances": {"Scott": 0, "Steven": 0.0325563}}`. Floats come back at about 8 digits.
- Query timeout: default is 16 seconds; override with the `GSQL-TIMEOUT` header ([query-operations 4.2](https://www.tigergraph.com/docs/gsql-ref/4.2/querying/query-operations)).

### Interpreted queries and vectorSearch
- Endpoint exists: `POST /gsql/v1/queries/interpret?graph=G` with `Content-Type: text/plain`, body is the full `INTERPRET QUERY (...) FOR GRAPH G { ... }` text; params go in the URL query string ([GSQL-EP](https://www.tigergraph.com/docs/tigergraph-server/4.2/api/gsql-endpoints)). The REST-EP page shows the same with `-u user:pass`.
```bash
curl -u tigergraph:tigergraph -H 'Content-Type: text/plain' -X POST \
  'http://localhost:14240/gsql/v1/queries/interpret?graph=MyGraph' \
  -d 'INTERPRET QUERY () FOR GRAPH MyGraph SYNTAX v3 { ... }'
```
- Interpret takes parameters only in the URL query string, so a 384-float vector becomes a roughly 7 KB repeated-parameter URL. That alone is a reason to use installed queries with a POST JSON body.
- Does it support `vectorSearch` in 4.2? **UNCONFIRMED.** The vector reference never mentions interpret mode, and the "Interpreted GSQL Limitations" appendix ([page](https://www.tigergraph.com/docs/gsql-ref/4.2/appendix/interpreted-gsql-limitations)) does not mention vectors. The 4.2 release notes say "Run ad hoc queries directly (non-procedural interpreted queries)" next to vector search as headline features, but that does not state they combine ([RN](https://www.tigergraph.com/docs/tigergraph-server/4.2/release-notes)). Every official vector example I read (tutorial q1 to q6) uses `CREATE QUERY` plus `install query`. Plan: install queries; treat interpret + `vectorSearch` as untested and test it once in your container.
- Interpreted queries are slower and drop some features ([query-operations 4.2](https://www.tigergraph.com/docs/gsql-ref/4.2/querying/query-operations)).

---

## 7. Gotchas with vectors in CE

Documented:
- **Dimension limit: 4096 in CE** (32768 in Enterprise) ([VEC-REF](https://www.tigergraph.com/docs/gsql-ref/4.2/vector)). 384, 768, 1536, 3072 all fit. Element type is 32-bit FLOAT only.
- **Single server only.** CE 4.2: "Up to 200GB graph data + 100GB vector data, single server only"; from 4.2.1, combined limit up to 300 GB flexibly split ([RN](https://www.tigergraph.com/docs/tigergraph-server/4.2/release-notes)). Also "Community support only".
- **Index lag.** New or updated vectors are invisible to `vectorSearch` until HNSW rebuild finishes. Poll the status endpoint (section 5). Updates also cost memory/disk: "a large volume of updates may lead to high memory and disk consumption" ([VEC-TUT](https://github.com/tigergraph/ecosys/blob/master/tutorials/VectorSearch.md)). Prefer one batch load over many small overwrites.
- **Index rebuild scales with the number of vertex types that have vectors** ([VEC-REF](https://www.tigergraph.com/docs/gsql-ref/4.2/vector)). Use as few vector-bearing vertex types as possible.
- **Silent no-error upsert on a wrong vector attribute name** (section 3).
- **Schema changes re-install all queries.** The wait grows with query count; `-N` skips it ([modify schema 4.2](https://www.tigergraph.com/docs/gsql-ref/4.2/ddl-and-loading/modifying-a-graph-schema)). Do all schema work first, then create and install queries.
- **Export may omit unindexed vectors**: "A database export may not include vectors which have not yet been indexed" ([VEC-REF](https://www.tigergraph.com/docs/gsql-ref/4.2/vector)).
- **Query constraints** (section 4): no nested ListAccum or `+` on ListAccum inside `vectorSearch`; no vector attributes in WHERE; use `-single` install if you hit NPEs.
- **`LOAD ... VECTOR` token-function nesting** (section 3).
- **GDS package**: `gds.vector.*` functions (exact distance, range filter) need `import package gds` then `install function gds.**` first ([VEC-TUT](https://github.com/tigergraph/ecosys/blob/master/tutorials/VectorSearch.md)). `vectorSearch` itself is built in.
- **Query timeout default is 16 s** (section 6).
- **Image security**: default password is public; the Docker page says the image "is not a secure environment until you change the password" and is "not covered by our Support Policy" ([Docker 4.2](https://www.tigergraph.com/docs/tigergraph-server/4.2/getting-started/docker)).
- **amd64 only**; on Apple Silicon it relies on Rosetta ([VEC-TUT](https://github.com/tigergraph/ecosys/blob/master/tutorials/VectorSearch.md)).

Not documented (UNCONFIRMED, test in your container):
- `INSTALL QUERY` time for a vector query. The only figure in the docs is a generic "Start installing queries, about 1 minute ..." message in the query-operations page, not specific to vectors. Budget about a minute per install, and install once, not per request.
- Boot time of `tigergraph/community:4.2.5` (docs say up to a minute for `gadmin start all`).
- Default `ef`, HNSW M / ef_construction, and any per-request `k` cap.
- Whether a candidate set smaller than `k`, or empty, returns fewer than `k` rows or an error.
- Behaviour when the query vector dimension differs from the schema dimension.
- `vectorSearch` inside `INTERPRET QUERY`.
- Multi-statement bodies for `POST /gsql/v1/statements`.
