import { createSignal, createResource, Show, For } from 'solid-js';
import { api } from '../api';
import Modal from '../components/Modal';

interface ApiKey {
  id: string;
  name: string;
  key: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export default function Settings() {
  const [apiKeys, { refetch }] = createResource(async () => {
    const result = await api.apiKeys.list();
    return result as Array<ApiKey>;
  });
  
  const [newKeyModal, setNewKeyModal] = createSignal<{ name: string; key: string } | null>(null);
  const [deleteModal, setDeleteModal] = createSignal<ApiKey | null>(null);
  const [nameInput, setNameInput] = createSignal('');
  const [creating, setCreating] = createSignal(false);
  const [deleting, setDeleting] = createSignal(false);
  
  async function handleCreateKey(e: Event) {
    e.preventDefault();
    setCreating(true);
    
    try {
      const result = await api.apiKeys.create({ name: nameInput() });
      setNewKeyModal({ name: result.name, key: result.key });
      setNameInput('');
      refetch();
    } catch (err) {
      console.error('Failed to create API key:', err);
    } finally {
      setCreating(false);
    }
  }
  
  async function handleDeleteKey() {
    const key = deleteModal();
    if (!key) return;
    
    setDeleting(true);
    try {
      await api.apiKeys.delete(key.id);
      setDeleteModal(null);
      refetch();
    } catch (err) {
      console.error('Failed to delete API key:', err);
    } finally {
      setDeleting(false);
    }
  }
  
  function formatDate(date: string): string {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  
  return (
    <div class="p-8 max-w-4xl">
      <div class="page-header">
        <h1 class="page-title">Settings</h1>
        <p class="page-subtitle">Manage API keys and settings</p>
      </div>
      
      {/* API Keys */}
      <div class="card p-6">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-lg font-semibold text-gray-900">API Keys</h2>
          <button
            onClick={() => setNewKeyModal({ name: '', key: '' })}
            class="btn btn-primary"
          >
            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            Generate New Key
          </button>
        </div>
        
        <Show when={!apiKeys.loading} fallback={
          <div class="text-center py-8">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
          </div>
        }>
          <div class="space-y-4">
            <For each={apiKeys()}>
              {(key) => (
                <div class="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p class="font-medium text-gray-900">{key.name}</p>
                    <p class="text-sm text-gray-500">
                      Created {formatDate(key.createdAt)}
                      {key.lastUsedAt && ` • Last used ${formatDate(key.lastUsedAt)}`}
                    </p>
                  </div>
                  <button
                    onClick={() => setDeleteModal(key)}
                    class="btn btn-danger btn-sm"
                  >
                    Revoke
                  </button>
                </div>
              )}
            </For>
          </div>
          
          <Show when={apiKeys()?.length === 0}>
            <div class="text-center py-8 text-gray-500">
              <svg class="mx-auto h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
              <p class="mt-2">No API keys yet</p>
            </div>
          </Show>
        </Show>
      </div>
      
      {/* Create Key Modal */}
      <Modal
        isOpen={!!newKeyModal() && !newKeyModal()?.key}
        onClose={() => setNewKeyModal(null)}
        title="Generate API Key"
        footer={
          <button
            onClick={() => setNewKeyModal(null)}
            class="btn btn-secondary flex-1"
          >
            Close
          </button>
        }
      >
        <form onSubmit={handleCreateKey} class="space-y-4">
          <div>
            <label for="keyName" class="label">Key Name</label>
            <input
              id="keyName"
              type="text"
              value={nameInput()}
              onInput={(e) => setNameInput(e.currentTarget.value)}
              required
              class="input"
              placeholder="e.g., Production API"
            />
          </div>
          <button
            type="submit"
            disabled={creating() || !nameInput().trim()}
            class="btn btn-primary w-full"
          >
            {creating() ? 'Generating...' : 'Generate Key'}
          </button>
        </form>
      </Modal>
      
      {/* Key Created Modal */}
      <Modal
        isOpen={!!newKeyModal() && !!newKeyModal()?.key}
        onClose={() => setNewKeyModal(null)}
        title="API Key Created"
        footer={
          <button
            onClick={() => {
              navigator.clipboard.writeText(newKeyModal()!.key);
            }}
            class="btn btn-primary flex-1"
          >
            Copy to Clipboard
          </button>
        }
      >
        <div class="space-y-4">
          <p class="text-sm text-gray-600">
            Make sure to copy your API key now. You won't be able to see it again!
          </p>
          <div>
            <label class="label">Name</label>
            <p class="text-gray-900">{newKeyModal()?.name}</p>
          </div>
          <div>
            <label class="label">API Key</label>
            <code class="block p-3 bg-gray-100 rounded-lg text-sm break-all">
              {newKeyModal()?.key}
            </code>
          </div>
        </div>
      </Modal>
      
      {/* Delete Key Modal */}
      <Modal
        isOpen={!!deleteModal()}
        onClose={() => setDeleteModal(null)}
        title="Revoke API Key"
        footer={
          <>
            <button onClick={() => setDeleteModal(null)} class="btn btn-secondary flex-1">Cancel</button>
            <button onClick={handleDeleteKey} disabled={deleting()} class="btn btn-danger flex-1">
              {deleting() ? 'Revoking...' : 'Revoke Key'}
            </button>
          </>
        }
      >
        <p class="text-gray-700">
          Are you sure you want to revoke <strong>{deleteModal()?.name}</strong>?
          Any applications using this key will lose access immediately.
        </p>
      </Modal>
    </div>
  );
}
