// Polygon S3 Flat Files client
// Usage: fetch candles from backend S3 route

export async function getPolygonS3Candles({ accessKeyId, secretAccessKey, endpoint, bucket, symbol, filePath }) {
  const params = new URLSearchParams({ accessKeyId, secretAccessKey, endpoint, bucket, symbol, filePath });
  const res = await fetch(`/api/polygon/s3?${params.toString()}`);
  if (!res.ok) throw new Error('Polygon S3 fetch failed');
  return res.json();
}
