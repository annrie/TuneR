export async function fetchIcyMetadata(url: string): Promise<string> {
  if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      const title = await invoke<string>('fetch_icy_metadata', { url })
      return title ?? ''
    } catch (e) {
      console.warn('fetch_icy_metadata invoke failed:', e)
      return ''
    }
  }

  return ''
}
