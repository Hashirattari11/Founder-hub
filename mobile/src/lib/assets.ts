export async function uriToBlob(uri: string): Promise<Blob> {
  const response = await fetch(uri)
  return await response.blob()
}
