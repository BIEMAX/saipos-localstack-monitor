// Secrets Manager service for LocalStack API
import type {
    SecretDetail,
    SecretSummary,
    SecretTag,
  } from '../../types';
  import { BaseAWSService } from './base';
  
  export class SecretsManagerService extends BaseAWSService {
    private static readonly SERVICE_PATH = '/secrets';
  
    static async isAvailable(): Promise<boolean> {
      return this.isServiceAvailable(this.SERVICE_PATH);
    }
  
    static async listSecrets(): Promise<SecretSummary[]> {
      try {
        const data = await this.makeRequest<{
          SecretList?: Array<{
            ARN?: string;
            Name?: string;
            Description?: string;
            LastChangedDate?: string;
            Tags?: SecretTag[];
          }>;
        }>(this.SERVICE_PATH);
  
        const rawSecrets = data.SecretList ?? [];
  
        return rawSecrets
          .filter((secret) => Boolean(secret.ARN) && Boolean(secret.Name))
          .map((secret) => {
            const tags: Record<string, string> = {};
            (secret.Tags ?? []).forEach((tag) => {
              if (tag.Key && typeof tag.Value === 'string') {
                tags[tag.Key] = tag.Value;
              }
            });
  
            return {
              arn: secret.ARN as string,
              name: secret.Name as string,
              description: secret.Description,
              lastChangedDate: secret.LastChangedDate,
              tags: Object.keys(tags).length > 0 ? tags : undefined,
            };
          });
      } catch (error) {
        this.handleServiceError(error, 'Secrets Manager');
      }
    }
  
    static async getSecret(secretId: string): Promise<SecretDetail> {
      try {
        const data = await this.makeRequest<{
          ARN?: string;
          Name?: string;
          Description?: string;
          LastChangedDate?: string;
          Tags?: SecretTag[];
          secretValue?: {
            SecretString?: string;
            VersionId?: string;
          } | null;
        }>(`${this.SERVICE_PATH}/${encodeURIComponent(secretId)}`);
  
        const tags: Record<string, string> = {};
        (data.Tags ?? []).forEach((tag) => {
          if (tag.Key && typeof tag.Value === 'string') {
            tags[tag.Key] = tag.Value;
          }
        });
  
        return {
          arn: data.ARN ?? secretId,
          name: data.Name ?? secretId,
          description: data.Description,
          lastChangedDate: data.LastChangedDate,
          tags: Object.keys(tags).length > 0 ? tags : undefined,
          secretString: data.secretValue?.SecretString,
          versionId: data.secretValue?.VersionId,
        };
      } catch (error) {
        this.handleServiceError(error, 'Secrets Manager');
      }
    }
  
    static async createSecret(input: {
      name: string;
      description?: string;
      tags?: SecretTag[];
      secretString?: string;
    }): Promise<void> {
      try {
        await this.makeRequest(this.SERVICE_PATH, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(input),
        });
      } catch (error) {
        this.handleServiceError(error, 'Secrets Manager');
      }
    }
  
    static async updateSecret(
      secretId: string,
      input: {
        description?: string;
        secretString?: string;
      },
    ): Promise<void> {
      try {
        await this.makeRequest(`${this.SERVICE_PATH}/${encodeURIComponent(secretId)}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(input),
        });
      } catch (error) {
        this.handleServiceError(error, 'Secrets Manager');
      }
    }
  
    static async deleteSecret(secretId: string): Promise<void> {
      try {
        await this.makeRequest(`${this.SERVICE_PATH}/${encodeURIComponent(secretId)}`, {
          method: 'DELETE',
        });
      } catch (error) {
        this.handleServiceError(error, 'Secrets Manager');
      }
    }
  }
  
  