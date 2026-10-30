import {
  DescribeInstancesCommand,
  EC2Client,
  RebootInstancesCommand,
  StartInstancesCommand,
  StopInstancesCommand,
} from '@aws-sdk/client-ec2';
import { InvokeCommand, LambdaClient } from '@aws-sdk/client-lambda';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { PublishCommand, SNSClient } from '@aws-sdk/client-sns';
import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs';

import {
  type CatalogNode,
  type CatalogProperty,
  MAIN,
  ok,
  StepInputError,
  type StepTools,
} from './define';

const meta = (
  type: string,
  icon: string,
  label: [string, string],
  description: [string, string]
) => ({
  type,
  category: 'cloud',
  icon,
  color: 'bg-amber-600',
  label: { en: label[0], es: label[1] },
  description: { en: description[0], es: description[1] },
  inputs: MAIN,
  outputs: MAIN,
});

const AUTH: CatalogProperty[] = [
  { name: 'accessKeyId', displayName: 'Access key id', type: 'string', required: true },
  { name: 'secretAccessKey', displayName: 'Secret access key', type: 'secret', required: true },
  {
    name: 'sessionToken',
    displayName: 'Session token',
    type: 'secret',
    description: 'Only for temporary credentials.',
  },
  { name: 'region', displayName: 'Region', type: 'string', default: 'us-east-1' },
];

function clientConfig(t: StepTools) {
  const region = t.str('region') || 'us-east-1';
  if (!/^[a-z]{2}(-[a-z]+)+-\d$/.test(region))
    throw new StepInputError(`"${region}" is not an AWS region`);
  return {
    region,
    credentials: {
      accessKeyId: t.str('accessKeyId'),
      secretAccessKey: t.str('secretAccessKey'),
      ...(t.str('sessionToken') ? { sessionToken: t.str('sessionToken') } : {}),
    },
    maxAttempts: 3,
  };
}

const MAX_OBJECT_BYTES = 1024 * 1024;

const action = (options: Array<[string, string]>, def: string): CatalogProperty => ({
  name: 'action',
  displayName: 'Action',
  type: 'options',
  default: def,
  options: options.map(([value, name]) => ({ name, value })),
});

