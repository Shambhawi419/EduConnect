'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/components/AuthContext';
import BlobArt from '@/components/BlobArt';
import { IconBack, IconShare, IconDots, IconTarget, IconPlay, IconDoc } from '@/components/Icons';

const TABS = [
  { id: 'source', label: 'Source' },
  { id: 'quiz', label: 'Quiz' },
  { id: 'review', label: 'Review' },
];

// Matches the server limit (Vercel rejects larger request bodies anyway).
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

// Where the quiz's questions came from, in one sentence.
function describeRetrieval(r, filename) {
  if (!r) return '';
  const used = `${r.passagesUsed} of ${r.passagesTotal} sections of ${filename}`;
  const base =
    r.mode === 'topic'
      ? `Questions focus on “${r.topic}”, drawn from the ${used} that match it best.`
      : `Questions are spread across the whole document, drawn from ${used}.`;
  return r.returned < r.requested
    ? `${base} There was only enough material for ${r.returned} of the ${r.requested} questions you asked for.`
    : base;
}

export default function QuizPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState('source');
  const [docs, setDocs] = useState([]);
  const [docsLoading, setDocsLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [topic, setTopic] = useState('');
  const [numQuestions, setNumQuestions] = useState(5);
  const [quiz, setQuiz] = useState(null);
  const [answers, setAnswers] = useState({});
  const [open, setOpen] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  const selectedDoc = docs.find((d) => d.id === selectedId) || null;
  const questions = quiz?.questions ?? [];
  const answered = Object.keys(answers).length;
  const correct = questions.reduce(
    (n, q, i) => (answers[i] === q.correctIndex ? n + 1 : n),
    0
  );
  const progress = questions.length ? Math.round((answered / questions.length) * 100) : 0;

  useEffect(() => {
    api
      .quizDocuments()
      .then((data) => {
        setDocs(data.documents);
        if (data.documents.length > 0) setSelectedId(data.documents[0].id);
      })
      .catch((err) => setError(err.message))
      .finally(() => setDocsLoading(false));
  }, []);

  const upload = async (file) => {
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      setError('PDF must be smaller than 4MB');
      return;
    }
    setError('');
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const data = await api.uploadQuizDocument(formData);
      setDocs((d) => [data.document, ...d]);
      setSelectedId(data.document.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const removeDoc = async (doc) => {
    if (!window.confirm(`Delete “${doc.filename}”? Its indexed text will be removed.`)) return;
    setError('');
    try {
      await api.deleteQuizDocument(doc.id);
      setDocs((d) => d.filter((x) => x.id !== doc.id));
      if (selectedId === doc.id) setSelectedId(null);
    } catch (err) {
      setError(err.message);
    }
  };

  const generate = async (e) => {
    e.preventDefault();
    if (!selectedDoc) {
      setError('Upload a PDF, or pick one of your documents, first');
      return;
    }
    setError('');
    setBusy(true);
    setQuiz(null);
    setAnswers({});
    try {
      const data = await api.generateQuiz({
        documentId: selectedDoc.id,
        topic: topic.trim(),
        numQuestions: Number(numQuestions),
      });
      // The model can return correctIndex as a string ("2"); coerce it so the
      // strict comparisons below don't mark every answer wrong.
      setQuiz({
        retrieval: describeRetrieval(data.retrieval, data.document.filename),
        questions: (data.quiz?.questions ?? []).map((q) => ({
          ...q,
          options: Array.isArray(q.options) ? q.options : [],
          correctIndex: Number(q.correctIndex),
        })),
      });
      setOpen({});
      setTab('quiz');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const pick = (qIndex, oIndex) => {
    if (answers[qIndex] !== undefined) return;
    setAnswers((a) => ({ ...a, [qIndex]: oIndex }));
  };

  return (
    <div className="panel panel-white">
      <div className="hero">
        <BlobArt />
        <div className="hero-bar">
          <Link href="/" className="circle-btn glass" title="Back">
            <IconBack />
          </Link>
          <div className="head-actions">
            <button className="circle-btn glass" type="button" title="Share">
              <IconShare width={18} height={18} />
            </button>
            <button className="circle-btn glass" type="button" title="Options">
              <IconDots width={18} height={18} />
            </button>
          </div>
        </div>
      </div>

      <p className="eyebrow" style={{ marginTop: 20 }}>
        Lecture
      </p>
      <h1 className="display">
        {selectedDoc ? selectedDoc.filename.replace(/\.pdf$/i, '') : 'PDF to Quiz'}
      </h1>

      <div className="tabs">
        {TABS.map((t, i) => (
          <button
            key={t.id}
            type="button"
            className={tab === t.id ? 'active' : i === 2 ? 'tinted' : ''}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <div className="error-banner">{error}</div>}

      {tab === 'source' && (
        <div>
          <div
            className="dropzone"
            onClick={() => !uploading && inputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (!uploading) upload(e.dataTransfer.files[0]);
            }}
          >
            {uploading ? 'Reading and indexing your PDF…' : 'Click or drop a PDF here'}
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf"
              hidden
              onChange={(e) => upload(e.target.files[0])}
            />
          </div>
          <p className="muted-note" style={{ marginTop: 10, fontSize: 12.5 }}>
            Up to 4MB and 5 documents. Uploaded PDFs are stored privately, only for you, and
            deleted automatically after 30 days — or sooner if you delete them.
          </p>

          <div style={{ height: 18 }} />

          <p className="section-title">Your documents</p>
          {docsLoading ? (
            <p className="muted-note">Loading…</p>
          ) : docs.length === 0 ? (
            <p className="muted-note">No documents yet — upload a PDF above.</p>
          ) : (
            <ul className="lesson-list" style={{ marginBottom: 18 }}>
              {docs.map((d) => {
                const isSelected = d.id === selectedId;
                return (
                  <li
                    key={d.id}
                    className="review-item"
                    style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                  >
                    <button
                      type="button"
                      className="lesson"
                      aria-pressed={isSelected}
                      style={{
                        flex: 1,
                        width: 'auto',
                        boxShadow: isSelected ? '0 0 0 2px var(--ink)' : 'none',
                      }}
                      onClick={() => setSelectedId(d.id)}
                    >
                      <span className="play">
                        <IconDoc width={18} height={18} />
                      </span>
                      <div className="lesson-text">
                        <b>{d.filename}</b>
                        <span>
                          {d.pages} {d.pages === 1 ? 'page' : 'pages'} · {d.chunks} sections
                        </span>
                      </div>
                    </button>
                    <button
                      type="button"
                      className="circle-btn flat sm"
                      title="Delete document"
                      onClick={() => removeDoc(d)}
                    >
                      <span aria-hidden="true">×</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <form onSubmit={generate}>
            <div className="field">
              <label>Topic (optional)</label>
              <input
                value={topic}
                maxLength={200}
                placeholder="e.g. the Calvin cycle — leave empty to cover the whole document"
                onChange={(e) => setTopic(e.target.value)}
              />
            </div>

            <div className="field">
              <label>Number of questions</label>
              <input
                type="number"
                min={1}
                max={20}
                value={numQuestions}
                onChange={(e) => setNumQuestions(e.target.value)}
              />
            </div>

            <button className="pill-btn block" disabled={busy || uploading || !selectedDoc}>
              {busy ? 'Generating…' : 'Generate quiz'}
            </button>
          </form>
        </div>
      )}

      {tab === 'quiz' &&
        (questions.length === 0 ? (
          <p className="muted-note">Pick a document on the Source tab to generate your quiz.</p>
        ) : (
          <div className="quiz-grid">
            <div className="quiz-main">
            {quiz?.retrieval && (
              <p className="muted-note" style={{ marginBottom: 12 }}>
                {quiz.retrieval}
              </p>
            )}
            {questions.map((q, qi) => (
              <div className="quiz-question" key={qi}>
                <b>
                  {qi + 1}. {q.question}
                </b>
                {q.options.map((opt, oi) => {
                  const chosen = answers[qi];
                  let cls = 'quiz-option';
                  if (chosen !== undefined) {
                    if (oi === q.correctIndex) cls += ' correct';
                    else if (oi === chosen) cls += ' incorrect';
                  }
                  return (
                    <div key={oi} className={cls} onClick={() => pick(qi, oi)}>
                      {opt}
                    </div>
                  );
                })}
                {answers[qi] !== undefined && q.explanation && (
                  <p className="muted-note" style={{ marginTop: 10, fontSize: 13 }}>
                    {q.explanation}
                    {q.source ? ` (page ${q.source.page})` : ''}
                  </p>
                )}
              </div>
            ))}
            </div>

            <aside className="quiz-rail">
              <div className="progress-float">
                <div className="avatar-photo">{user?.name?.[0]?.toUpperCase() || '?'}</div>
                <div className="pf-body">
                  <span>Your progress</span>
                  <b>{progress}%</b>
                  <p>Of the topic has been successfully covered.</p>
                </div>
                <button className="circle-btn" type="button" title="Score">
                  <IconTarget width={18} height={18} />
                </button>
              </div>
            </aside>
          </div>
        ))}

      {tab === 'review' &&
        (questions.length === 0 ? (
          <p className="muted-note">Generate a quiz first — your review will appear here.</p>
        ) : (
          <div className="quiz-grid">
            <div className="quiz-main">
            <p className="muted-note" style={{ marginBottom: 12 }}>
              Tap any question to see the answer explained.
            </p>

            <ul className="lesson-list">
              {questions.map((q, qi) => {
                const picked = answers[qi];
                const skipped = picked === undefined;
                const right = picked === q.correctIndex;
                const isOpen = !!open[qi];

                return (
                  <li className="review-item" key={qi}>
                    <button
                      type="button"
                      className={`lesson ${isOpen ? 'open' : ''}`}
                      onClick={() => setOpen((o) => ({ ...o, [qi]: !o[qi] }))}
                      aria-expanded={isOpen}
                    >
                      <span className="play">
                        <IconPlay width={16} height={16} />
                      </span>
                      <div className="lesson-text">
                        <b>Question {qi + 1}</b>
                        <span>{q.question}</span>
                      </div>
                      <time className={skipped ? '' : right ? 'ok' : 'bad'}>
                        {skipped ? 'Skipped' : right ? 'Correct' : 'Missed'}
                      </time>
                    </button>

                    {isOpen && (
                      <div className="lesson-detail">
                        <p className="q-full">{q.question}</p>

                        {q.options.map((opt, oi) => {
                          const isCorrect = oi === q.correctIndex;
                          const isPicked = oi === picked;
                          let cls = 'review-option';
                          if (isCorrect) cls += ' correct';
                          else if (isPicked) cls += ' picked-wrong';
                          return (
                            <div key={oi} className={cls}>
                              <span>{opt}</span>
                              {isCorrect && <span className="tag">Correct answer</span>}
                              {isPicked && !isCorrect && <span className="tag">You chose this</span>}
                            </div>
                          );
                        })}

                        {q.explanation ? (
                          <p className="explain">{q.explanation}</p>
                        ) : (
                          <p className="explain">No explanation was provided for this question.</p>
                        )}

                        {q.source && (
                          <p className="explain">
                            <b>From page {q.source.page}:</b> “{q.source.excerpt}”
                          </p>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            </div>

            <aside className="quiz-rail">
              <div className="progress-float">
                <div className="avatar-photo">{user?.name?.[0]?.toUpperCase() || '?'}</div>
                <div className="pf-body">
                  <span>Your score</span>
                  <b>{Math.round((correct / questions.length) * 100)}%</b>
                  <p>
                    {correct} of {questions.length} answered correctly.
                  </p>
                </div>
                <button className="circle-btn" type="button" title="Score">
                  <IconTarget width={18} height={18} />
                </button>
              </div>
            </aside>
          </div>
        ))}
    </div>
  );
}
