import { useEffect, useMemo, useState } from 'react';
import './App.css';

const API_BASE = 'http://localhost:3000';

function formatTimeAgo(rawDate) {
  if (!rawDate) return 'just now';
  const parsed = new Date(rawDate);
  if (Number.isNaN(parsed.getTime())) return 'just now';

  const diffSec = Math.max(0, Math.floor((Date.now() - parsed.getTime()) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

export default function App() {
  const [posts, setPosts] = useState([]);
  const [content, setContent] = useState('');
  const [anonymousName, setAnonymousName] = useState('');
  const [userVotes, setUserVotes] = useState({});
  const [activePostId, setActivePostId] = useState(null);
  const [commentsByPost, setCommentsByPost] = useState({});
  const [commentDrafts, setCommentDrafts] = useState({});
  const [commentVotes, setCommentVotes] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  async function fetchPosts() {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/notes`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      setPosts(list);
      if (list.length > 0 && !activePostId) {
        setActivePostId(list[0]._id);
      }
      setStatusMsg('');
    } catch (err) {
      console.error(err);
      setStatusMsg('Backend offline on http://localhost:3000');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchPosts();
  }, []);

  async function handleCreatePost(e) {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed) {
      setStatusMsg('Write something before posting.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch(`${API_BASE}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          note: trimmed,
          anonymousName: anonymousName.trim() || 'anonymous',
        }),
      });
      if (!res.ok) throw new Error('Failed to post');
      const created = await res.json();
      setPosts((prev) => [created, ...prev]);
      setActivePostId(created._id);
      setContent('');
      setStatusMsg('Posted anonymously');
    } catch (err) {
      setStatusMsg(err.message || 'Error creating post');
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePostVote(postId, direction) {
    const current = userVotes[postId] || 0;
    const next = current === direction ? 0 : direction;
    const delta = next - current;

    setUserVotes((prev) => ({ ...prev, [postId]: next }));
    setPosts((prev) =>
      prev.map((p) => (p._id === postId ? { ...p, score: (p.score ?? 0) + delta } : p))
    );

    try {
      const res = await fetch(`${API_BASE}/notes/${postId}/vote`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delta }),
      });
      if (!res.ok) throw new Error('Vote failed');
      const updated = await res.json();
      setPosts((prev) => prev.map((p) => (p._id === postId ? updated : p)));
    } catch {
      setUserVotes((prev) => ({ ...prev, [postId]: current }));
      setPosts((prev) =>
        prev.map((p) => (p._id === postId ? { ...p, score: (p.score ?? 0) - delta } : p))
      );
    }
  }

  function handleAddComment(e, postId) {
    e.preventDefault();
    const text = (commentDrafts[postId] || '').trim();
    if (!text) return;

    const newComment = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      author: anonymousName.trim() || 'anonymous',
      text,
      score: 1,
      createdAt: new Date().toISOString(),
    };

    setCommentsByPost((prev) => ({
      ...prev,
      [postId]: [newComment, ...(prev[postId] || [])],
    }));
    setCommentVotes((prev) => ({ ...prev, [newComment.id]: 1 }));
    setCommentDrafts((prev) => ({ ...prev, [postId]: '' }));
  }

  function handleCommentVote(commentId, postId, direction) {
    const current = commentVotes[commentId] || 0;
    const next = current === direction ? 0 : direction;
    const delta = next - current;

    setCommentVotes((prev) => ({ ...prev, [commentId]: next }));
    setCommentsByPost((prev) => ({
      ...prev,
      [postId]: (prev[postId] || []).map((c) =>
        c.id === commentId ? { ...c, score: (c.score ?? 0) + delta } : c
      ),
    }));
  }

  function handleShare(postId) {
    const url = `${window.location.origin}/?post=${postId}`;
    navigator.clipboard?.writeText(url).catch(() => {});
    setStatusMsg('Link copied');
  }

  const visiblePosts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return posts;
    return posts.filter(
      (p) =>
        (p.content || '').toLowerCase().includes(q) ||
        (p.anonymousName || 'anonymous').toLowerCase().includes(q)
    );
  }, [posts, searchQuery]);

  const focusedPost =
    visiblePosts.find((p) => p._id === activePostId) || visiblePosts[0] || null;
  const activeComments = focusedPost ? commentsByPost[focusedPost._id] || [] : [];

  return (
    <div className="dark-reddit">
      {/* Top Pill Bar */}
      <header className="top-bar">
        <div className="brand">
          <span className="brand-mark">●</span>
          <span className="brand-name">reddit</span>
          <span className="pill-tag">r/anonymous</span>
        </div>

        <input
          type="search"
          className="pill-search"
          placeholder="Search discussion..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />

        {statusMsg && <span className="toast-pill">{statusMsg}</span>}
      </header>

      <div className="content-grid">
        {/* Left Thread Switcher */}
        <aside className="thread-rail">
          <form onSubmit={handleCreatePost} className="composer-box">
            <input
              type="text"
              className="anon-field"
              placeholder="Anonymous name (optional)"
              maxLength={24}
              value={anonymousName}
              onChange={(e) => setAnonymousName(e.target.value)}
            />
            <textarea
              className="composer-textarea"
              rows={3}
              placeholder="Start an anonymous thread..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
            <button type="submit" className="post-pill-btn" disabled={submitting}>
              {submitting ? 'Posting...' : 'Post'}
            </button>
          </form>

          <div className="mini-list">
            {loading ? (
              <div className="muted-note">Loading threads...</div>
            ) : visiblePosts.length === 0 ? (
              <div className="muted-note">No posts yet.</div>
            ) : (
              visiblePosts.map((p) => {
                const firstLine = (p.content || '').split('\n')[0] || 'Untitled';
                const isSelected = focusedPost && focusedPost._id === p._id;
                return (
                  <button
                    key={p._id}
                    type="button"
                    className={`mini-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => setActivePostId(p._id)}
                  >
                    <span className="mini-title">{firstLine}</span>
                    <span className="mini-meta">
                      u/{p.anonymousName || 'anonymous'} · {p.score ?? 0} pts
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* Main Post + Comments Column */}
        <main className="discussion-column">
          {!focusedPost ? (
            <div className="empty-card">Create or select a post to view comments.</div>
          ) : (
            <>
              <article className="post-card">
                <div className="post-meta-line">
                  <span className="community-link">r/anonymous</span>
                  <span>•</span>
                  <span>{formatTimeAgo(focusedPost.date)}</span>
                  <span>•</span>
                  <span className="author-link">
                    u/{focusedPost.anonymousName || 'anonymous'}
                  </span>
                </div>

                <div className="post-body">
                  {(focusedPost.content || '').split('\n').map((line, i) => (
                    <p key={i} className={i === 0 ? 'post-heading' : 'post-paragraph'}>
                      {line}
                    </p>
                  ))}
                </div>

                {/* Pill Action Bar matching reference */}
                <div className="action-pills">
                  <div className="vote-pill">
                    <button
                      type="button"
                      aria-label="Upvote post"
                      className={`arrow-btn up ${
                        (userVotes[focusedPost._id] || 0) === 1 ? 'active' : ''
                      }`}
                      onClick={() => handlePostVote(focusedPost._id, 1)}
                    >
                      ▲
                    </button>
                    <span
                      className={`score-label ${
                        (userVotes[focusedPost._id] || 0) === 1
                          ? 'up-text'
                          : (userVotes[focusedPost._id] || 0) === -1
                          ? 'down-text'
                          : ''
                      }`}
                    >
                      {focusedPost.score ?? 0}
                    </span>
                    <button
                      type="button"
                      aria-label="Downvote post"
                      className={`arrow-btn down ${
                        (userVotes[focusedPost._id] || 0) === -1 ? 'active' : ''
                      }`}
                      onClick={() => handlePostVote(focusedPost._id, -1)}
                    >
                      ▼
                    </button>
                  </div>

                  <div className="stat-pill">
                    <span>💬</span>
                    <span>{activeComments.length}</span>
                  </div>

                  <button
                    type="button"
                    className="stat-pill share-pill"
                    onClick={() => handleShare(focusedPost._id)}
                  >
                    <span>↗</span>
                    <span>Share</span>
                  </button>
                </div>
              </article>

              {/* Comment Composer */}
              <form
                onSubmit={(e) => handleAddComment(e, focusedPost._id)}
                className="comment-composer"
              >
                <textarea
                  className="comment-textarea"
                  rows={3}
                  placeholder="Add a comment"
                  value={commentDrafts[focusedPost._id] || ''}
                  onChange={(e) =>
                    setCommentDrafts((prev) => ({
                      ...prev,
                      [focusedPost._id]: e.target.value,
                    }))
                  }
                />
                <div className="comment-composer-footer">
                  <button type="submit" className="comment-submit-btn">
                    Comment
                  </button>
                </div>
              </form>

              {/* Comments Thread */}
              <section className="comments-section">
                <div className="comments-header">
                  Comments ({activeComments.length})
                </div>

                {activeComments.length === 0 ? (
                  <div className="no-comments">No comments yet. Start the conversation.</div>
                ) : (
                  activeComments.map((comment) => {
                    const cVote = commentVotes[comment.id] || 0;
                    return (
                      <div key={comment.id} className="comment-node">
                        <div className="comment-thread-line" />
                        <div className="comment-content">
                          <div className="comment-meta">
                            <span className="comment-author">u/{comment.author}</span>
                            <span>•</span>
                            <span>{formatTimeAgo(comment.createdAt)}</span>
                          </div>
                          <p className="comment-text">{comment.text}</p>
                          <div className="comment-actions">
                            <button
                              type="button"
                              aria-label="Upvote comment"
                              className={`arrow-btn up ${cVote === 1 ? 'active' : ''}`}
                              onClick={() =>
                                handleCommentVote(comment.id, focusedPost._id, 1)
                              }
                            >
                              ▲
                            </button>
                            <span
                              className={`score-label ${
                                cVote === 1
                                  ? 'up-text'
                                  : cVote === -1
                                  ? 'down-text'
                                  : ''
                              }`}
                            >
                              {comment.score ?? 0}
                            </span>
                            <button
                              type="button"
                              aria-label="Downvote comment"
                              className={`arrow-btn down ${cVote === -1 ? 'active' : ''}`}
                              onClick={() =>
                                handleCommentVote(comment.id, focusedPost._id, -1)
                              }
                            >
                              ▼
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
}