export const AWS_NODES: CatalogNode[] = [
  {
    ...meta(
      'aws.s3',
      'Archive',
      ['AWS S3', 'AWS S3'],
      [
        'List, read, write or delete objects in an S3 bucket',
        'Listar, leer, escribir o borrar objetos de un bucket S3',
      ]
    ),
    properties: [
      ...AUTH,
      action(
        [
          ['list', 'List objects'],
          ['get', 'Read object (text)'],
          ['put', 'Write object'],
          ['delete', 'Delete object'],
        ],
        'list'
      ),
      { name: 'bucket', displayName: 'Bucket', type: 'string', required: true },
      {
        name: 'key',
        displayName: 'Key / prefix',
        type: 'string',
        typeOptions: { expression: true },
        description: 'Object key; for list, an optional prefix.',
      },
      {
        name: 'body',
        displayName: 'Content',
        type: 'string',
        required: true,
        typeOptions: { rows: 4, expression: true },
        displayOptions: { show: { action: ['put'] } },
      },
      {
        name: 'contentType',
        displayName: 'Content type',
        type: 'string',
        default: 'text/plain',
        displayOptions: { show: { action: ['put'] } },
      },
    ],
    run: async t => {
      const client = new S3Client(clientConfig(t));
      const Bucket = t.str('bucket');
      const Key = t.str('key');
      const act = t.str('action');
      if ((act === 'get' || act === 'put' || act === 'delete') && !Key)
        throw new StepInputError('key is required');
      if (t.context.dryRun && (act === 'put' || act === 'delete'))
        return ok({ dryRun: true, action: act, bucket: Bucket, key: Key });
      if (act === 'list') {
        const r = await client.send(
          new ListObjectsV2Command({ Bucket, Prefix: Key || undefined, MaxKeys: 1000 })
        );
        const objects = (r.Contents ?? []).map(o => ({
          key: o.Key,
          size: o.Size,
          lastModified: o.LastModified,
        }));
        return ok({ objects, count: objects.length, truncated: !!r.IsTruncated });
      }
      if (act === 'get') {
        const r = await client.send(new GetObjectCommand({ Bucket, Key }));
        if ((r.ContentLength ?? 0) > MAX_OBJECT_BYTES) {
          throw new StepInputError(`object is ${r.ContentLength} bytes; steps read up to 1 MB`);
        }
        return ok({
          key: Key,
          contentType: r.ContentType ?? null,
          body: (await r.Body?.transformToString()) ?? '',
        });
      }
      if (act === 'put') {
        const r = await client.send(
          new PutObjectCommand({
            Bucket,
            Key,
            Body: t.str('body'),
            ContentType: t.str('contentType') || 'text/plain',
          })
        );
        return ok({ key: Key, etag: r.ETag ?? null });
      }
      await client.send(new DeleteObjectCommand({ Bucket, Key }));
      return ok({ key: Key, deleted: true });
    },
  },
  {
    ...meta(
      'aws.lambda',
      'FunctionSquare',
      ['AWS Lambda', 'AWS Lambda'],
      [
        'Invoke a Lambda function and get its response',
        'Invocar una función Lambda y obtener su respuesta',
      ]
    ),
    properties: [
      ...AUTH,
      { name: 'functionName', displayName: 'Function name or ARN', type: 'string', required: true },
      {
        name: 'payload',
        displayName: 'Payload (JSON)',
        type: 'string',
        default: '{}',
        typeOptions: { rows: 4, expression: true },
      },
      {
        name: 'async',
        displayName: 'Fire and forget',
        type: 'boolean',
        default: false,
        description: 'Event invocation: returns immediately without the result.',
      },
    ],
    run: async t => {
      if (t.context.dryRun) return ok({ dryRun: true, functionName: t.str('functionName') });
      const client = new LambdaClient(clientConfig(t));
      const r = await client.send(
        new InvokeCommand({
          FunctionName: t.str('functionName'),
          InvocationType: t.bool('async') ? 'Event' : 'RequestResponse',
          Payload: Buffer.from(JSON.stringify(t.json('payload', {}))),
        })
      );
      const text = r.Payload ? Buffer.from(r.Payload).toString('utf8') : '';
      let result: unknown = text;
      try {
        result = text ? JSON.parse(text) : null;
      } catch {
        // plain-text response
      }
      if (r.FunctionError) throw new Error(`Lambda ${r.FunctionError}: ${text.slice(0, 500)}`);
      return ok({ statusCode: r.StatusCode ?? null, result });
    },
  },
  {
    ...meta(
      'aws.ec2',
      'Server',
      ['AWS EC2', 'AWS EC2'],
      [
        'Describe, start, stop or reboot EC2 instances',
        'Describir, iniciar, detener o reiniciar instancias EC2',
      ]
    ),
    properties: [
      ...AUTH,
      action(
        [
          ['describe', 'Describe'],
          ['start', 'Start'],
          ['stop', 'Stop'],
          ['reboot', 'Reboot'],
        ],
        'describe'
      ),
      {
        name: 'instanceIds',
        displayName: 'Instance ids',
        type: 'string',
        description: 'Comma-separated (i-…). Required except to describe all.',
        typeOptions: { expression: true },
      },
    ],
    run: async t => {
      const ids = t.list('instanceIds').map(String);
      const act = t.str('action');
      if (act !== 'describe' && ids.length === 0)
        throw new StepInputError('instance ids are required');
      if (t.context.dryRun && act !== 'describe')
        return ok({ dryRun: true, action: act, instanceIds: ids });
      const client = new EC2Client(clientConfig(t));
      if (act === 'start') {
        const r = await client.send(new StartInstancesCommand({ InstanceIds: ids }));
        return ok({
          instances: (r.StartingInstances ?? []).map(i => ({
            id: i.InstanceId,
            state: i.CurrentState?.Name,
          })),
        });
      }
      if (act === 'stop') {
        const r = await client.send(new StopInstancesCommand({ InstanceIds: ids }));
        return ok({
          instances: (r.StoppingInstances ?? []).map(i => ({
            id: i.InstanceId,
            state: i.CurrentState?.Name,
          })),
        });
      }
      if (act === 'reboot') {
        await client.send(new RebootInstancesCommand({ InstanceIds: ids }));
        return ok({ instances: ids.map(id => ({ id, state: 'rebooting' })) });
      }
      const r = await client.send(
        new DescribeInstancesCommand(ids.length ? { InstanceIds: ids } : {})
      );
      const instances = (r.Reservations ?? []).flatMap(res =>
        (res.Instances ?? []).map(i => ({
          id: i.InstanceId,
          state: i.State?.Name,
          type: i.InstanceType,
          privateIp: i.PrivateIpAddress ?? null,
          publicIp: i.PublicIpAddress ?? null,
          name: i.Tags?.find(tag => tag.Key === 'Name')?.Value ?? null,
        }))
      );
      return ok({ instances, count: instances.length });
    },
  },
  {
    ...meta(
      'aws.sqs',
      'Inbox',
      ['AWS SQS', 'AWS SQS'],
      ['Send a message to an SQS queue', 'Enviar un mensaje a una cola SQS']
    ),
    properties: [
      ...AUTH,
      { name: 'queueUrl', displayName: 'Queue URL', type: 'string', required: true },
      {
        name: 'message',
        displayName: 'Message',
        type: 'string',
        required: true,
        typeOptions: { rows: 3, expression: true },
      },
      {
        name: 'groupId',
        displayName: 'Message group id',
        type: 'string',
        description: 'FIFO queues only.',
      },
    ],
    run: async t => {
      if (t.context.dryRun) return ok({ dryRun: true, queueUrl: t.str('queueUrl') });
      const client = new SQSClient(clientConfig(t));
      const r = await client.send(
        new SendMessageCommand({
          QueueUrl: t.str('queueUrl'),
          MessageBody: t.str('message'),
          ...(t.str('groupId') ? { MessageGroupId: t.str('groupId') } : {}),
        })
      );
      return ok({ messageId: r.MessageId ?? null });
    },
  },
  {
    ...meta(
      'aws.sns',
      'RadioTower',
      ['AWS SNS', 'AWS SNS'],
      ['Publish to an SNS topic', 'Publicar en un tópico SNS']
    ),
    properties: [
      ...AUTH,
      { name: 'topicArn', displayName: 'Topic ARN', type: 'string', required: true },
      {
        name: 'subject',
        displayName: 'Subject',
        type: 'string',
        typeOptions: { expression: true },
      },
      {
        name: 'message',
        displayName: 'Message',
        type: 'string',
        required: true,
        typeOptions: { rows: 3, expression: true },
      },
    ],
    run: async t => {
      if (t.context.dryRun) return ok({ dryRun: true, topicArn: t.str('topicArn') });
      const client = new SNSClient(clientConfig(t));
      const r = await client.send(
        new PublishCommand({
          TopicArn: t.str('topicArn'),
          Message: t.str('message'),
          ...(t.str('subject') ? { Subject: t.str('subject').slice(0, 100) } : {}),
        })
      );
      return ok({ messageId: r.MessageId ?? null });
    },
  },
];
