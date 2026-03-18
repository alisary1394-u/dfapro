// Polygon S3 Flat Files loader
// Usage: download CSV for symbol from S3, parse to candles

const AWS = require('aws-sdk');
const csv = require('csv-parser');
const { Readable } = require('stream');

function getS3Client({ accessKeyId, secretAccessKey, endpoint, bucket }) {
  return new AWS.S3({
    accessKeyId,
    secretAccessKey,
    endpoint,
    s3ForcePathStyle: true,
    signatureVersion: 'v4',
    region: 'us-east-1',
  });
}

async function fetchCandlesFromS3({ accessKeyId, secretAccessKey, endpoint, bucket, symbol, filePath }) {
  const s3 = getS3Client({ accessKeyId, secretAccessKey, endpoint, bucket });
  const params = { Bucket: bucket, Key: filePath };
  const stream = s3.getObject(params).createReadStream();
  return new Promise((resolve, reject) => {
    const candles = [];
    stream.pipe(csv())
      .on('data', row => {
        // Example CSV columns: timestamp, open, high, low, close, volume
        candles.push({
          time: Math.floor(Number(row.timestamp) / 1000),
          open: Number(row.open),
          high: Number(row.high),
          low: Number(row.low),
          close: Number(row.close),
          volume: Number(row.volume),
        });
      })
      .on('end', () => resolve(candles))
      .on('error', reject);
  });
}

module.exports = {
  fetchCandlesFromS3,
};
