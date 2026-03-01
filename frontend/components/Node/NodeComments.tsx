import { useState, useEffect } from 'react';
import { MessageSquare, Send, Trash2, Reply, X } from 'lucide-react';
import { apiFetch } from '@/utils/api';
import { formatDistanceToNow } from 'date-fns';

interface Comment {
    id: string;
    content: string;
    createdAt: string;
    user: {
        name: string;
        email: string;
    };
    replies?: Comment[];
}

interface NodeCommentsProps {
    workflowId: string;
    nodeId: string;
    lang: 'en' | 'es';
}

export default function NodeComments({ workflowId, nodeId, lang }: NodeCommentsProps) {
    const [comments, setComments] = useState<Comment[]>([]);
    const [newComment, setNewComment] = useState('');
    const [replyTo, setReplyTo] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const fetchComments = async () => {
        try {
            const data = await apiFetch(`/api/comments/${workflowId}/${nodeId}`);
            setComments(data);
        } catch (error) {
            console.error('Failed to fetch comments:', error);
        }
    };

    useEffect(() => {
        fetchComments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [workflowId, nodeId]);

    const handleSend = async () => {
        if (!newComment.trim() || isLoading) return;

        setIsLoading(true);
        try {
            await apiFetch(`/api/comments/${workflowId}/${nodeId}`, {
                method: 'POST',
                body: JSON.stringify({
                    content: newComment,
                    parentId: replyTo
                })
            });
            setNewComment('');
            setReplyTo(null);
            fetchComments();
        } catch (error) {
            console.error('Failed to send comment:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm(lang === 'es' ? '¿Eliminar comentario?' : 'Delete comment?')) return;
        try {
            await apiFetch(`/api/comments/${id}`, { method: 'DELETE' });
            fetchComments();
        } catch (error) {
            console.error('Failed to delete comment:', error);
        }
    };

    const text = {
        en: {
            title: 'Comments',
            placeholder: 'Add a comment...',
            reply: 'Reply',
            delete: 'Delete',
            send: 'Send',
            cancel: 'Cancel',
            noComments: 'No comments yet. Start the conversation!'
        },
        es: {
            title: 'Comentarios',
            placeholder: 'Añadir un comentario...',
            reply: 'Responder',
            delete: 'Eliminar',
            send: 'Enviar',
            cancel: 'Cancelar',
            noComments: 'Sin comentarios aún. ¡Empieza la conversación!'
        }
    }[lang];

    return (
        <div className="flex flex-col h-full bg-black/10 rounded-lg overflow-hidden border border-[var(--border-color)]">
            <div className="p-3 border-b border-[var(--border-color)] bg-white/5 flex items-center gap-2">
                <MessageSquare size={14} className="text-[var(--highlight-color)]" />
                <h4 className="text-[11px] font-bold uppercase text-[var(--descriptor-color)]">{text.title}</h4>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-4 custom-scrollbar max-h-[300px]">
                {comments.length === 0 ? (
                    <p className="text-[10px] text-[var(--descriptor-color)] italic text-center py-4">{text.noComments}</p>
                ) : (
                    comments.map(comment => (
                        <div key={comment.id} className="space-y-3">
                            <CommentItem 
                                comment={comment} 
                                onReply={() => setReplyTo(comment.id)} 
                                onDelete={() => handleDelete(comment.id)}
                                lang={lang}
                                text={text}
                            />
                            {comment.replies?.map(reply => (
                                <div key={reply.id} className="ml-6 border-l-2 border-white/5 pl-3">
                                    <CommentItem 
                                        comment={reply} 
                                        onDelete={() => handleDelete(reply.id)}
                                        lang={lang}
                                        text={text}
                                        isReply
                                    />
                                </div>
                            ))}
                        </div>
                    ))
                )}
            </div>

            <div className="p-3 border-t border-[var(--border-color)] bg-white/5 space-y-2">
                {replyTo && (
                    <div className="flex items-center justify-between bg-[var(--highlight-color)]/10 px-2 py-1 rounded">
                        <span className="text-[9px] text-[var(--highlight-color)] font-medium">
                            {lang === 'es' ? 'Respondiendo...' : 'Replying...'}
                        </span>
                        <button onClick={() => setReplyTo(null)} className="text-[var(--highlight-color)] hover:opacity-70">
                            <X size={10} />
                        </button>
                    </div>
                )}
                <div className="flex gap-2">
                    <textarea
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder={text.placeholder}
                        className="flex-1 bg-black/20 border border-[var(--border-color)] rounded p-2 text-xs text-[var(--body-text-color)] focus:outline-none focus:border-[var(--highlight-color)] resize-none"
                        rows={2}
                    />
                    <button
                        onClick={handleSend}
                        disabled={!newComment.trim() || isLoading}
                        className="self-end p-2 bg-[var(--highlight-color)] text-white rounded hover:opacity-90 disabled:opacity-50 transition-opacity"
                    >
                        <Send size={14} />
                    </button>
                </div>
            </div>
        </div>
    );
}

function CommentItem({ comment, onReply, onDelete, text, isReply = false }: any) {
    return (
        <div className="group">
            <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold text-[var(--highlight-color)]">{comment.user.name || comment.user.email}</span>
                <span className="text-[9px] text-[var(--descriptor-color)] opacity-60">
                    {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                </span>
            </div>
            <p className="text-[11px] text-[var(--body-text-color)] leading-snug">{comment.content}</p>
            <div className="flex gap-3 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {!isReply && onReply && (
                    <button onClick={onReply} className="text-[9px] text-[var(--descriptor-color)] hover:text-[var(--highlight-color)] flex items-center gap-1">
                        <Reply size={10} /> {text.reply}
                    </button>
                )}
                <button onClick={onDelete} className="text-[9px] text-[var(--descriptor-color)] hover:text-red-400 flex items-center gap-1">
                    <Trash2 size={10} /> {text.delete}
                </button>
            </div>
        </div>
    );
}
