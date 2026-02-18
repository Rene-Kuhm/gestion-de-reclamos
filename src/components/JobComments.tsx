import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Send, User, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { sendPush } from '../lib/push';

interface Comment {
  id: string;
  reclamo_id: string;
  usuario_id: string;
  texto: string;
  created_at: string;
  usuario?: {
    nombre: string;
    rol: string;
  };
}

interface JobCommentsProps {
  reclamoId: string;
}

export const JobComments: React.FC<JobCommentsProps> = ({ reclamoId }) => {
  const { profile, session } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [comments]);

  const fetchComments = async () => {
    try {
      const { data, error } = await supabase
        .from('comentarios_reclamo')
        .select(`
          *,
          usuario:usuarios(nombre, rol)
        `)
        .eq('reclamo_id', reclamoId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setComments(data || []);
    } catch (error) {
      console.error('Error fetching comments:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComments();

    // Subscribe to new comments
    const subscription = supabase
      .channel(`comments-${reclamoId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'comentarios_reclamo',
          filter: `reclamo_id=eq.${reclamoId}`,
        },
        (payload) => {
          // Fetch again to get user details properly joined
          fetchComments();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [reclamoId]);

  const handleSendComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !profile) return;

    setSending(true);
    try {
      const { error } = await supabase.from('comentarios_reclamo').insert({
        reclamo_id: reclamoId,
        usuario_id: profile.id,
        texto: newComment.trim(),
      });

      if (error) throw error;

      if (session?.access_token) {
        await sendPush({
          accessToken: session.access_token,
          targetRole: 'admin',
          title: 'Nuevo comentario',
          body: newComment.trim().slice(0, 120),
          url: '/admin'
        });
      }
      setNewComment('');
    } catch (error) {
      console.error('Error sending comment:', error);
      toast.error('Error al enviar comentario');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return <div className="p-4 text-center text-gray-500">Cargando comentarios...</div>;
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex flex-col h-[400px]">
      <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
        <h3 className="font-semibold text-gray-700">Notas y Comentarios</h3>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/30">
        {comments.length === 0 ? (
          <div className="text-center text-gray-400 py-8">
            <p>No hay comentarios aún.</p>
            <p className="text-xs">Agrega notas sobre el trabajo aquí.</p>
          </div>
        ) : (
          comments.map((comment) => {
            const isMe = comment.usuario_id === profile?.id;
            return (
              <div key={comment.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div 
                  className={`max-w-[80%] rounded-lg p-3 shadow-sm ${
                    isMe 
                      ? 'bg-blue-100 text-blue-900 rounded-br-none' 
                      : 'bg-white text-gray-800 border border-gray-200 rounded-bl-none'
                  }`}
                >
                  <div className="flex justify-between items-center mb-1 gap-2">
                    <span className="text-xs font-bold flex items-center">
                      {!isMe && <User className="w-3 h-3 mr-1" />}
                      {comment.usuario?.nombre || 'Usuario'}
                    </span>
                    <span className="text-[10px] text-gray-500 opacity-75">
                      {format(new Date(comment.created_at), 'dd/MM HH:mm')}
                    </span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{comment.texto}</p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSendComment} className="p-3 border-t border-gray-200 bg-white flex gap-2">
        <input
          type="text"
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Escribe una nota..."
          className="flex-1 border border-gray-300 rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          disabled={sending}
        />
        <button
          type="submit"
          disabled={sending || !newComment.trim()}
          className="bg-blue-600 text-white p-2 rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
        </button>
      </form>
    </div>
  );
};
