import { supabase } from './supabase'
import { uriToBlob } from './assets'

const BUCKET = 'pitch-decks'
const MAX_PITCH_DECK_SIZE_MB = 10
const MAX_BYTES = MAX_PITCH_DECK_SIZE_MB * 1024 * 1024

async function ensureBucket(): Promise<void> {
  const { data, error } = await supabase.storage.getBucket(BUCKET)
  if (error?.message?.includes('not found') || !data) {
    await supabase.storage.createBucket(BUCKET, {
      public: true,
      allowedMimeTypes: ['application/pdf'],
      fileSizeLimit: MAX_BYTES,
    })
  }
}

export async function uploadPitchDeck(uri: string, ownerId: string): Promise<string> {
  const blob = await uriToBlob(uri)
  if (!/\.pdf$/i.test(uri)) {
    throw new Error('Pitch deck must be a PDF file')
  }
  if (blob.size > MAX_BYTES) {
    throw new Error(`Pitch deck must be under ${MAX_PITCH_DECK_SIZE_MB}MB`)
  }

  await ensureBucket()

  const baseName = uri.split('/').pop() ?? 'deck.pdf'
  const path = `${ownerId}/${Date.now()}-${baseName.replace(/[^a-zA-Z0-9._-]/g, '_')}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: 'application/pdf',
    upsert: false,
  })
  if (error) throw error

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}
