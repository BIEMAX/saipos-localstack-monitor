// S3 service for LocalStack API
import type {
    S3BucketInfo,
    S3ObjectContent,
    S3ObjectInfo,
  } from '../../types';
  import { BaseAWSService } from './base';
  
  export class S3Service extends BaseAWSService {
    private static readonly SERVICE_PATH = '/s3';
  
    static async isAvailable(): Promise<boolean> {
      return this.isServiceAvailable(`${this.SERVICE_PATH}/buckets`);
    }
  
    static async listBuckets(): Promise<S3BucketInfo[]> {
      try {
        const data = await this.makeRequest<{
          Buckets?: Array<{ Name?: string; CreationDate?: string }>;
        }>(`${this.SERVICE_PATH}/buckets`);
  
        const buckets = data.Buckets ?? [];
  
        return buckets
          .filter((bucket) => Boolean(bucket.Name))
          .map((bucket) => ({
            name: bucket.Name as string,
            creationDate: bucket.CreationDate,
          }));
      } catch (error) {
        this.handleServiceError(error, 'S3');
      }
    }
  
    static async listObjects(
      bucket: string,
      options?: { prefix?: string; maxKeys?: number },
    ): Promise<S3ObjectInfo[]> {
      try {
        const params = new URLSearchParams();
  
        if (options?.prefix) {
          params.append('prefix', options.prefix);
        }
  
        if (options?.maxKeys) {
          params.append('maxKeys', String(options.maxKeys));
        }
  
        const path =
          params.toString().length > 0
            ? `${this.SERVICE_PATH}/bucket/${bucket}/objects?${params.toString()}`
            : `${this.SERVICE_PATH}/bucket/${bucket}/objects`;
  
        const data = await this.makeRequest<{
          Contents?: Array<{
            Key?: string;
            Size?: number;
            LastModified?: string;
            StorageClass?: string;
          }>;
        }>(path);
  
        const contents = data.Contents ?? [];
  
        return contents
          .filter((object) => Boolean(object.Key) && typeof object.Size === 'number')
          .map((object) => ({
            key: object.Key as string,
            size: object.Size as number,
            lastModified: object.LastModified,
            storageClass: object.StorageClass,
          }));
      } catch (error) {
        this.handleServiceError(error, 'S3');
      }
    }
  
    static async getObjectContent(bucket: string, key: string): Promise<S3ObjectContent> {
      try {
        const params = new URLSearchParams({
          bucket,
          key,
        });
  
        const data = await this.makeRequest<{
          bucket: string;
          key: string;
          size: number;
          content: string;
          isTruncated: boolean;
        }>(`${this.SERVICE_PATH}/object?${params.toString()}`);
  
        return {
          bucket: data.bucket,
          key: data.key,
          size: data.size,
          content: data.content,
          isTruncated: data.isTruncated,
        };
      } catch (error) {
        this.handleServiceError(error, 'S3');
      }
    }
  
    static async createBucket(name: string): Promise<void> {
      try {
        await this.makeRequest(`${this.SERVICE_PATH}/bucket`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name }),
        });
      } catch (error) {
        this.handleServiceError(error, 'S3');
      }
    }
  
    static async deleteBucket(name: string): Promise<void> {
      try {
        await this.makeRequest(`${this.SERVICE_PATH}/bucket/${encodeURIComponent(name)}`, {
          method: 'DELETE',
        });
      } catch (error) {
        this.handleServiceError(error, 'S3');
      }
    }
  
    static async putObject(
      bucket: string,
      key: string,
      content: string,
      contentType?: string,
    ): Promise<void> {
      try {
        await this.makeRequest(`${this.SERVICE_PATH}/object`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            bucket,
            key,
            content,
            contentType,
          }),
        });
      } catch (error) {
        this.handleServiceError(error, 'S3');
      }
    }
  
    static async deleteObject(bucket: string, key: string): Promise<void> {
      try {
        await this.makeRequest(`${this.SERVICE_PATH}/object`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            bucket,
            key,
          }),
        });
      } catch (error) {
        this.handleServiceError(error, 'S3');
      }
    }
  }
  
  