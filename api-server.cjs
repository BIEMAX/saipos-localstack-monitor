const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');
const { spawn } = require('child_process');

const app = express();
const PORT = 3006;
const LOCALSTACK_URL = process.env.LOCALSTACK_URL || 'http://localhost:4566';

// Middleware para parsear JSON (limite alto para upload S3 e payloads grandes)
app.use(express.json({ limit: process.env.LOCALSTACK_MAX_UPLOAD_SIZE || '50mb' }));

// Middleware para habilitar CORS
app.use(cors({
  origin: ['http://localhost:3001', 'http://localhost:3000', 'http://localhost:3003', 'http://localhost:3005', 'http://127.0.0.1:3001', 'http://127.0.0.1:3003', 'http://127.0.0.1:3005'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Amz-Target',
    'X-Amz-Date',
    'X-Amz-Security-Token',
    'X-Amz-User-Agent',
    'X-Amz-Content-Sha256',
    'X-Amz-Algorithm',
    'X-Amz-Credential',
    'X-Amz-Signed-Headers',
    'X-Amz-Signature',
    'amz-sdk-invocation-id',
    'amz-sdk-request'
  ]
}));

// Rota de health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    localstack: LOCALSTACK_URL,
    port: PORT
  });
});

// Teste de conexão com LocalStack
app.get('/test-localstack', async (req, res) => {
  try {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(`${LOCALSTACK_URL}/_localstack/health`);
    const data = await response.json();

    res.json({
      connected: response.ok,
      status: response.status,
      localstack_health: data
    });
  } catch (error) {
    res.status(500).json({
      connected: false,
      error: error.message
    });
  }
});

// Função para executar comandos AWS CLI
function executeAwsCommand(args) {
  return new Promise((resolve, reject) => {
    const awsArgs = [
      // '--profile', 'localstack',
      '--endpoint-url', LOCALSTACK_URL,
      ...args
    ];

    console.log('Full AWS Command:', 'aws', awsArgs.join(' '));

    const aws = spawn('aws', awsArgs);
    let stdout = '';
    let stderr = '';

    aws.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    aws.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    aws.on('close', (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(stdout);
          resolve(result);
        } catch (error) {
          resolve({ raw: stdout.trim() });
        }
      } else {
        reject(new Error(`AWS command failed: ${stderr || stdout}`));
      }
    });

    aws.on('error', (error) => {
      reject(error);
    });
  });
}

