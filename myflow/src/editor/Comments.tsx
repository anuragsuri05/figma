import React, { useState } from 'react';
import { useEditor, S, addComment, replyComment, resolveComment, deleteComment, worldToScreen, zoomToRect } from '../store/editor';
import { IconButton } from './ui';
import { I } from './icons';
import { ThemeToggle } from './ThemeToggle';
import type { CommentThread } from '../model/types';

const EMPTY: CommentThread[] = [];

function timeAgo(t: number) {
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(t).toLocaleDateString();
}

export function CommentLayer() {
  const comments = useEditor((s) => s.doc?.comments ?? EMPTY);
  const pageId = useEditor((s) => s.pageId);
  const visible = useEditor((s) => s.view.comments);
  const tool = useEditor((s) => s.tool);
  const active = useEditor((s) => s.activeCommentId);
  const draft = useEditor((s) => s.draftComment);
  useEditor((s) => s.zoom);
  useEditor((s) => s.panX);
  useEditor((s) => s.panY);
  if (!visible && tool !== 'COMMENT') return null;
  const list = comments.filter((c) => c.pageId === pageId && (!c.resolved || active === c.id));
  return (
    <>
      {list.map((c) => {
        const p = worldToScreen(c.x, c.y);
        return (
          <div key={c.id} className={'comment-pin' + (active === c.id ? ' active' : '') + (c.resolved ? ' resolved' : '')} style={{ left: p.x, top: p.y }} data-testid="comment-pin"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); S().setState({ activeCommentId: active === c.id ? null : c.id, draftComment: null }); }}>
            <div className="avatar" style={{ width: 22, height: 22, fontSize: 10 }}>{c.replies[0]?.author[0]?.toUpperCase()}</div>
          </div>
        );
      })}
      {active ? <Thread thread={comments.find((c) => c.id === active)} /> : null}
      {draft ? <Composer /> : null}
    </>
  );
}

function Composer() {
  const draft = useEditor((s) => s.draftComment)!;
  const [text, setText] = useState('');
  const p = worldToScreen(draft.x, draft.y);
  const submit = () => { if (text.trim()) addComment(draft.x, draft.y, text.trim()); };
  return (
    <>
      <div className="comment-pin active" style={{ left: p.x, top: p.y }}><div className="avatar" style={{ width: 22, height: 22, fontSize: 10 }}>{S().prefs.userName[0]}</div></div>
      <div className="comment-pop" style={{ left: p.x + 36, top: p.y - 36 }} onPointerDown={(e) => e.stopPropagation()} data-testid="comment-composer">
        <div className="comment-input">
          <textarea autoFocus rows={1} placeholder="Add a comment" value={text} onChange={(e) => setText(e.target.value)} data-testid="comment-input"
            onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } if (e.key === 'Escape') S().setState({ draftComment: null }); }} />
          <button className="btn primary small" disabled={!text.trim()} onClick={submit} data-testid="comment-submit">Post</button>
        </div>
      </div>
    </>
  );
}

function Thread({ thread }: { thread?: CommentThread }) {
  const [text, setText] = useState('');
  if (!thread) return null;
  const p = worldToScreen(thread.x, thread.y);
  return (
    <div className="comment-pop" style={{ left: p.x + 36, top: Math.max(8, p.y - 36) }} onPointerDown={(e) => e.stopPropagation()} data-testid="comment-thread">
      <div className="row" style={{ padding: '8px 8px 8px 16px', borderBottom: '1px solid var(--border)' }}>
        <b className="grow">Comment</b>
        <IconButton icon="check" tip={thread.resolved ? 'Unresolve' : 'Resolve'} active={thread.resolved} onClick={() => { resolveComment(thread.id, !thread.resolved); if (!thread.resolved) S().setState({ activeCommentId: null }); }} testId="comment-resolve" />
        <IconButton icon="trash" tip="Delete thread" onClick={() => deleteComment(thread.id)} testId="comment-delete" />
        <IconButton icon="close" tip="Close" onClick={() => S().setState({ activeCommentId: null })} />
      </div>
      <div style={{ maxHeight: 300, overflow: 'auto' }}>
        {thread.replies.map((r) => (
          <div key={r.id} className="comment-reply">
            <div className="meta"><div className="avatar" style={{ width: 20, height: 20, fontSize: 10 }}>{r.author[0]?.toUpperCase()}</div>{r.author}<span className="faint">{timeAgo(r.createdAt)}</span></div>
            <div style={{ whiteSpace: 'pre-wrap', fontSize: 12 }} data-testid="comment-text">{r.text}</div>
          </div>
        ))}
      </div>
      <div className="comment-input">
        <textarea rows={1} placeholder="Reply" value={text} onChange={(e) => setText(e.target.value)} data-testid="comment-reply-input"
          onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (text.trim()) { replyComment(thread.id, text.trim()); setText(''); } } }} />
        <button className="btn primary small" disabled={!text.trim()} onClick={() => { replyComment(thread.id, text.trim()); setText(''); }} data-testid="comment-reply-submit">Reply</button>
      </div>
    </div>
  );
}

export function CommentsPanel() {
  const comments = useEditor((s) => s.doc?.comments ?? EMPTY);
  const pageId = useEditor((s) => s.pageId);
  const [showResolved, setShowResolved] = useState(false);
  const [filter, setFilter] = useState('');
  const list = comments.filter((c) => (showResolved || !c.resolved) && (!filter || c.replies.some((r) => r.text.toLowerCase().includes(filter.toLowerCase())))).sort((a, b) => b.createdAt - a.createdAt);
  return (
    <div className="panel right" data-testid="comments-panel" style={{ zIndex: 21 }}>
      <div className="right-top">
        <b className="grow">Comments</b>
        <ThemeToggle testId="theme-toggle-comments" />
        <IconButton icon="close" tip="Close comments" onClick={() => S().setState({ commentsPanel: false, tool: 'MOVE', draftComment: null })} testId="close-comments" />
      </div>
      <div className="row" style={{ padding: 8, borderBottom: '1px solid var(--border)' }}>
        <input className="input" placeholder="Search comments" value={filter} onChange={(e) => setFilter(e.target.value)} onKeyDown={(e) => e.stopPropagation()} />
        <label className="checkbox" style={{ whiteSpace: 'nowrap' }}><input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} /> Resolved</label>
      </div>
      <div className="panel-scroll">
        {list.length === 0 ? <div className="empty">No comments yet.<br />Press C and click anywhere on the canvas.</div> : null}
        {list.map((c) => (
          <div key={c.id} className="comment-reply" style={{ cursor: 'pointer', opacity: c.resolved ? 0.55 : 1 }} data-testid="comment-list-item"
            onClick={() => { if (c.pageId !== pageId) S().setState({ pageId: c.pageId }); S().setState({ activeCommentId: c.id }); zoomToRect({ x: c.x - 200, y: c.y - 150, width: 400, height: 300 }, S().zoom); }}>
            <div className="meta"><div className="avatar" style={{ width: 20, height: 20, fontSize: 10 }}>{c.replies[0]?.author[0]?.toUpperCase()}</div>{c.replies[0]?.author}<span className="faint">{timeAgo(c.createdAt)}</span>{c.resolved ? <I name="check" size={12} /> : null}</div>
            <div style={{ fontSize: 12 }}>{c.replies[0]?.text}</div>
            {c.replies.length > 1 ? <div className="faint" style={{ marginTop: 4 }}>{c.replies.length - 1} repl{c.replies.length > 2 ? 'ies' : 'y'}</div> : null}
          </div>
        ))}
      </div>
    </div>
  );
}
