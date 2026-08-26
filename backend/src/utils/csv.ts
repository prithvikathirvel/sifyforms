import csv from 'csv-parser';
import { Readable } from 'stream';

export interface CSVRow {
  [key: string]: string;
}

export async function parseCSVFromBuffer(buffer: Buffer): Promise<CSVRow[]> {
  return new Promise((resolve, reject) => {
    const results: CSVRow[] = [];
    const stream = Readable.from(buffer);

    stream
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', (error) => reject(error));
  });
}