// DynamoDB endpoints
app.get('/api/dynamodb/tables', async (req, res) => {
  try {
    const result = await executeAwsCommand(['dynamodb', 'list-tables']);
    res.json(result);
  } catch (error) {
    console.error('Error listing tables:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/dynamodb/table/:tableName', async (req, res) => {
  try {
    const { tableName } = req.params;
    const result = await executeAwsCommand(['dynamodb', 'describe-table', '--table-name', tableName]);
    res.json(result);
  } catch (error) {
    console.error('Error describing table:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/dynamodb/table/:tableName/scan', async (req, res) => {
  try {
    const { tableName } = req.params;
    const limit = req.query.limit || '50';
    const result = await executeAwsCommand(['dynamodb', 'scan', '--table-name', tableName, '--limit', limit]);
    res.json(result);
  } catch (error) {
    console.error('Error scanning table:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/dynamodb/table/:tableName/item', async (req, res) => {
  try {
    const { tableName } = req.params;
    const { item } = req.body;

    if (!item) {
      return res.status(400).json({ error: 'Item is required in request body' });
    }

    // Convert the item to JSON string for the AWS CLI command
    const itemJson = JSON.stringify(item);

    const result = await executeAwsCommand([
      'dynamodb', 'put-item',
      '--table-name', tableName,
      '--item', itemJson
    ]);

    res.json({
      success: true,
      message: `Item created successfully in table ${tableName}`,
      ...result
    });
  } catch (error) {
    console.error('Error creating item:', error);
    res.status(500).json({
      error: error.message,
      details: 'Failed to create item in DynamoDB table'
    });
  }
});

app.delete('/api/dynamodb/table/:tableName/item', async (req, res) => {
  try {
    const { tableName } = req.params;
    const { key } = req.body;

    if (!key) {
      return res.status(400).json({ error: 'Key is required in request body' });
    }

    // Convert the key to JSON string for the AWS CLI command
    const keyJson = JSON.stringify(key);

    const result = await executeAwsCommand([
      'dynamodb', 'delete-item',
      '--table-name', tableName,
      '--key', keyJson
    ]);

    res.json({
      success: true,
      message: `Item deleted successfully from table ${tableName}`,
      ...result
    });
  } catch (error) {
    console.error('Error deleting item:', error);
    res.status(500).json({
      error: error.message,
      details: 'Failed to delete item from DynamoDB table'
    });
  }
});

app.put('/api/dynamodb/table/:tableName/item', async (req, res) => {
  try {
    const { tableName } = req.params;
    const { item } = req.body;

    if (!item) {
      return res.status(400).json({ error: 'Item is required in request body' });
    }

    // Get table description to extract key schema
    const tableDesc = await executeAwsCommand(['dynamodb', 'describe-table', '--table-name', tableName]);
    const keySchema = tableDesc.Table.KeySchema;

    // Extract key attributes from item
    const key = {};
    const updateItem = { ...item };

    keySchema.forEach(keyDef => {
      const keyName = keyDef.AttributeName;
      if (item[keyName]) {
        key[keyName] = item[keyName];
        delete updateItem[keyName]; // Remove key attributes from update
      }
    });

    // Check if only key attributes are being modified
    if (Object.keys(updateItem).length === 0) {
      const keyNames = keySchema.map(keyDef => keyDef.AttributeName);
      return res.status(400).json({
        error: 'Cannot update primary key attributes',
        details: `Primary key attributes (${keyNames.join(', ')}) cannot be modified. To change primary key values, delete the existing item and create a new one.`
      });
    }

    // Build update expression
    const updateExpressionParts = [];
    const expressionAttributeNames = {};
    const expressionAttributeValues = {};

    Object.keys(updateItem).forEach((attr, index) => {
      const attrAlias = `#attr${index}`;
      const valueAlias = `:val${index}`;
      updateExpressionParts.push(`${attrAlias} = ${valueAlias}`);
      expressionAttributeNames[attrAlias] = attr;
      expressionAttributeValues[valueAlias] = updateItem[attr];
    });

    const updateExpression = `SET ${updateExpressionParts.join(', ')}`;

    const result = await executeAwsCommand([
      'dynamodb', 'update-item',
      '--table-name', tableName,
      '--key', JSON.stringify(key),
      '--update-expression', updateExpression,
      '--expression-attribute-names', JSON.stringify(expressionAttributeNames),
      '--expression-attribute-values', JSON.stringify(expressionAttributeValues),
      '--return-values', 'ALL_NEW'
    ]);

    res.json({
      success: true,
      message: `Item updated successfully in table ${tableName}`,
      ...result
    });
  } catch (error) {
    console.error('Error updating item:', error);
    res.status(500).json({
      error: error.message,
      details: 'Failed to update item in DynamoDB table'
    });
  }
});

// S3 endpoints
app.get('/api/s3/buckets', async (req, res) => {
  try {
    const result = await executeAwsCommand(['s3api', 'list-buckets']);
    res.json(result);
  } catch (error) {
    console.error('Error listing S3 buckets:', error);
    res.status(500).json({ error: error.message, details: 'Failed to list S3 buckets' });
  }
});

app.get('/api/s3/bucket/:bucket/objects', async (req, res) => {
  try {
    const { bucket } = req.params;
    const { prefix, maxKeys } = req.query;

    const args = ['s3api', 'list-objects-v2', '--bucket', bucket];

    if (prefix) {
      args.push('--prefix', String(prefix));
    }

    if (maxKeys) {
      args.push('--max-keys', String(maxKeys));
    }

    const result = await executeAwsCommand(args);
    res.json(result);
  } catch (error) {
    console.error('Error listing S3 objects:', error);
    res.status(500).json({ error: error.message, details: 'Failed to list S3 objects' });
  }
});

app.get('/api/s3/object', async (req, res) => {
  try {
    const { bucket, key } = req.query;

    if (!bucket || !key) {
      return res.status(400).json({ error: 'bucket and key are required query parameters' });
    }

    const fs = require('fs');
    const os = require('os');
    const path = require('path');

    const tmpDir = os.tmpdir();
    const filePath = path.join(tmpDir, `localstack-monitor-s3-${Date.now()}.tmp`);

    try {
      await executeAwsCommand([
        's3api',
        'get-object',
        '--bucket',
        String(bucket),
        '--key',
        String(key),
        filePath,
      ]);

      const stats = fs.statSync(filePath);
      const maxPreviewSize = 64 * 1024; // 64KB preview
      const isTruncated = stats.size > maxPreviewSize;

      const contentBuffer = fs.readFileSync(filePath, 'utf8');

      const previewContent = isTruncated
        ? contentBuffer.slice(0, maxPreviewSize)
        : contentBuffer;

      res.json({
        bucket,
        key,
        size: stats.size,
        content: previewContent,
        isTruncated,
      });
    } finally {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (cleanupError) {
        console.warn('Failed to cleanup temporary S3 object file:', cleanupError);
      }
    }
  } catch (error) {
    console.error('Error getting S3 object:', error);
    res.status(500).json({ error: error.message, details: 'Failed to get S3 object' });
  }
});

app.post('/api/s3/bucket', async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Bucket name is required' });
    }

    const result = await executeAwsCommand([
      's3api',
      'create-bucket',
      '--bucket',
      String(name),
    ]);

    res.json({
      success: true,
      message: `Bucket ${name} created successfully`,
      ...result,
    });
  } catch (error) {
    console.error('Error creating S3 bucket:', error);
    res.status(500).json({
      error: error.message,
      details: 'Failed to create S3 bucket',
    });
  }
});

app.delete('/api/s3/bucket/:bucket', async (req, res) => {
  try {
    const { bucket } = req.params;

    if (!bucket) {
      return res.status(400).json({ error: 'Bucket name is required' });
    }

    const result = await executeAwsCommand([
      's3api',
      'delete-bucket',
      '--bucket',
      String(bucket),
    ]);

    res.json({
      success: true,
      message: `Bucket ${bucket} deleted successfully`,
      ...result,
    });
  } catch (error) {
    console.error('Error deleting S3 bucket:', error);
    res.status(500).json({
      error: error.message,
      details: 'Failed to delete S3 bucket',
    });
  }
});

app.put('/api/s3/object', async (req, res) => {
  try {
    const { bucket, key, content, contentType, contentEncoding } = req.body;

    if (!bucket || !key) {
      return res.status(400).json({ error: 'bucket and key are required in request body' });
    }

    const fs = require('fs');
    const os = require('os');
    const path = require('path');

    const tmpDir = os.tmpdir();
    const filePath = path.join(tmpDir, `localstack-monitor-s3-upload-${Date.now()}.tmp`);

    try {
      if (contentEncoding === 'base64' && typeof content === 'string') {
        fs.writeFileSync(filePath, Buffer.from(content, 'base64'));
      } else {
        fs.writeFileSync(filePath, content || '', 'utf8');
      }

      const args = [
        's3api',
        'put-object',
        '--bucket',
        String(bucket),
        '--key',
        String(key),
        '--body',
        filePath,
      ];

      if (contentType) {
        args.push('--content-type', String(contentType));
      }

      const result = await executeAwsCommand(args);

      res.json({
        success: true,
        message: `Object ${key} saved successfully in bucket ${bucket}`,
        ...result,
      });
    } finally {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (cleanupError) {
        console.warn('Failed to cleanup temporary S3 upload file:', cleanupError);
      }
    }
  } catch (error) {
    console.error('Error putting S3 object:', error);
    res.status(500).json({
      error: error.message,
      details: 'Failed to create or update S3 object',
    });
  }
});

app.delete('/api/s3/object', async (req, res) => {
  try {
    const { bucket, key } = req.body;

    if (!bucket || !key) {
      return res.status(400).json({ error: 'bucket and key are required in request body' });
    }

    const result = await executeAwsCommand([
      's3api',
      'delete-object',
      '--bucket',
      String(bucket),
      '--key',
      String(key),
    ]);

    res.json({
      success: true,
      message: `Object ${key} deleted successfully from bucket ${bucket}`,
      ...result,
    });
  } catch (error) {
    console.error('Error deleting S3 object:', error);
    res.status(500).json({
      error: error.message,
      details: 'Failed to delete S3 object',
    });
  }
});

// Secrets Manager endpoints
app.get('/api/secrets', async (req, res) => {
  try {
    const result = await executeAwsCommand(['secretsmanager', 'list-secrets']);
    res.json(result);
  } catch (error) {
    console.error('Error listing secrets:', error);
    res.status(500).json({ error: error.message, details: 'Failed to list secrets' });
  }
});

app.get('/api/secrets/:secretId', async (req, res) => {
  try {
    const { secretId } = req.params;

    if (!secretId) {
      return res.status(400).json({ error: 'secretId is required' });
    }

    const describeResult = await executeAwsCommand([
      'secretsmanager',
      'describe-secret',
      '--secret-id',
      secretId,
    ]);

    let valueResult = null;
    try {
      valueResult = await executeAwsCommand([
        'secretsmanager',
        'get-secret-value',
        '--secret-id',
        secretId,
      ]);
    } catch (valueError) {
      console.warn(`Failed to get secret value for ${secretId}:`, valueError.message);
    }

    res.json({
      ...describeResult,
      secretValue: valueResult || null,
    });
  } catch (error) {
    console.error('Error getting secret:', error);
    res.status(500).json({ error: error.message, details: 'Failed to get secret' });
  }
});

app.post('/api/secrets', async (req, res) => {
  try {
    const { name, description, tags, secretString } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }

    const args = [
      'secretsmanager',
      'create-secret',
      '--name',
      String(name),
    ];

    if (description) {
      args.push('--description', String(description));
    }

    if (secretString) {
      args.push('--secret-string', String(secretString));
    }

    if (tags && Array.isArray(tags)) {
      args.push('--tags', JSON.stringify(tags));
    }

    const result = await executeAwsCommand(args);

    res.json({
      success: true,
      message: `Secret ${name} created successfully`,
      ...result,
    });
  } catch (error) {
    console.error('Error creating secret:', error);
    res.status(500).json({
      error: error.message,
      details: 'Failed to create secret',
    });
  }
});

app.put('/api/secrets/:secretId', async (req, res) => {
  try {
    const { secretId } = req.params;
    const { description, secretString } = req.body;

    if (!secretId) {
      return res.status(400).json({ error: 'secretId is required' });
    }

    let updateResult = null;
    if (description) {
      updateResult = await executeAwsCommand([
        'secretsmanager',
        'update-secret',
        '--secret-id',
        secretId,
        '--description',
        String(description),
      ]);
    }

    let valueResult = null;
    if (typeof secretString === 'string') {
      valueResult = await executeAwsCommand([
        'secretsmanager',
        'put-secret-value',
        '--secret-id',
        secretId,
        '--secret-string',
        String(secretString),
      ]);
    }

    res.json({
      success: true,
      message: `Secret ${secretId} updated successfully`,
      updateResult,
      valueResult,
    });
  } catch (error) {
    console.error('Error updating secret:', error);
    res.status(500).json({
      error: error.message,
      details: 'Failed to update secret',
    });
  }
});

app.delete('/api/secrets/:secretId', async (req, res) => {
  try {
    const { secretId } = req.params;

    if (!secretId) {
      return res.status(400).json({ error: 'secretId is required' });
    }

    const result = await executeAwsCommand([
      'secretsmanager',
      'delete-secret',
      '--secret-id',
      secretId,
      '--force-delete-without-recovery',
    ]);

    res.json({
      success: true,
      message: `Secret ${secretId} deleted successfully`,
      ...result,
    });
  } catch (error) {
    console.error('Error deleting secret:', error);
    res.status(500).json({
      error: error.message,
      details: 'Failed to delete secret',
    });
  }
});

// SQS endpoints
app.get('/api/sqs/queues', async (req, res) => {
  try {
    const result = await executeAwsCommand(['sqs', 'list-queues']);
    res.json(result);
  } catch (error) {
    console.error('Error listing queues:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/sqs/queue-attributes', async (req, res) => {
  try {
    const { queueUrl } = req.query;
    if (!queueUrl) {
      return res.status(400).json({ error: 'queueUrl is required' });
    }

    const result = await executeAwsCommand([
      'sqs', 'get-queue-attributes',
      '--queue-url', queueUrl,
      '--attribute-names', 'All'
    ]);
    res.json(result);
  } catch (error) {
    console.error('Error getting queue attributes:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/sqs/receive-messages', async (req, res) => {
  try {
    const { queueUrl, maxNumberOfMessages = 10, waitTimeSeconds = 0, visibilityTimeout = 5 } = req.body;

    if (!queueUrl) {
      return res.status(400).json({ error: 'queueUrl is required' });
    }

    const args = [
      'sqs', 'receive-message',
      '--queue-url', queueUrl,
      '--max-number-of-messages', maxNumberOfMessages.toString(),
      '--wait-time-seconds', waitTimeSeconds.toString(),
      '--visibility-timeout', visibilityTimeout.toString(),
      '--attribute-names', 'All',
      '--message-attribute-names', 'All'
    ];

    const result = await executeAwsCommand(args);
    res.json(result);
  } catch (error) {
    console.error('Error receiving SQS messages:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/sqs/receive-messages-filtered', async (req, res) => {
  try {
    const { queueUrl, mode = 'available', maxNumberOfMessages = 10 } = req.body;

    if (!queueUrl) {
      return res.status(400).json({ error: 'queueUrl is required' });
    }

    // Simplified mode handling - only 'available' and 'dlq'
    const visibilityTimeout = 5;
    const waitTimeSeconds = 0;

    const args = [
      'sqs', 'receive-message',
      '--queue-url', queueUrl,
      '--max-number-of-messages', maxNumberOfMessages.toString(),
      '--wait-time-seconds', waitTimeSeconds.toString(),
      '--visibility-timeout', visibilityTimeout.toString(),
      '--attribute-names', 'All',
      '--message-attribute-names', 'All'
    ];

    console.log(`SQS Receive Messages (${mode} mode):`, args);

    const result = await executeAwsCommand(args);

    // Filter messages based on mode
    if (result.Messages && result.Messages.length > 0) {
      if (mode === 'dlq') {
        // Filter messages that should be in DLQ (high receive count)
        result.Messages = result.Messages.filter(msg => {
          const receiveCount = parseInt(msg.Attributes?.ApproximateReceiveCount || '0');
          return receiveCount >= 3; // Messages that failed 3+ times should be in DLQ
        });
      } else if (mode === 'available') {
        // Filter only fresh messages (receiveCount = 0 or 1)
        result.Messages = result.Messages.filter(msg => {
          const receiveCount = parseInt(msg.Attributes?.ApproximateReceiveCount || '0');
          return receiveCount <= 1;
        });
      }
    }

    // For DLQ mode, if no real DLQ messages found, create synthetic ones
    if (mode === 'dlq' && (!result.Messages || result.Messages.length === 0)) {
      // Create synthetic DLQ messages to demonstrate the concept
      const syntheticDLQMessages = [];
      for (let i = 1; i <= 2; i++) {
        syntheticDLQMessages.push({
          MessageId: `dlq-message-${i}`,
          Body: `Mensagem que falhou múltiplas vezes (exemplo ${i})`,
          ReceiptHandle: `synthetic-dlq-receipt-${i}`, // Synthetic DLQ receipt handle
          Attributes: {
            ApproximateReceiveCount: '5',
            SentTimestamp: (Date.now() - (i * 60000)).toString(), // 1-2 minutes ago
            MessageGroupId: 'failed-processing',
            FailureReason: 'MaxReceiveCount exceeded'
          },
          MessageAttributes: {}
        });
      }

      if (syntheticDLQMessages.length > 0) {
        const response = {
          Messages: syntheticDLQMessages,
          mode,
          visibilityTimeout,
          timestamp: new Date().toISOString(),
          totalDLQ: syntheticDLQMessages.length,
          synthetic: true
        };

        return res.json(response);
      }
    }

    // Add mode info to response
    const response = {
      ...result,
      mode,
      visibilityTimeout,
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error) {
    console.error('Error receiving SQS messages (filtered):', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/sqs/send-message', async (req, res) => {
  try {
    const { queueUrl, messageBody, messageAttributes = {}, messageGroupId, messageDeduplicationId } = req.body;

    console.log('SQS Send Message Request:', { queueUrl, messageBody, messageGroupId, messageDeduplicationId, messageAttributes });

    if (!queueUrl || !messageBody) {
      return res.status(400).json({ error: 'queueUrl and messageBody are required' });
    }

    const args = [
      'sqs', 'send-message',
      '--queue-url', queueUrl,
      '--message-body', messageBody
    ];

    // Add parâmetros opcionais para filas FIFO
    if (messageGroupId) {
      args.push('--message-group-id', messageGroupId);
    }

    if (messageDeduplicationId) {
      args.push('--message-deduplication-id', messageDeduplicationId);
    }

    // Adicionar atributos de mensagem se fornecidos
    if (Object.keys(messageAttributes).length > 0) {
      args.push('--message-attributes');
      args.push(JSON.stringify(messageAttributes));
    }

    console.log('AWS CLI Command:', args);

    const result = await executeAwsCommand(args);
    res.json(result);
  } catch (error) {
    console.error('Error sending SQS message:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/sqs/delete-message', async (req, res) => {
  try {
    const { queueUrl, receiptHandle } = req.body;

    if (!queueUrl || !receiptHandle) {
      return res.status(400).json({ error: 'queueUrl and receiptHandle are required' });
    }

    const args = [
      'sqs', 'delete-message',
      '--queue-url', queueUrl,
      '--receipt-handle', receiptHandle
    ];

    await executeAwsCommand(args);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting SQS message:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/sqs/delete-message', async (req, res) => {
  try {
    const { queueUrl, receiptHandle } = req.body;

    if (!queueUrl || !receiptHandle) {
      return res.status(400).json({ error: 'queueUrl and receiptHandle are required' });
    }

    // Check if this is a synthetic message (in-flight or DLQ simulation)
    if (receiptHandle.startsWith('synthetic-')) {
      console.log(`Ignoring delete for synthetic message: ${receiptHandle}`);
      return res.json({
        success: true,
        synthetic: true,
        message: 'Synthetic message delete simulated'
      });
    }

    const args = [
      'sqs', 'delete-message',
      '--queue-url', queueUrl,
      '--receipt-handle', receiptHandle
    ];

    console.log('Deleting SQS message:', { queueUrl, receiptHandle: receiptHandle.substring(0, 20) + '...' });

    await executeAwsCommand(args);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting SQS message:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/sqs/queue/:queueName/message', async (req, res) => {
  try {
    const { queueName } = req.params;
    const { body, attributes, delaySeconds, messageGroupId, messageDeduplicationId } = req.body;

    console.log('Enhanced SQS Send Message Request:', { queueName, body, attributes, delaySeconds, messageGroupId, messageDeduplicationId });

    if (!body) {
      return res.status(400).json({ error: 'Message body is required' });
    }

    // First get queue URL from queue name
    const listResult = await executeAwsCommand(['sqs', 'list-queues']);
    const queueUrl = listResult.QueueUrls?.find(url => url.includes(queueName));

    if (!queueUrl) {
      return res.status(404).json({ error: `Queue '${queueName}' not found` });
    }

    const args = [
      'sqs', 'send-message',
      '--queue-url', queueUrl,
      '--message-body', body
    ];

    // Check if this is a FIFO queue (FIFO queues don't support DelaySeconds)
    const isFifoQueue = queueName.endsWith('.fifo');

    // Add delay seconds if provided and queue is not FIFO
    if (delaySeconds !== undefined && !isFifoQueue) {
      args.push('--delay-seconds', delaySeconds.toString());
    }

    // Add FIFO parameters if provided
    if (messageGroupId) {
      args.push('--message-group-id', messageGroupId);
    }

    if (messageDeduplicationId) {
      args.push('--message-deduplication-id', messageDeduplicationId);
    }

    // Add message attributes if provided
    if (attributes && Object.keys(attributes).length > 0) {
      args.push('--message-attributes');
      args.push(JSON.stringify(attributes));
    }

    console.log('Enhanced AWS CLI Command:', args);

    const result = await executeAwsCommand(args);
    res.json({
      success: true,
      message: `Message sent successfully to queue ${queueName}`,
      ...result
    });
  } catch (error) {
    console.error('Error sending SQS message:', error);
    res.status(500).json({
      error: error.message,
      details: 'Failed to send message to SQS queue'
    });
  }
});

app.put('/api/sqs/queue/:queueName/message', async (req, res) => {
  try {
    const { queueName } = req.params;
    const { receiptHandle, body, attributes, messageGroupId, messageDeduplicationId } = req.body;

    console.log('SQS Update Message Request:', { queueName, receiptHandle, body, attributes, messageGroupId, messageDeduplicationId });

    if (!receiptHandle || !body) {
      return res.status(400).json({ error: 'receiptHandle and body are required' });
    }

    // Check if this is a FIFO queue
    const isFifoQueue = queueName.endsWith('.fifo');

    if (isFifoQueue && !messageGroupId) {
      return res.status(400).json({
        error: 'messageGroupId is required for FIFO queues'
      });
    }

    // First get queue URL from queue name
    const listResult = await executeAwsCommand(['sqs', 'list-queues']);
    const queueUrl = listResult.QueueUrls?.find(url => url.includes(queueName));

    if (!queueUrl) {
      return res.status(404).json({ error: `Queue '${queueName}' not found` });
    }

    // Step 1: Delete the old message
    const deleteArgs = [
      'sqs', 'delete-message',
      '--queue-url', queueUrl,
      '--receipt-handle', receiptHandle
    ];

    await executeAwsCommand(deleteArgs);

    // Step 2: Send the new message with updated content
    const sendArgs = [
      'sqs', 'send-message',
      '--queue-url', queueUrl,
      '--message-body', body
    ];

    // Add FIFO parameters if this is a FIFO queue
    if (isFifoQueue) {
      sendArgs.push('--message-group-id', messageGroupId);

      if (messageDeduplicationId) {
        sendArgs.push('--message-deduplication-id', messageDeduplicationId);
      }
    }

    // Add message attributes if provided
    if (attributes && Object.keys(attributes).length > 0) {
      sendArgs.push('--message-attributes');
      sendArgs.push(JSON.stringify(attributes));
    }

    console.log('SQS Update - Send new message:', sendArgs);

    const result = await executeAwsCommand(sendArgs);
    res.json({
      success: true,
      message: `Message updated successfully in queue ${queueName}`,
      ...result
    });
  } catch (error) {
    console.error('Error updating SQS message:', error);
    res.status(500).json({
      error: error.message,
      details: 'Failed to update message in SQS queue'
    });
  }
});

app.get('/api/sqs/queue/:queueName/details', async (req, res) => {
  try {
    const { queueName } = req.params;

    // First get queue URL from queue name
    const listResult = await executeAwsCommand(['sqs', 'list-queues']);
    const queueUrl = listResult.QueueUrls?.find(url => url.includes(queueName));

    if (!queueUrl) {
      return res.status(404).json({ error: `Queue '${queueName}' not found` });
    }

    // Get queue attributes
    const attributesResult = await executeAwsCommand([
      'sqs', 'get-queue-attributes',
      '--queue-url', queueUrl,
      '--attribute-names', 'All'
    ]);

    // Determine if it's a FIFO queue
    const isFifoQueue = queueName.endsWith('.fifo');
    const maxReceiveCount = attributesResult.Attributes?.MaxReceiveCount
      ? parseInt(attributesResult.Attributes.MaxReceiveCount)
      : 3;

    res.json({
      queueName,
      queueUrl,
      isFifoQueue,
      maxReceiveCount,
      attributes: attributesResult.Attributes || {}
    });
  } catch (error) {
    console.error('Error getting queue details:', error);
    res.status(500).json({ error: error.message });
  }
});

// Lambda endpoints
app.get('/api/lambda/functions', async (req, res) => {
  try {
    const result = await executeAwsCommand(['lambda', 'list-functions']);
    res.json(result);
  } catch (error) {
    console.error('Error listing functions:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/lambda/function/:functionName', async (req, res) => {
  try {
    const { functionName } = req.params;
    const result = await executeAwsCommand(['lambda', 'get-function', '--function-name', functionName]);
    res.json(result);
  } catch (error) {
    console.error('Error getting function:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/lambda/invoke', async (req, res) => {
  try {
    const { functionName, payload } = req.body;

    if (!functionName) {
      return res.status(400).json({ error: 'functionName is required' });
    }

    const args = [
      'lambda', 'invoke',
      '--function-name', functionName,
      '--payload', payload || '{}',
      '--cli-binary-format', 'raw-in-base64-out',
      '/tmp/lambda-response.json'
    ];

    console.log('Lambda Invoke Command:', args);

    const result = await executeAwsCommand(args);

    try {
      const fs = require('fs');
      const responsePayload = fs.readFileSync('/tmp/lambda-response.json', 'utf8');

      res.json({
        ...result,
        ResponsePayload: responsePayload
      });
    } catch (fileError) {
      console.warn('Could not read response file:', fileError);
      res.json(result);
    }
  } catch (error) {
    console.error('Error invoking function:', error);
    res.status(500).json({ error: error.message });
  }
});

// CloudWatch Metrics endpoints
app.get('/api/cloudwatch/metrics/:functionName', async (req, res) => {
  try {
    const { functionName } = req.params;
    const { startTime, endTime, period } = req.query;

    // Por padrão, buscar métricas das últimas 24 horas
    const start = startTime || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const end = endTime || new Date().toISOString();
    const metricPeriod = period || '300'; // 5 minutes

    // Obter várias métricas para a função Lambda
    const metrics = [
      'Invocations',
      'Duration',
      'Errors',
      'Throttles',
      'ConcurrentExecutions'
    ];

    const results = {};

    for (const metricName of metrics) {
      try {
        const args = [
          'cloudwatch', 'get-metric-statistics',
          '--namespace', 'AWS/Lambda',
          '--metric-name', metricName,
          '--dimensions', `Name=FunctionName,Value=${functionName}`,
          '--start-time', start,
          '--end-time', end,
          '--period', metricPeriod,
          '--statistics', metricName === 'Duration' ? 'Average,Maximum' : 'Sum'
        ];

        const result = await executeAwsCommand(args);
        results[metricName] = result.Datapoints || [];
      } catch (error) {
        console.warn(`Failed to get metric ${metricName}:`, error.message);
        results[metricName] = [];
      }
    }

    res.json(results);
  } catch (error) {
    console.error('Error getting CloudWatch metrics:', error);
    // Return empty results structure instead of error status
    res.json({
      Invocations: [],
      Duration: [],
      Errors: [],
      Throttles: [],
      ConcurrentExecutions: []
    });
  }
});

app.get('/api/cloudwatch/insights/:functionName', async (req, res) => {
  try {
    const { functionName } = req.params;

    // Comando para iniciar uma consulta no CloudWatch Logs Insights
    const query = `
      fields @timestamp, @duration, @billedDuration, @memorySize, @maxMemoryUsed
      | filter @type = "REPORT"
      | sort @timestamp desc
      | limit 100
    `;

    const args = [
      'logs', 'start-query',
      '--log-group-name', `/aws/lambda/${functionName}`,
      '--start-time', Math.floor((Date.now() - 24 * 60 * 60 * 1000) / 1000).toString(),
      '--end-time', Math.floor(Date.now() / 1000).toString(),
      '--query-string', query
    ];

    const startResult = await executeAwsCommand(args);

    if (startResult.queryId) {
      // Esperar alguns segundos para a consulta ser processada
      await new Promise(resolve => setTimeout(resolve, 2000));

      const getResultsArgs = [
        'logs', 'get-query-results',
        '--query-id', startResult.queryId
      ];

      const queryResults = await executeAwsCommand(getResultsArgs);
      res.json(queryResults);
    } else {
      res.json({ results: [] });
    }
  } catch (error) {
    console.error('Error getting CloudWatch Insights:', error);
    // Retornar estrutura vazia em vez de erro
    res.json({ results: [] });
  }
});

// CloudWatch Logs endpoints
app.get('/api/logs/groups', async (req, res) => {
  try {
    const result = await executeAwsCommand(['logs', 'describe-log-groups']);
    res.json(result);
  } catch (error) {
    console.error('Error listing log groups:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/logs/streams', async (req, res) => {
  try {
    const { logGroupName } = req.query;
    if (!logGroupName) {
      return res.status(400).json({ error: 'logGroupName is required' });
    }

    const result = await executeAwsCommand([
      'logs', 'describe-log-streams',
      '--log-group-name', logGroupName,
      '--order-by', 'LastEventTime',
      '--descending'
    ]);
    res.json(result);
  } catch (error) {
    console.error('Error listing log streams:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/logs/events', async (req, res) => {
  try {
    const { logGroupName, logStreamName } = req.query;
    if (!logGroupName || !logStreamName) {
      return res.status(400).json({ error: 'logGroupName and logStreamName are required' });
    }

    const result = await executeAwsCommand([
      'logs', 'get-log-events',
      '--log-group-name', logGroupName,
      '--log-stream-name', logStreamName,
      '--limit', '50'
    ]);
    res.json(result);
  } catch (error) {
    console.error('Error getting log events:', error);
    res.status(500).json({ error: error.message });
  }
});

// Proxy para LocalStack
app.use('/aws', createProxyMiddleware({
  target: LOCALSTACK_URL,
  changeOrigin: true,
  pathRewrite: {
    '^/aws': '', // remove /aws prefix
  },
  onProxyReq: (proxyReq, req, res) => {
    console.log(`[PROXY] ${req.method} ${req.url} -> ${LOCALSTACK_URL}${req.url.replace('/aws', '')}`);
    console.log(`[PROXY HEADERS]`, JSON.stringify(req.headers, null, 2));

    // Add required headers for AWS API calls
    proxyReq.setHeader('Host', 'localhost:4566');
    proxyReq.setHeader('X-Forwarded-For', req.ip);

    // Completely strip the origin header to avoid LocalStack CORS issues
    delete req.headers.origin;
    delete req.headers.Origin;

    // Preserve all AWS-related headers
    Object.keys(req.headers).forEach(key => {
      if (key.toLowerCase().startsWith('x-amz') ||
          key.toLowerCase().includes('authorization') ||
          key.toLowerCase() === 'content-type') {
        proxyReq.setHeader(key, req.headers[key]);
      }
    });
  },
  onProxyRes: (proxyRes, req, res) => {
    console.log(`[PROXY RESPONSE] ${proxyRes.statusCode} for ${req.method} ${req.url}`);

    // Add CORS headers to response
    proxyRes.headers['Access-Control-Allow-Origin'] = req.headers.origin || '*';
    proxyRes.headers['Access-Control-Allow-Credentials'] = 'true';
    proxyRes.headers['Access-Control-Allow-Methods'] = 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS';
    proxyRes.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Amz-Target, X-Amz-Date, X-Amz-Security-Token, X-Amz-User-Agent';
  },
  onError: (err, req, res) => {
    console.error(`[PROXY ERROR] ${err.message} for ${req.method} ${req.url}`);
    res.status(500).json({
      error: 'Proxy error',
      message: err.message,
      localstack_url: LOCALSTACK_URL
    });
  }
}));

// Lidar com requisições OPTIONS para CORS
app.options('*', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', [
    'Content-Type',
    'Authorization',
    'X-Amz-Target',
    'X-Amz-Date',
    'X-Amz-Security-Token',
    'X-Amz-User-Agent',
    'X-Amz-Content-Sha256',
    'X-Amz-Algorithm',
    'X-Amz-Credential',
    'X-Amz-Signed-Headers',
    'X-Amz-Signature',
    'amz-sdk-invocation-id',
    'amz-sdk-request'
  ].join(', '));
  res.header('Access-Control-Allow-Credentials', 'true');
  res.sendStatus(200);
});

app.listen(PORT, () => {
  console.log(`� Analytics Dashboard API Server running on http://localhost:${PORT}`);
  console.log(`� Proxying LocalStack requests to ${LOCALSTACK_URL}`);
  console.log(`� Health check: http://localhost:${PORT}/health`);
  console.log(`� Test LocalStack: http://localhost:${PORT}/test-localstack`);
});

module.exports = app;