// F2 - Browse and search books (open to guests). Route: "/"
//
// The search is kept in the URL (/?q=harbor&category=Fiction), so the
// browser Back button, page refresh and shared links all show the same results.
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { MAX_SEARCH_LENGTH, MSG } from '../validation';
import { useToast } from '../components/Toast';
import BookCard from '../components/BookCard';

export default function Home() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') || '';
  const category = params.get('category') || '';

  const [text, setText] = useState(q); // what is typed in the search box
  const [inputError, setInputError] = useState('');
  const [categories, setCategories] = useState([]);
  // status: 'loading' | 'ok' | 'error'
  const [result, setResult] = useState({ status: 'loading', books: [], count: 0, message: '' });
  const [retry, setRetry] = useState(0);
  const toast = useToast();

  // Category dropdown options
  useEffect(() => {
    api('/categories')
      .then((data) => setCategories(data.categories))
      .catch(() => {}); // the book list shows the error; the dropdown just stays at "All"
  }, []);

  // Keep the search box in step with the URL (e.g. after Back).
  useEffect(() => {
    setText(q);
  }, [q]);

  // Load books whenever the search in the URL changes.
  useEffect(() => {
    let cancelled = false;
    setResult((r) => ({ ...r, status: 'loading' }));

    const query = new URLSearchParams();
    if (q) query.set('q', q);
    if (category) query.set('category', category);
    const qs = query.toString();

    api(`/books${qs ? `?${qs}` : ''}`)
      .then((data) => {
        if (cancelled) return;
        setResult({ status: 'ok', books: data.books, count: data.count, message: data.message });
      })
      .catch((err) => {
        if (cancelled) return;
        // 400 "Search text must be 100 characters or less." (e.g. a long link) or
        // "Something went wrong. Please try again." (server down / network error)
        if (err.fields && err.fields.q) setInputError(err.fields.q);
        setResult({ status: 'error', books: [], count: 0, message: err.message });
        toast.error(err.message);
      });

    return () => {
      cancelled = true;
    };
  }, [q, category, retry, toast]);

  // Puts the search into the URL, which triggers the load above.
  function applySearch(rawText, nextCategory) {
    const trimmed = rawText.trim();
    if (trimmed.length > MAX_SEARCH_LENGTH) {
      setInputError(MSG.SEARCH_TOO_LONG);
      document.getElementById('search')?.focus();
      return;
    }
    setInputError('');
    setText(trimmed);

    const next = {};
    if (trimmed) next.q = trimmed;
    if (nextCategory) next.category = nextCategory;
    setParams(next);
  }

  function handleSubmit(e) {
    e.preventDefault();
    applySearch(text, category);
  }

  function handleCategoryChange(e) {
    applySearch(text, e.target.value);
  }

  function handleTextChange(e) {
    setText(e.target.value);
    if (inputError) setInputError('');
  }

  function clearSearch() {
    setInputError('');
    setText('');
    setParams({});
  }

  const hasFilter = Boolean(q || category);
  const loading = result.status === 'loading';

  return (
    <section className="browse">
      <div className="browse__head">
        <h1 className="page-title">Browse books</h1>
        <p className="page-lead">Search by title, or pick a category to see what's on the shelf.</p>
      </div>

      <form className="search card" onSubmit={handleSubmit} noValidate role="search">
        <div className={`field search__text${inputError ? ' field--error' : ''}`}>
          <label htmlFor="search" className="field__label">
            Search by title
          </label>
          <input
            id="search"
            name="q"
            type="search"
            className="field__input"
            placeholder="e.g. harbor, science, javascript"
            value={text}
            onChange={handleTextChange}
            aria-invalid={inputError ? 'true' : 'false'}
            aria-describedby={inputError ? 'search-error' : undefined}
          />
          {inputError && (
            <p id="search-error" className="field__error">
              {inputError}
            </p>
          )}
        </div>

        <div className="field search__category">
          <label htmlFor="category" className="field__label">
            Category
          </label>
          <select
            id="category"
            name="category"
            className="field__input"
            value={category}
            onChange={handleCategoryChange}
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="search__actions">
          <button type="submit" className="btn btn--primary">
            Search
          </button>
          {hasFilter && (
            <button type="button" className="btn btn--ghost" onClick={clearSearch}>
              Clear
            </button>
          )}
        </div>
      </form>

      {/* Results */}
      <div className="results" aria-busy={loading}>
        {result.status === 'error' && (
          <div className="banner banner--error banner--with-action" data-testid="results-error">
            <span>{result.message}</span>
            <button type="button" className="btn btn--small" onClick={() => setRetry((n) => n + 1)}>
              Try again
            </button>
          </div>
        )}

        {loading && result.books.length === 0 && <p className="results__status">Loading books…</p>}

        {result.status === 'ok' && result.count > 0 && (
          <p className="results__status" role="status" data-testid="results-count">
            {result.message}
          </p>
        )}

        {result.status === 'ok' && result.count === 0 && (
          <div className="empty-state" role="status" data-testid="no-results">
            <p className="empty-state__title">{result.message}</p>
            <button type="button" className="btn btn--ghost" onClick={clearSearch}>
              Show all books
            </button>
          </div>
        )}

        {result.books.length > 0 && (
          <div className={`book-grid${loading ? ' book-grid--loading' : ''}`}>
            {result.books.map((book) => (
              <BookCard key={book.id} book={book} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
