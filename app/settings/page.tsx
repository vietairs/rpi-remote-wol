'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface ApiKey {
  id: number;
  name: string;
  created_at: string;
  last_used_at: string | null;
}

export default function Settings() {
  const router = useRouter();
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [newKeyName, setNewKeyName] = useState<string>('');
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [status, setStatus] = useState<string>('');
  const [currentUser, setCurrentUser] = useState<string>('');
  const [showCreateForm, setShowCreateForm] = useState<boolean>(false);

  useEffect(() => {
    checkSession();
    loadApiKeys();
  }, []);

  const checkSession = async () => {
    try {
      const response = await fetch('/api/auth/session');
      const data = await response.json();
      if (data.authenticated && data.user) {
        setCurrentUser(data.user.username);
      }
    } catch (error) {
      console.error('Failed to check session:', error);
    }
  };

  const loadApiKeys = async () => {
    try {
      const response = await fetch('/api/keys');
      const data = await response.json();
      if (response.ok) {
        setApiKeys(data.keys);
      }
    } catch (error) {
      console.error('Failed to load API keys:', error);
    }
  };

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) {
      setStatus('Please enter a name for the API key');
      return;
    }

    setLoading(true);
    setStatus('');

    try {
      const response = await fetch('/api/keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: newKeyName }),
      });

      const data = await response.json();

      if (response.ok) {
        setGeneratedKey(data.key);
        setNewKeyName('');
        setShowCreateForm(false);
        await loadApiKeys();
        setStatus('API key created successfully! Make sure to copy it now - you will not see it again.');
      } else {
        setStatus(`Error: ${data.error}`);
      }
    } catch (error) {
      setStatus('Failed to create API key');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteKey = async (id: number) => {
    if (!confirm('Are you sure you want to delete this API key? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/keys/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setStatus('API key deleted successfully');
        await loadApiKeys();
      } else {
        const data = await response.json();
        setStatus(`Error: ${data.error}`);
      }
    } catch (error) {
      setStatus('Failed to delete API key');
      console.error(error);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setStatus('API key copied to clipboard!');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 flex items-center justify-center p-4">
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-8 w-full max-w-4xl border border-white/20">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
            <p className="text-blue-200">Manage your API keys</p>
          </div>
          <div className="flex items-center gap-4">
            {currentUser && (
              <span className="text-blue-200 text-sm">{currentUser}</span>
            )}
            <button
              onClick={() => router.push('/')}
              className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-200 hover:text-blue-100 border border-blue-500/50 rounded-lg transition-colors text-sm font-medium"
            >
              ← Back
            </button>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-200 hover:text-red-100 border border-red-500/50 rounded-lg transition-colors text-sm font-medium"
              title="Logout"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Generated Key Display */}
        {generatedKey && (
          <div className="mb-6 p-6 bg-green-500/20 border border-green-500/50 rounded-lg">
            <h3 className="text-green-100 font-semibold mb-2 flex items-center gap-2">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              API Key Generated Successfully!
            </h3>
            <p className="text-green-100 text-sm mb-3">
              ⚠️ Make sure to copy this key now - you will not be able to see it again!
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={generatedKey}
                readOnly
                className="flex-1 px-4 py-3 bg-white/10 border border-green-500/50 rounded-lg text-white font-mono text-sm"
              />
              <button
                onClick={() => copyToClipboard(generatedKey)}
                className="px-6 py-3 bg-green-500 hover:bg-green-600 text-white font-medium rounded-lg transition-colors"
              >
                📋 Copy
              </button>
            </div>
            <button
              onClick={() => setGeneratedKey(null)}
              className="mt-3 text-green-200 hover:text-green-100 text-sm underline"
            >
              I've saved the key
            </button>
          </div>
        )}

        {/* API Keys Section */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-white font-semibold text-xl">API Keys</h2>
            {!showCreateForm && (
              <button
                onClick={() => setShowCreateForm(true)}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors"
              >
                + Create API Key
              </button>
            )}
          </div>

          {/* Create API Key Form */}
          {showCreateForm && (
            <div className="mb-4 p-4 bg-blue-500/10 rounded-lg border border-blue-500/30">
              <h3 className="text-white font-medium mb-3">Create New API Key</h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="API Key Name (e.g., Homebridge Integration)"
                  className="flex-1 px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white placeholder-blue-300/50 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  onKeyPress={(e) => e.key === 'Enter' && handleCreateKey()}
                />
                <button
                  onClick={handleCreateKey}
                  disabled={loading}
                  className="px-6 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-500 text-white font-medium rounded-lg transition-colors disabled:cursor-not-allowed"
                >
                  {loading ? 'Creating...' : 'Create'}
                </button>
                <button
                  onClick={() => {
                    setShowCreateForm(false);
                    setNewKeyName('');
                  }}
                  className="px-6 py-2 bg-red-500 hover:bg-red-600 text-white font-medium rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* API Keys List */}
          <div className="space-y-2">
            {apiKeys.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-blue-200 mb-2">No API keys yet</p>
                <p className="text-blue-300 text-sm">Create an API key to use with Homebridge or other integrations</p>
              </div>
            ) : (
              apiKeys.map((key) => (
                <div
                  key={key.id}
                  className="p-4 bg-white/5 border border-white/20 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h4 className="text-white font-medium mb-1">{key.name}</h4>
                      <div className="text-blue-200 text-xs space-y-1">
                        <p>Created: {formatDate(key.created_at)}</p>
                        <p>
                          Last used: {key.last_used_at ? formatDate(key.last_used_at) : 'Never'}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteKey(key.id)}
                      className="text-red-300 hover:text-red-100 transition-colors p-2"
                      title="Delete API key"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Status Message */}
        {status && (
          <div
            className={`mt-6 p-4 rounded-lg ${
              status.includes('Success') || status.includes('created') || status.includes('copied')
                ? 'bg-green-500/20 border border-green-500/50 text-green-100'
                : status.includes('Error') || status.includes('Failed')
                ? 'bg-red-500/20 border border-red-500/50 text-red-100'
                : 'bg-blue-500/20 border border-blue-500/50 text-blue-100'
            }`}
          >
            <p className="text-sm text-center">{status}</p>
          </div>
        )}

        {/* Information Section */}
        <div className="mt-8 pt-6 border-t border-white/20">
          <h2 className="text-white font-semibold mb-3">About API Keys</h2>
          <div className="text-sm text-blue-200 space-y-2">
            <p>
              • API keys allow external applications (like Homebridge) to access your PC Remote Wake API
            </p>
            <p>
              • Keys are only shown once when created - make sure to save them securely
            </p>
            <p>
              • Use the format: <code className="px-2 py-1 bg-white/10 rounded">Authorization: Bearer pcw_xxx</code>
            </p>
            <p>
              • You can create multiple keys for different integrations and revoke them individually
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
