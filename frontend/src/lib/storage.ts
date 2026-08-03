import { supabase } from './supabase'
import { MAX_PITCH_DECK_SIZE_MB } from './constants'

const BUCKET = 'pitch-decks'
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

/**
 * Upload a pitch deck (PDF only) and return its public URL.
 * Throws a friendly error for invalid files.
 */
export async function uploadPitchDeck(file: File, ownerId: string): Promise<string> {
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    throw new Error('Pitch deck must be a PDF file')
  }
  if (file.size > MAX_BYTES) {
    throw new Error(`Pitch deck must be under ${MAX_PITCH_DECK_SIZE_MB}MB`)
  }

  await ensureBucket()

  const path = `${ownerId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: 'application/pdf',
    upsert: false,
  })
  if (error) throw error

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}
