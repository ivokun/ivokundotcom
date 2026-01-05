import { createSignal, createResource, Show } from 'solid-js';
import { api } from '../api';
import RichTextEditor from '../components/RichTextEditor';
import MediaPicker from '../components/MediaPicker';

interface HomePage {
  id: string;
  heroImageId: string | null;
  description: string;
  keywords: string[];
  updatedAt: string;
}

export default function Home() {
  const [heroImageId, setHeroImageId] = createSignal<string | null>(null);
  const [description, setDescription] = createSignal('');
  const [keywords, setKeywords] = createSignal<string[]>([]);
  const [keywordInput, setKeywordInput] = createSignal('');
  
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal('');
  const [success, setSuccess] = createSignal('');
  
  const [mediaPickerOpen, setMediaPickerOpen] = createSignal(false);
  
  const [homeData] = createResource(async () => {
    const data = await api.home.get() as HomePage;
    setHeroImageId(data.heroImageId);
    setDescription(data.description);
    setKeywords(data.keywords);
    return data;
  });
  
  async function handleSubmit(e: Event) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);
    
      try {
      await api.home.update({
        heroImageId: heroImageId() || undefined,
        description: description(),
        keywords: keywords(),
      });
      setSuccess('Home page updated successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update home page');
    } finally {
      setSaving(false);
    }
  }
  
  function addKeyword() {
    const kw = keywordInput().trim();
    if (kw && !keywords().includes(kw)) {
      setKeywords([...keywords(), kw]);
      setKeywordInput('');
    }
  }
  
  function removeKeyword(kw: string) {
    setKeywords(keywords().filter((k) => k !== kw));
  }
  
  return (
    <div class="p-8 max-w-4xl">
      <div class="page-header">
        <h1 class="page-title">Home Page</h1>
        <p class="page-subtitle">Edit the homepage content</p>
      </div>
      
      <Show when={error()}>
        <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-6">
          {error()}
        </div>
      </Show>
      
      <Show when={success()}>
        <div class="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm mb-6">
          {success()}
        </div>
      </Show>
      
      <form onSubmit={handleSubmit} class="space-y-6">
        <div class="card p-6 space-y-6">
          {/* Hero Image */}
          <div>
            <label class="label">Hero Image</label>
            <Show when={heroImageId()}>
              <div class="relative mb-4">
                <img
                  src={`/api/media/${heroImageId()}`}
                  alt="Hero"
                  class="w-full h-64 object-cover rounded-lg"
                />
                <button
                  type="button"
                  onClick={() => setHeroImageId(null)}
                  class="absolute top-2 right-2 p-2 bg-red-600 text-white rounded-full hover:bg-red-700"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </Show>
            <button
              type="button"
              onClick={() => setMediaPickerOpen(true)}
              class="btn btn-secondary"
            >
              {heroImageId() ? 'Change Hero Image' : 'Select Hero Image'}
            </button>
          </div>
          
          {/* Description */}
          <div>
            <label class="label">Description</label>
            <RichTextEditor
              value={description()}
              onChange={setDescription}
              placeholder="Write the homepage description..."
            />
          </div>
          
          {/* Keywords */}
          <div>
            <label class="label">Keywords</label>
            <div class="flex gap-2 mb-2">
              <input
                type="text"
                value={keywordInput()}
                onInput={(e) => setKeywordInput(e.currentTarget.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addKeyword())}
                class="input"
                placeholder="Add a keyword"
              />
              <button type="button" onClick={addKeyword} class="btn btn-secondary">
                Add
              </button>
            </div>
            <div class="flex flex-wrap gap-2">
              {keywords().map((kw) => (
                <span class="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">
                  {kw}
                  <button
                    type="button"
                    onClick={() => removeKeyword(kw)}
                    class="text-gray-400 hover:text-gray-600"
                  >
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              ))}
            </div>
          </div>
          
          {/* Submit */}
          <div class="pt-4 border-t border-gray-200">
            <button
              type="submit"
              disabled={saving()}
              class="btn btn-primary"
            >
              <Show when={!saving()} fallback={
                <span class="flex items-center gap-2">
                  <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Saving...
                </span>
              }>
                Save Changes
              </Show>
            </button>
          </div>
        </div>
      </form>
      
      <MediaPicker
        isOpen={mediaPickerOpen()}
        onClose={() => setMediaPickerOpen(false)}
        onSelect={(media) => {
          setHeroImageId(media.id);
          setMediaPickerOpen(false);
        }}
      />
    </div>
  );
}
