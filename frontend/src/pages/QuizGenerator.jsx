import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import BlobArt from '../components/BlobArt';
import { IconBack, IconShare, IconDots, IconTarget, IconPlay } from '../components/Icons';

const TABS = [
  { id: 'source', label: 'Source' },
  { id: 'quiz', label: 'Quiz' },
  { id: 'review', label: 'Review' },
];

export default function QuizGenerator() {
  const { user } = useAuth();
  const [tab, setTab] = useState('source');
  const [file, setFile] = useState(null);
  const [numQuestions, setNumQuestions] = useState(5);
  const [quiz, setQuiz] = useState(null);
  const [answers, setAnswers] = useState({});
  const [open, setOpen] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  const questions = quiz?.questions ?? [];
  const answered = Object.keys(answers).length;
  const correct = questions.reduce(
    (n, q, i) => (answers[i] === q.correctIndex ? n + 1 : n),
    0
  );
  const progress = questions.length ? Math.round((answered / questions.length) * 100) : 0;

  const generate = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Choose a PDF file first');
      return;
    }
    setError('');
    setBusy(true);
    setQuiz(null);
    setAnswers({});
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('numQuestions', numQuestions);
      const data = await api.generateQuiz(formData);
      // The model can return correctIndex as a string ("2"); coerce it so the
      // strict comparisons below don't mark every answer wrong.
      setQuiz({
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
          <Link to="/" className="circle-btn glass" title="Back">
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
      <h1 className="display">{file ? file.name.replace(/\.pdf$/i, '') : 'PDF to Quiz'}</h1>

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
        <form onSubmit={generate}>
          <div
            className="dropzone"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]);
            }}
          >
            {file ? file.name : 'Click or drop a PDF here'}
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf"
              hidden
              onChange={(e) => setFile(e.target.files[0])}
            />
          </div>

          <div style={{ height: 18 }} />

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

          <button className="pill-btn block" disabled={busy}>
            {busy ? 'Generating…' : 'Generate quiz'}
          </button>
        </form>
      )}

      {tab === 'quiz' &&
        (questions.length === 0 ? (
          <p className="muted-note">Upload a PDF on the Source tab to generate your quiz.</p>
        ) : (
          <div className="quiz-grid">
            <div className="quiz-main">
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
