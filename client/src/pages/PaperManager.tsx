import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  ArrowLeft, Trash2, Eye, EyeOff, Plus, Loader2, FileText, Clock, CheckCircle2
} from 'lucide-react';
import { Link } from 'wouter';

const ADMIN_PASSWORD = import.meta.env.VITE_HISTORY_PASSWORD || '';

export default function PaperManager() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');

  const papersQuery = trpc.papers.list.useQuery(undefined, { enabled: isAuthenticated });
  const updatePaper = trpc.papers.update.useMutation();
  const deletePaper = trpc.papers.delete.useMutation();
  const utils = trpc.useUtils();

  const handleUnlock = () => {
    if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
    } else {
      toast.error('Incorrect password');
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <CardTitle className="text-xl">🔐 Paper Manager</CardTitle>
            <p className="text-sm text-gray-500">Enter admin password to access</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
            />
            <Button onClick={handleUnlock} className="w-full">Unlock</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleToggleStatus = async (id: number, currentStatus: string) => {
    const newStatus = currentStatus === 'published' ? 'draft' : 'published';
    try {
      await updatePaper.mutateAsync({ id, status: newStatus });
      utils.papers.list.invalidate();
      toast.success(newStatus === 'published' ? 'Paper published!' : 'Paper unpublished');
    } catch (err) {
      toast.error('Failed to update status');
    }
  };

  const handleDelete = async (id: number, title: string) => {
    if (!confirm(`Are you sure you want to delete "${title}"? This cannot be undone.`)) return;
    try {
      await deletePaper.mutateAsync({ id });
      utils.papers.list.invalidate();
      toast.success('Paper deleted');
    } catch (err) {
      toast.error('Failed to delete paper');
    }
  };

  const papers = papersQuery.data || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-1" /> Back
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-bold text-gray-900">📋 Paper Manager</h1>
              <p className="text-xs text-gray-500">Manage custom assessment papers</p>
            </div>
          </div>
          <Link href="/paper-creator">
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-1" /> Create New
            </Button>
          </Link>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {papersQuery.isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        ) : papers.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="w-12 h-12 mx-auto text-gray-300 mb-3" />
              <h3 className="text-lg font-medium text-gray-600 mb-1">No Custom Papers Yet</h3>
              <p className="text-sm text-gray-400 mb-4">
                Create your first assessment paper by uploading test materials.
              </p>
              <Link href="/paper-creator">
                <Button>
                  <Plus className="w-4 h-4 mr-1" /> Create Paper
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {papers.map((p) => (
              <Card key={p.id} className="hover:shadow-md transition-shadow">
                <CardContent className="py-4">
                  <div className="flex items-center gap-4">
                    <span className="text-3xl">{p.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900 truncate">{p.title}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          p.status === 'published'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {p.status === 'published' ? 'Published' : 'Draft'}
                        </span>
                      </div>
                      {p.subtitle && <p className="text-sm text-gray-500">{p.subtitle}</p>}
                      <div className="flex items-center gap-4 mt-1 text-xs text-gray-400">
                        <span>{p.totalQuestions} questions</span>
                        {p.hasListening && <span>🎧 Listening</span>}
                        {p.hasWriting && <span>✍️ Writing</span>}
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(p.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggleStatus(p.id, p.status)}
                        className={p.status === 'published' ? 'text-yellow-600' : 'text-green-600'}
                      >
                        {p.status === 'published' ? (
                          <><EyeOff className="w-4 h-4 mr-1" /> Unpublish</>
                        ) : (
                          <><Eye className="w-4 h-4 mr-1" /> Publish</>
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(p.id, p.title)}
                        className="text-red-400 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
