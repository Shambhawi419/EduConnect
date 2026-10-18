import openai from './openai';

export const EMBED_MODEL = 'text-embedding-3-small';
// text-embedding-3 models can return shortened vectors. 512 dimensions keeps
// retrieval quality close to the full 1536 at a third of the storage.
export const EMBED_DIMS = 512;

const CHUNK_CHARS = 1800; // roughly 450 tokens per passage
const OVERLAP_CHARS = 200; // shared text between neighbours so ideas aren't cut in half
const EMBED_BATCH = 100;

// ---------- chunking ----------

function tidy(text) {
  return String(text ?? '')
    .replace(/\u0000/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Where in the combined text each page starts, so a passage can report its page.
function pageAt(starts, offset) {
  let page = 1;
  for (let i = 0; i < starts.length; i += 1) {
    if (starts[i] <= offset) page = i + 1;
    else break;
  }
  return page;
}

// Prefer to end a passage at a paragraph break, then a sentence end, then a space,
// looking only in the last 40% of the window so passages don't come out tiny.
function breakPoint(text, start, hardEnd) {
  const floor = start + Math.floor(CHUNK_CHARS * 0.6);
  const window = text.slice(floor, hardEnd);
  for (const marker of ['\n\n', '. ', '\n', ' ']) {
    const at = window.lastIndexOf(marker);
    if (at !== -1) return floor + at + marker.length;
  }
  return hardEnd;
}

/**
 * Splits per-page text into overlapping passages.
 * Returns [{ text, page }] in reading order; `page` is the page most of the passage is on.
 */
export function chunkPages(pageTexts) {
  let full = '';
  const starts = [];
  pageTexts.forEach((pageText) => {
    starts.push(full.length);
    const cleaned = tidy(pageText);
    if (cleaned) full += `${cleaned}\n\n`;
  });

  const chunks = [];
  let pos = 0;
  while (pos < full.length) {
    const hardEnd = Math.min(pos + CHUNK_CHARS, full.length);
    const end = hardEnd >= full.length ? full.length : breakPoint(full, pos, hardEnd);
    const text = full.slice(pos, end).trim();
    // Label with the page the passage's middle falls on. Its first 200 characters
    // are overlap from the previous passage, so its start can be on the page before.
    if (text) chunks.push({ text, page: pageAt(starts, pos + Math.floor((end - pos) / 2)) });
    if (end >= full.length) break;
    pos = Math.max(end - OVERLAP_CHARS, pos + 1);
  }
  return chunks;
}

// ---------- embeddings ----------

function normalize(vec) {
  let sum = 0;
  for (let i = 0; i < vec.length; i += 1) sum += vec[i] * vec[i];
  const norm = Math.sqrt(sum) || 1;
  for (let i = 0; i < vec.length; i += 1) vec[i] /= norm;
  return vec;
}

/** Embeds texts in batches. Returns unit-length Float32Array vectors in input order. */
export async function embedTexts(texts) {
  const vectors = [];
  for (let i = 0; i < texts.length; i += EMBED_BATCH) {
    const res = await openai.embeddings.create({
      model: EMBED_MODEL,
      input: texts.slice(i, i + EMBED_BATCH),
      dimensions: EMBED_DIMS,
    });
    [...res.data]
      .sort((a, b) => a.index - b.index)
      .forEach((item) => vectors.push(normalize(Float32Array.from(item.embedding))));
  }
  return vectors;
}

export function vectorToBuffer(vec) {
  return Buffer.from(vec.buffer, vec.byteOffset, vec.byteLength);
}

/**
 * Reads an embedding back from MongoDB. `.lean()` hands back a BSON Binary (the
 * bytes are in `.buffer`), a hydrated document hands back a Node Buffer.
 */
export function bufferToVector(raw) {
  const bytes = Buffer.isBuffer(raw)
    ? raw
    : Buffer.from(raw.buffer.subarray(0, raw.position ?? raw.buffer.length));
  if (bytes.length !== EMBED_DIMS * 4) {
    throw new Error(`Stored embedding has ${bytes.length} bytes, expected ${EMBED_DIMS * 4}`);
  }
  // Copy so the Float32Array starts on a 4-byte boundary whatever the Buffer's offset.
  return new Float32Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length));
}

// ---------- retrieval ----------

// Vectors are unit length, so the dot product is the cosine similarity.
function dot(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) sum += a[i] * b[i];
  return sum;
}

/** The unit vector pointing at the "average meaning" of a set of vectors. */
export function centroid(vectors) {
  const mean = new Float32Array(vectors[0].length);
  vectors.forEach((v) => {
    for (let i = 0; i < mean.length; i += 1) mean[i] += v[i];
  });
  return normalize(mean);
}

/**
 * Maximal Marginal Relevance: repeatedly pick the passage that is most similar to
 * the query while least similar to the passages already picked.
 *   lambda near 1 -> mostly relevance (topic questions)
 *   lambda near 0 -> mostly variety   (cover the whole document)
 *
 * Returns { picked, relevance } where `picked` are indexes into `vectors` in the
 * order chosen and `relevance[i]` is the cosine similarity of passage i to the query.
 */
export function selectPassages(vectors, queryVec, k, lambda) {
  const relevance = vectors.map((v) => dot(v, queryVec));
  const picked = [];
  const left = new Set(vectors.map((_, i) => i));

  while (picked.length < Math.min(k, vectors.length)) {
    let best = -1;
    let bestScore = -Infinity;
    for (const i of left) {
      let closestPicked = 0;
      for (const j of picked) closestPicked = Math.max(closestPicked, dot(vectors[i], vectors[j]));
      const score = lambda * relevance[i] - (1 - lambda) * closestPicked;
      if (score > bestScore) {
        bestScore = score;
        best = i;
      }
    }
    picked.push(best);
    left.delete(best);
  }
  return { picked, relevance };
}
