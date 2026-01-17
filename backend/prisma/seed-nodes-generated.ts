
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const NODES = [
    {
        "type": "n8n-nodes-base.actionNetwork",
        "category": "core",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Action Network",
            "es": "Action Network"
        },
        "description": {
            "en": "Consume the Action Network API",
            "es": "Consume the Action Network API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.activeCampaign",
        "category": "core",
        "icon": "Box",
        "color": "bg-blue-500",
        "label": {
            "en": "ActiveCampaign",
            "es": "ActiveCampaign"
        },
        "description": {
            "en": "Create and edit data in ActiveCampaign",
            "es": "Create and edit data in ActiveCampaign"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.activeCampaignTrigger",
        "category": "triggers",
        "icon": "Box",
        "color": "bg-green-500",
        "label": {
            "en": "ActiveCampaign Trigger",
            "es": "ActiveCampaign Trigger"
        },
        "description": {
            "en": "Handle ActiveCampaign events via webhooks",
            "es": "Handle ActiveCampaign events via webhooks"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.acuitySchedulingTrigger",
        "category": "triggers",
        "icon": "File",
        "color": "bg-green-500",
        "label": {
            "en": "Acuity Scheduling Trigger",
            "es": "Acuity Scheduling Trigger"
        },
        "description": {
            "en": "Handle Acuity Scheduling events via webhooks",
            "es": "Handle Acuity Scheduling events via webhooks"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.adalo",
        "category": "core",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Adalo",
            "es": "Adalo"
        },
        "description": {
            "en": "Consume Adalo API",
            "es": "Consume Adalo API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.affinity",
        "category": "utility",
        "icon": "Box",
        "color": "bg-blue-500",
        "label": {
            "en": "Affinity",
            "es": "Affinity"
        },
        "description": {
            "en": "Consume Affinity API",
            "es": "Consume Affinity API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.affinityTrigger",
        "category": "triggers",
        "icon": "Box",
        "color": "bg-green-500",
        "label": {
            "en": "Affinity Trigger",
            "es": "Affinity Trigger"
        },
        "description": {
            "en": "Handle Affinity events via webhooks",
            "es": "Handle Affinity events via webhooks"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.agileCrm",
        "category": "core",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Agile CRM",
            "es": "Agile CRM"
        },
        "description": {
            "en": "Consume Agile CRM API",
            "es": "Consume Agile CRM API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.aiTransform",
        "category": "core",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "AI Transform",
            "es": "AI Transform"
        },
        "description": {
            "en": "Modify data based on instructions written in plain english",
            "es": "Modify data based on instructions written in plain english"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.airtable",
        "category": "productivity",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Airtable",
            "es": "Airtable"
        },
        "description": {
            "en": "Read, update, write and delete data from Airtable",
            "es": "Read, update, write and delete data from Airtable"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.airtableTrigger",
        "category": "triggers",
        "icon": "File",
        "color": "bg-green-500",
        "label": {
            "en": "Airtable Trigger",
            "es": "Airtable Trigger"
        },
        "description": {
            "en": "Starts the workflow when Airtable events occur",
            "es": "Starts the workflow when Airtable events occur"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.airtop",
        "category": "core",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Airtop",
            "es": "Airtop"
        },
        "description": {
            "en": "Scrape and control any site with Airtop",
            "es": "Scrape and control any site with Airtop"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.amqp",
        "category": "core",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "AMQP Sender",
            "es": "AMQP Sender"
        },
        "description": {
            "en": "Sends a raw-message via AMQP 1.0, executed once per item",
            "es": "Sends a raw-message via AMQP 1.0, executed once per item"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.amqpTrigger",
        "category": "triggers",
        "icon": "File",
        "color": "bg-green-500",
        "label": {
            "en": "AMQP Trigger",
            "es": "AMQP Trigger"
        },
        "description": {
            "en": "Listens to AMQP 1.0 Messages",
            "es": "Listens to AMQP 1.0 Messages"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.apiTemplateIo",
        "category": "core",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "APITemplate.io",
            "es": "APITemplate.io"
        },
        "description": {
            "en": "Consume the APITemplate.io API",
            "es": "Consume the APITemplate.io API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.asana",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Asana",
            "es": "Asana"
        },
        "description": {
            "en": "Consume Asana REST API",
            "es": "Consume Asana REST API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.asanaTrigger",
        "category": "triggers",
        "icon": "File",
        "color": "bg-green-500",
        "label": {
            "en": "Asana Trigger",
            "es": "Asana Trigger"
        },
        "description": {
            "en": "Starts the workflow when Asana events occur.",
            "es": "Starts the workflow when Asana events occur."
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.autopilot",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Autopilot",
            "es": "Autopilot"
        },
        "description": {
            "en": "Consume Autopilot API",
            "es": "Consume Autopilot API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.autopilotTrigger",
        "category": "triggers",
        "icon": "File",
        "color": "bg-green-500",
        "label": {
            "en": "Autopilot Trigger",
            "es": "Autopilot Trigger"
        },
        "description": {
            "en": "Handle Autopilot events via webhooks",
            "es": "Handle Autopilot events via webhooks"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.awsLambda",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "AWS Lambda",
            "es": "AWS Lambda"
        },
        "description": {
            "en": "Invoke functions on AWS Lambda",
            "es": "Invoke functions on AWS Lambda"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.awsSns",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "AWS SNS",
            "es": "AWS SNS"
        },
        "description": {
            "en": "Sends data to AWS SNS",
            "es": "Sends data to AWS SNS"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.awsSnsTrigger",
        "category": "triggers",
        "icon": "File",
        "color": "bg-green-500",
        "label": {
            "en": "AWS SNS Trigger",
            "es": "AWS SNS Trigger"
        },
        "description": {
            "en": "Handle AWS SNS events via webhooks",
            "es": "Handle AWS SNS events via webhooks"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.awsCertificateManager",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "AWS Certificate Manager",
            "es": "AWS Certificate Manager"
        },
        "description": {
            "en": "Sends data to AWS Certificate Manager",
            "es": "Sends data to AWS Certificate Manager"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.awsCognito",
        "category": "utility",
        "icon": "Box",
        "color": "bg-blue-500",
        "label": {
            "en": "AWS Cognito",
            "es": "AWS Cognito"
        },
        "description": {
            "en": "Sends data to AWS Cognito",
            "es": "Sends data to AWS Cognito"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.awsComprehend",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "AWS Comprehend",
            "es": "AWS Comprehend"
        },
        "description": {
            "en": "Sends data to Amazon Comprehend",
            "es": "Sends data to Amazon Comprehend"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.awsDynamoDb",
        "category": "core",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "AWS DynamoDB",
            "es": "AWS DynamoDB"
        },
        "description": {
            "en": "Consume the AWS DynamoDB API",
            "es": "Consume the AWS DynamoDB API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.awsElb",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "AWS ELB",
            "es": "AWS ELB"
        },
        "description": {
            "en": "Sends data to AWS ELB API",
            "es": "Sends data to AWS ELB API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.awsIam",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "AWS IAM",
            "es": "AWS IAM"
        },
        "description": {
            "en": "Interacts with Amazon IAM",
            "es": "Interacts with Amazon IAM"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.awsRekognition",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "AWS Rekognition",
            "es": "AWS Rekognition"
        },
        "description": {
            "en": "Sends data to AWS Rekognition",
            "es": "Sends data to AWS Rekognition"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.awsS3",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "AwsS3",
            "es": "AwsS3"
        },
        "description": {
            "en": "Sends data to AWS S3",
            "es": "Sends data to AWS S3"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.awsSes",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "AWS SES",
            "es": "AWS SES"
        },
        "description": {
            "en": "Sends data to AWS SES",
            "es": "Sends data to AWS SES"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.awsSqs",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "AWS SQS",
            "es": "AWS SQS"
        },
        "description": {
            "en": "Sends messages to AWS SQS",
            "es": "Sends messages to AWS SQS"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.awsTextract",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "AWS Textract",
            "es": "AWS Textract"
        },
        "description": {
            "en": "Sends data to Amazon Textract",
            "es": "Sends data to Amazon Textract"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.awsTranscribe",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "AWS Transcribe",
            "es": "AWS Transcribe"
        },
        "description": {
            "en": "Sends data to AWS Transcribe",
            "es": "Sends data to AWS Transcribe"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.bannerbear",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Bannerbear",
            "es": "Bannerbear"
        },
        "description": {
            "en": "Consume Bannerbear API",
            "es": "Consume Bannerbear API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.baserow",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Baserow",
            "es": "Baserow"
        },
        "description": {
            "en": "Consume the Baserow API",
            "es": "Consume the Baserow API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.beeminder",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Beeminder",
            "es": "Beeminder"
        },
        "description": {
            "en": "Consume Beeminder API",
            "es": "Consume Beeminder API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.bitbucketTrigger",
        "category": "triggers",
        "icon": "File",
        "color": "bg-green-500",
        "label": {
            "en": "Bitbucket Trigger",
            "es": "Bitbucket Trigger"
        },
        "description": {
            "en": "Handle Bitbucket events via webhooks",
            "es": "Handle Bitbucket events via webhooks"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.bitly",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Bitly",
            "es": "Bitly"
        },
        "description": {
            "en": "Consume Bitly API",
            "es": "Consume Bitly API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.bitwarden",
        "category": "core",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Bitwarden",
            "es": "Bitwarden"
        },
        "description": {
            "en": "Consume the Bitwarden API",
            "es": "Consume the Bitwarden API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.box",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Box",
            "es": "Box"
        },
        "description": {
            "en": "Consume Box API",
            "es": "Consume Box API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.boxTrigger",
        "category": "triggers",
        "icon": "File",
        "color": "bg-green-500",
        "label": {
            "en": "Box Trigger",
            "es": "Box Trigger"
        },
        "description": {
            "en": "Starts the workflow when Box events occur",
            "es": "Starts the workflow when Box events occur"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.Brandfetch",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Brandfetch",
            "es": "Brandfetch"
        },
        "description": {
            "en": "Consume Brandfetch API",
            "es": "Consume Brandfetch API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.sendInBlue",
        "category": "core",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Brevo",
            "es": "Brevo"
        },
        "description": {
            "en": "Consume Brevo API",
            "es": "Consume Brevo API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.sendInBlueApi",
        "category": "triggers",
        "icon": "File",
        "color": "bg-green-500",
        "label": {
            "en": "Brevo Trigger",
            "es": "Brevo Trigger"
        },
        "description": {
            "en": "Starts the workflow when Brevo events occur",
            "es": "Starts the workflow when Brevo events occur"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.bubble",
        "category": "core",
        "icon": "Box",
        "color": "bg-blue-500",
        "label": {
            "en": "Bubble",
            "es": "Bubble"
        },
        "description": {
            "en": "Consume the Bubble Data API",
            "es": "Consume the Bubble Data API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.calTrigger",
        "category": "triggers",
        "icon": "Box",
        "color": "bg-green-500",
        "label": {
            "en": "Cal.com Trigger",
            "es": "Cal.com Trigger"
        },
        "description": {
            "en": "Handle Cal.com events via webhooks",
            "es": "Handle Cal.com events via webhooks"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.calendlyTrigger",
        "category": "triggers",
        "icon": "File",
        "color": "bg-green-500",
        "label": {
            "en": "Calendly Trigger",
            "es": "Calendly Trigger"
        },
        "description": {
            "en": "Starts the workflow when Calendly events occur",
            "es": "Starts the workflow when Calendly events occur"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.chargebee",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Chargebee",
            "es": "Chargebee"
        },
        "description": {
            "en": "Retrieve data from Chargebee API",
            "es": "Retrieve data from Chargebee API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.chargebeeTrigger",
        "category": "triggers",
        "icon": "File",
        "color": "bg-green-500",
        "label": {
            "en": "Chargebee Trigger",
            "es": "Chargebee Trigger"
        },
        "description": {
            "en": "Starts the workflow when Chargebee events occur",
            "es": "Starts the workflow when Chargebee events occur"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.circleCi",
        "category": "utility",
        "icon": "Box",
        "color": "bg-blue-500",
        "label": {
            "en": "CircleCI",
            "es": "CircleCI"
        },
        "description": {
            "en": "Consume CircleCI API",
            "es": "Consume CircleCI API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.ciscoWebex",
        "category": "core",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Webex by Cisco",
            "es": "Webex by Cisco"
        },
        "description": {
            "en": "Consume the Cisco Webex API",
            "es": "Consume the Cisco Webex API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.ciscoWebexTrigger",
        "category": "triggers",
        "icon": "File",
        "color": "bg-green-500",
        "label": {
            "en": "Webex by Cisco Trigger",
            "es": "Webex by Cisco Trigger"
        },
        "description": {
            "en": "Starts the workflow when Cisco Webex events occur.",
            "es": "Starts the workflow when Cisco Webex events occur."
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.clearbit",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Clearbit",
            "es": "Clearbit"
        },
        "description": {
            "en": "Consume Clearbit API",
            "es": "Consume Clearbit API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.clickUp",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "ClickUp",
            "es": "ClickUp"
        },
        "description": {
            "en": "Consume ClickUp API (Beta)",
            "es": "Consume ClickUp API (Beta)"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.clickUpTrigger",
        "category": "triggers",
        "icon": "File",
        "color": "bg-green-500",
        "label": {
            "en": "ClickUp Trigger",
            "es": "ClickUp Trigger"
        },
        "description": {
            "en": "Handle ClickUp events via webhooks (Beta)",
            "es": "Handle ClickUp events via webhooks (Beta)"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.clockify",
        "category": "core",
        "icon": "Box",
        "color": "bg-blue-500",
        "label": {
            "en": "Clockify",
            "es": "Clockify"
        },
        "description": {
            "en": "Consume Clockify REST API",
            "es": "Consume Clockify REST API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.clockifyTrigger",
        "category": "triggers",
        "icon": "Box",
        "color": "bg-green-500",
        "label": {
            "en": "Clockify Trigger",
            "es": "Clockify Trigger"
        },
        "description": {
            "en": "Listens to Clockify events",
            "es": "Listens to Clockify events"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.cloudflare",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Cloudflare",
            "es": "Cloudflare"
        },
        "description": {
            "en": "Consume Cloudflare API",
            "es": "Consume Cloudflare API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.cockpit",
        "category": "utility",
        "icon": "Box",
        "color": "bg-blue-500",
        "label": {
            "en": "Cockpit",
            "es": "Cockpit"
        },
        "description": {
            "en": "Consume Cockpit API",
            "es": "Consume Cockpit API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.coda",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Coda",
            "es": "Coda"
        },
        "description": {
            "en": "Consume Coda API",
            "es": "Consume Coda API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.code",
        "category": "core",
        "icon": "Code",
        "color": "bg-blue-500",
        "label": {
            "en": "Code",
            "es": "Code"
        },
        "description": {
            "en": "Run custom JavaScript or Python code",
            "es": "Run custom JavaScript or Python code"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.coinGecko",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "CoinGecko",
            "es": "CoinGecko"
        },
        "description": {
            "en": "Consume CoinGecko API",
            "es": "Consume CoinGecko API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.compareDatasets",
        "category": "core",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Compare Datasets",
            "es": "Compare Datasets"
        },
        "description": {
            "en": "Compare two inputs for changes",
            "es": "Compare two inputs for changes"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.compression",
        "category": "core",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Compression",
            "es": "Compression"
        },
        "description": {
            "en": "Compress and decompress files",
            "es": "Compress and decompress files"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.contentful",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Contentful",
            "es": "Contentful"
        },
        "description": {
            "en": "Consume Contentful API",
            "es": "Consume Contentful API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.convertKit",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "ConvertKit",
            "es": "ConvertKit"
        },
        "description": {
            "en": "Consume ConvertKit API",
            "es": "Consume ConvertKit API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.convertKitTrigger",
        "category": "triggers",
        "icon": "File",
        "color": "bg-green-500",
        "label": {
            "en": "ConvertKit Trigger",
            "es": "ConvertKit Trigger"
        },
        "description": {
            "en": "Handle ConvertKit events via webhooks",
            "es": "Handle ConvertKit events via webhooks"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.copper",
        "category": "core",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Copper",
            "es": "Copper"
        },
        "description": {
            "en": "Consume the Copper API",
            "es": "Consume the Copper API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.copperTrigger",
        "category": "triggers",
        "icon": "File",
        "color": "bg-green-500",
        "label": {
            "en": "Copper Trigger",
            "es": "Copper Trigger"
        },
        "description": {
            "en": "Handle Copper events via webhooks",
            "es": "Handle Copper events via webhooks"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.cortex",
        "category": "core",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Cortex",
            "es": "Cortex"
        },
        "description": {
            "en": "Apply the Cortex analyzer/responder on the given entity",
            "es": "Apply the Cortex analyzer/responder on the given entity"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.crateDb",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "CrateDB",
            "es": "CrateDB"
        },
        "description": {
            "en": "Add and update data in CrateDB",
            "es": "Add and update data in CrateDB"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.cron",
        "category": "triggers",
        "icon": "Clock",
        "color": "bg-green-500",
        "label": {
            "en": "Cron",
            "es": "Cron"
        },
        "description": {
            "en": "Triggers the workflow at a specific time",
            "es": "Triggers the workflow at a specific time"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.crypto",
        "category": "core",
        "icon": "Box",
        "color": "bg-blue-500",
        "label": {
            "en": "Crypto",
            "es": "Crypto"
        },
        "description": {
            "en": "Provide cryptographic utilities",
            "es": "Provide cryptographic utilities"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.customerIo",
        "category": "utility",
        "icon": "Box",
        "color": "bg-blue-500",
        "label": {
            "en": "Customer.io",
            "es": "Customer.io"
        },
        "description": {
            "en": "Consume Customer.io API",
            "es": "Consume Customer.io API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.customerIoTrigger",
        "category": "triggers",
        "icon": "Box",
        "color": "bg-green-500",
        "label": {
            "en": "Customer.io Trigger",
            "es": "Customer.io Trigger"
        },
        "description": {
            "en": "Starts the workflow on a Customer.io update (Beta)",
            "es": "Starts the workflow on a Customer.io update (Beta)"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.dataTable",
        "category": "core",
        "icon": "Box",
        "color": "bg-blue-500",
        "label": {
            "en": "Data table",
            "es": "Data table"
        },
        "description": {
            "en": "Permanently save data across workflow executions in a table",
            "es": "Permanently save data across workflow executions in a table"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.dateTime",
        "category": "core",
        "icon": "Clock",
        "color": "bg-blue-500",
        "label": {
            "en": "Date & Time",
            "es": "Date & Time"
        },
        "description": {
            "en": "Allows you to manipulate date and time values",
            "es": "Allows you to manipulate date and time values"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.Date & Time",
        "category": "utility",
        "icon": "Box",
        "color": "bg-blue-500",
        "label": {
            "en": "Operation",
            "es": "Operation"
        },
        "description": {
            "en": "Manipulate date and time values",
            "es": "Manipulate date and time values"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.debugHelper",
        "category": "utility",
        "icon": "Box",
        "color": "bg-blue-500",
        "label": {
            "en": "DebugHelper",
            "es": "DebugHelper"
        },
        "description": {
            "en": "Causes problems intentionally and generates useful data for debugging",
            "es": "Causes problems intentionally and generates useful data for debugging"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.deepL",
        "category": "utility",
        "icon": "Box",
        "color": "bg-blue-500",
        "label": {
            "en": "DeepL",
            "es": "DeepL"
        },
        "description": {
            "en": "Translate data using DeepL",
            "es": "Translate data using DeepL"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.demio",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Demio",
            "es": "Demio"
        },
        "description": {
            "en": "Consume the Demio API",
            "es": "Consume the Demio API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.dhl",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "DHL",
            "es": "DHL"
        },
        "description": {
            "en": "Consume DHL API",
            "es": "Consume DHL API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.discord",
        "category": "communication",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Discord",
            "es": "Discord"
        },
        "description": {
            "en": "Sends data to Discord",
            "es": "Sends data to Discord"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.discourse",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Discourse",
            "es": "Discourse"
        },
        "description": {
            "en": "Consume Discourse API",
            "es": "Consume Discourse API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.disqus",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Disqus",
            "es": "Disqus"
        },
        "description": {
            "en": "Access data on Disqus",
            "es": "Access data on Disqus"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.drift",
        "category": "utility",
        "icon": "Box",
        "color": "bg-blue-500",
        "label": {
            "en": "Drift",
            "es": "Drift"
        },
        "description": {
            "en": "Consume Drift API",
            "es": "Consume Drift API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.dropbox",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Dropbox",
            "es": "Dropbox"
        },
        "description": {
            "en": "Access data on Dropbox",
            "es": "Access data on Dropbox"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.dropcontact",
        "category": "core",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Dropcontact",
            "es": "Dropcontact"
        },
        "description": {
            "en": "Find B2B emails and enrich contacts",
            "es": "Find B2B emails and enrich contacts"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.e2eTest",
        "category": "utility",
        "icon": "Box",
        "color": "bg-blue-500",
        "label": {
            "en": "E2E Test",
            "es": "E2E Test"
        },
        "description": {
            "en": "Dummy node used for e2e testing",
            "es": "Dummy node used for e2e testing"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.erpNext",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "ERPNext",
            "es": "ERPNext"
        },
        "description": {
            "en": "Consume ERPNext API",
            "es": "Consume ERPNext API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.Blur",
        "category": "core",
        "icon": "Box",
        "color": "bg-blue-500",
        "label": {
            "en": "Background Color",
            "es": "Background Color"
        },
        "description": {
            "en": "Adds a blur to the image and so makes it less sharp",
            "es": "Adds a blur to the image and so makes it less sharp"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.egoi",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "E-goi",
            "es": "E-goi"
        },
        "description": {
            "en": "Consume E-goi API",
            "es": "Consume E-goi API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.elasticSecurity",
        "category": "core",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Elastic Security",
            "es": "Elastic Security"
        },
        "description": {
            "en": "Consume the Elastic Security API",
            "es": "Consume the Elastic Security API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.elasticsearch",
        "category": "core",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Elasticsearch",
            "es": "Elasticsearch"
        },
        "description": {
            "en": "Consume the Elasticsearch API",
            "es": "Consume the Elasticsearch API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.emailReadImap",
        "category": "triggers",
        "icon": "Box",
        "color": "bg-green-500",
        "label": {
            "en": "Email Trigger (IMAP)",
            "es": "Email Trigger (IMAP)"
        },
        "description": {
            "en": "Triggers the workflow when a new email is received",
            "es": "Triggers the workflow when a new email is received"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.emailSend",
        "category": "communication",
        "icon": "Box",
        "color": "bg-blue-500",
        "label": {
            "en": "Send Email",
            "es": "Send Email"
        },
        "description": {
            "en": "Sends an email using SMTP protocol",
            "es": "Sends an email using SMTP protocol"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.emelia",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Emelia",
            "es": "Emelia"
        },
        "description": {
            "en": "Consume the Emelia API",
            "es": "Consume the Emelia API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.emeliaTrigger",
        "category": "triggers",
        "icon": "File",
        "color": "bg-green-500",
        "label": {
            "en": "Emelia Trigger",
            "es": "Emelia Trigger"
        },
        "description": {
            "en": "Handle Emelia campaign activity events via webhooks",
            "es": "Handle Emelia campaign activity events via webhooks"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.errorTrigger",
        "category": "triggers",
        "icon": "Box",
        "color": "bg-green-500",
        "label": {
            "en": "Error Trigger",
            "es": "Error Trigger"
        },
        "description": {
            "en": "Triggers the workflow when another workflow has an error",
            "es": "Triggers the workflow when another workflow has an error"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.setInputsNotice",
        "category": "utility",
        "icon": "Box",
        "color": "bg-blue-500",
        "label": {
            "en": "For adding columns from your dataset to the evaluation results. Anything you add here will be displayed in the ‘evaluations’ tab, not on the Google Sheet or Data table.",
            "es": "For adding columns from your dataset to the evaluation results. Anything you add here will be displayed in the ‘evaluations’ tab, not on the Google Sheet or Data table."
        },
        "description": {
            "en": "The expected output defined in your evaluation dataset, used as ground truth",
            "es": "The expected output defined in your evaluation dataset, used as ground truth"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.eventbriteTrigger",
        "category": "triggers",
        "icon": "File",
        "color": "bg-green-500",
        "label": {
            "en": "Eventbrite Trigger",
            "es": "Eventbrite Trigger"
        },
        "description": {
            "en": "Handle Eventbrite events via webhooks",
            "es": "Handle Eventbrite events via webhooks"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.executeCommand",
        "category": "core",
        "icon": "Box",
        "color": "bg-blue-500",
        "label": {
            "en": "Execute Command",
            "es": "Execute Command"
        },
        "description": {
            "en": "Executes a command on the host",
            "es": "Executes a command on the host"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.executeWorkflow",
        "category": "core",
        "icon": "Box",
        "color": "bg-blue-500",
        "label": {
            "en": "Execute Sub-workflow",
            "es": "Execute Sub-workflow"
        },
        "description": {
            "en": "Execute another workflow",
            "es": "Execute another workflow"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.executeWorkflowTrigger",
        "category": "triggers",
        "icon": "Box",
        "color": "bg-green-500",
        "label": {
            "en": "Execute Workflow Trigger",
            "es": "Execute Workflow Trigger"
        },
        "description": {
            "en": "Helpers for calling other n8n workflows. Used for designing modular, microservice-like workflows.",
            "es": "Helpers for calling other n8n workflows. Used for designing modular, microservice-like workflows."
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.executionData",
        "category": "utility",
        "icon": "Box",
        "color": "bg-blue-500",
        "label": {
            "en": "Execution Data",
            "es": "Execution Data"
        },
        "description": {
            "en": "Add execution data for search",
            "es": "Add execution data for search"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.facebookGraphApi",
        "category": "core",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Facebook Graph API",
            "es": "Facebook Graph API"
        },
        "description": {
            "en": "Interacts with Facebook using the Graph API",
            "es": "Interacts with Facebook using the Graph API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.facebookTrigger",
        "category": "triggers",
        "icon": "File",
        "color": "bg-green-500",
        "label": {
            "en": "Facebook Trigger",
            "es": "Facebook Trigger"
        },
        "description": {
            "en": "Starts the workflow when Facebook events occur",
            "es": "Starts the workflow when Facebook events occur"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.facebookLeadAdsTrigger",
        "category": "triggers",
        "icon": "File",
        "color": "bg-green-500",
        "label": {
            "en": "Facebook Lead Ads Trigger",
            "es": "Facebook Lead Ads Trigger"
        },
        "description": {
            "en": "Handle Facebook Lead Ads events via webhooks",
            "es": "Handle Facebook Lead Ads events via webhooks"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.figmaTrigger",
        "category": "triggers",
        "icon": "File",
        "color": "bg-green-500",
        "label": {
            "en": "Figma Trigger (Beta)",
            "es": "Figma Trigger (Beta)"
        },
        "description": {
            "en": "Starts the workflow when Figma events occur",
            "es": "Starts the workflow when Figma events occur"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.filemaker",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "FileMaker",
            "es": "FileMaker"
        },
        "description": {
            "en": "Retrieve data from the FileMaker data API",
            "es": "Retrieve data from the FileMaker data API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.convertToFile",
        "category": "utility",
        "icon": "Box",
        "color": "bg-blue-500",
        "label": {
            "en": "Convert to File",
            "es": "Convert to File"
        },
        "description": {
            "en": "Convert JSON data to binary data",
            "es": "Convert JSON data to binary data"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.extractFromFile",
        "category": "utility",
        "icon": "Box",
        "color": "bg-blue-500",
        "label": {
            "en": "Extract from File",
            "es": "Extract from File"
        },
        "description": {
            "en": "Convert binary data to JSON",
            "es": "Convert binary data to JSON"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.readWriteFile",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Read/Write Files from Disk",
            "es": "Read/Write Files from Disk"
        },
        "description": {
            "en": "Read or write files from the computer that runs n8n",
            "es": "Read or write files from the computer that runs n8n"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.filter",
        "category": "core",
        "icon": "Box",
        "color": "bg-blue-500",
        "label": {
            "en": "Filter",
            "es": "Filter"
        },
        "description": {
            "en": "Remove items matching a condition",
            "es": "Remove items matching a condition"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.Filter",
        "category": "utility",
        "icon": "Box",
        "color": "bg-blue-500",
        "label": {
            "en": "Conditions",
            "es": "Conditions"
        },
        "description": {
            "en": "The type of values to compare",
            "es": "The type of values to compare"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.flow",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Flow",
            "es": "Flow"
        },
        "description": {
            "en": "Consume Flow API",
            "es": "Consume Flow API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.flowTrigger",
        "category": "triggers",
        "icon": "File",
        "color": "bg-green-500",
        "label": {
            "en": "Flow Trigger",
            "es": "Flow Trigger"
        },
        "description": {
            "en": "Handle Flow events via webhooks",
            "es": "Handle Flow events via webhooks"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.limitWaitTime",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Limit Wait Time",
            "es": "Limit Wait Time"
        },
        "description": {
            "en": "Whether to limit the time this node should wait for a user response before execution resumes",
            "es": "Whether to limit the time this node should wait for a user response before execution resumes"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.formTrigger",
        "category": "triggers",
        "icon": "File",
        "color": "bg-green-500",
        "label": {
            "en": "n8n Form Trigger",
            "es": "n8n Form Trigger"
        },
        "description": {
            "en": "Generate webforms in n8n and pass their responses to the workflow",
            "es": "Generate webforms in n8n and pass their responses to the workflow"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.useWorkflowTimezone",
        "category": "triggers",
        "icon": "File",
        "color": "bg-green-500",
        "label": {
            "en": "Use Workflow Timezone",
            "es": "Use Workflow Timezone"
        },
        "description": {
            "en": "Generate webforms in n8n and pass their responses to the workflow",
            "es": "Generate webforms in n8n and pass their responses to the workflow"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.formIoTrigger",
        "category": "triggers",
        "icon": "File",
        "color": "bg-green-500",
        "label": {
            "en": "Form.io Trigger",
            "es": "Form.io Trigger"
        },
        "description": {
            "en": "Handle form.io events via webhooks",
            "es": "Handle form.io events via webhooks"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.formstackTrigger",
        "category": "triggers",
        "icon": "File",
        "color": "bg-green-500",
        "label": {
            "en": "Formstack Trigger",
            "es": "Formstack Trigger"
        },
        "description": {
            "en": "Starts the workflow on a Formstack form submission.",
            "es": "Starts the workflow on a Formstack form submission."
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.freshdesk",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Freshdesk",
            "es": "Freshdesk"
        },
        "description": {
            "en": "Consume Freshdesk API",
            "es": "Consume Freshdesk API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.freshservice",
        "category": "core",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Freshservice",
            "es": "Freshservice"
        },
        "description": {
            "en": "Consume the Freshservice API",
            "es": "Consume the Freshservice API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.freshworksCrm",
        "category": "core",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Freshworks CRM",
            "es": "Freshworks CRM"
        },
        "description": {
            "en": "Consume the Freshworks CRM API",
            "es": "Consume the Freshworks CRM API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.timeout",
        "category": "utility",
        "icon": "Box",
        "color": "bg-blue-500",
        "label": {
            "en": "Timeout",
            "es": "Timeout"
        },
        "description": {
            "en": "Connection timeout in milliseconds",
            "es": "Connection timeout in milliseconds"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.function",
        "category": "core",
        "icon": "Code",
        "color": "bg-blue-500",
        "label": {
            "en": "Function",
            "es": "Function"
        },
        "description": {
            "en": "Run custom function code which gets executed once and allows you to add, remove, change and replace items",
            "es": "Run custom function code which gets executed once and allows you to add, remove, change and replace items"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.functionItem",
        "category": "core",
        "icon": "Code",
        "color": "bg-blue-500",
        "label": {
            "en": "Function Item",
            "es": "Function Item"
        },
        "description": {
            "en": "Run custom function code which gets executed once per item",
            "es": "Run custom function code which gets executed once per item"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.getResponse",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "GetResponse",
            "es": "GetResponse"
        },
        "description": {
            "en": "Consume GetResponse API",
            "es": "Consume GetResponse API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.getResponseTrigger",
        "category": "triggers",
        "icon": "File",
        "color": "bg-green-500",
        "label": {
            "en": "GetResponse Trigger",
            "es": "GetResponse Trigger"
        },
        "description": {
            "en": "Starts the workflow when GetResponse events occur",
            "es": "Starts the workflow when GetResponse events occur"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.ghost",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Ghost",
            "es": "Ghost"
        },
        "description": {
            "en": "Consume Ghost API",
            "es": "Consume Ghost API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.git",
        "category": "core",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Git",
            "es": "Git"
        },
        "description": {
            "en": "Control git.",
            "es": "Control git."
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.github",
        "category": "utility",
        "icon": "Box",
        "color": "bg-blue-500",
        "label": {
            "en": "GitHub",
            "es": "GitHub"
        },
        "description": {
            "en": "Consume GitHub API",
            "es": "Consume GitHub API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.githubTrigger",
        "category": "triggers",
        "icon": "Box",
        "color": "bg-green-500",
        "label": {
            "en": "Github Trigger",
            "es": "Github Trigger"
        },
        "description": {
            "en": "Starts the workflow when Github events occur",
            "es": "Starts the workflow when Github events occur"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.gitlab",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "GitLab",
            "es": "GitLab"
        },
        "description": {
            "en": "Retrieve data from GitLab API",
            "es": "Retrieve data from GitLab API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.Comment",
        "category": "triggers",
        "icon": "File",
        "color": "bg-green-500",
        "label": {
            "en": "GitLab Trigger",
            "es": "GitLab Trigger"
        },
        "description": {
            "en": "Triggered when a new comment is made on commits, merge requests, issues, and code snippets",
            "es": "Triggered when a new comment is made on commits, merge requests, issues, and code snippets"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.goToWebinar",
        "category": "core",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "GoToWebinar",
            "es": "GoToWebinar"
        },
        "description": {
            "en": "Consume the GoToWebinar API",
            "es": "Consume the GoToWebinar API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.gong",
        "category": "core",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Gong",
            "es": "Gong"
        },
        "description": {
            "en": "Interact with Gong API",
            "es": "Interact with Gong API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.googleAds",
        "category": "core",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Google Ads",
            "es": "Google Ads"
        },
        "description": {
            "en": "Use the Google Ads API",
            "es": "Use the Google Ads API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.googleAnalytics",
        "category": "core",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Google Analytics",
            "es": "Google Analytics"
        },
        "description": {
            "en": "Use the Google Analytics API",
            "es": "Use the Google Analytics API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.googleBigQuery",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Google BigQuery",
            "es": "Google BigQuery"
        },
        "description": {
            "en": "Consume Google BigQuery API",
            "es": "Consume Google BigQuery API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.googleBooks",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Google Books",
            "es": "Google Books"
        },
        "description": {
            "en": "Read data from Google Books",
            "es": "Read data from Google Books"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.googleBusinessProfile",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Google Business Profile",
            "es": "Google Business Profile"
        },
        "description": {
            "en": "Consume Google Business Profile API",
            "es": "Consume Google Business Profile API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.googleBusinessProfileTrigger",
        "category": "triggers",
        "icon": "File",
        "color": "bg-green-500",
        "label": {
            "en": "Google Business Profile Trigger",
            "es": "Google Business Profile Trigger"
        },
        "description": {
            "en": "Fetches reviews from Google Business Profile and starts the workflow on specified polling intervals.",
            "es": "Fetches reviews from Google Business Profile and starts the workflow on specified polling intervals."
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.googleCalendar",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Google Calendar",
            "es": "Google Calendar"
        },
        "description": {
            "en": "Consume Google Calendar API",
            "es": "Consume Google Calendar API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.googleCalendarTrigger",
        "category": "triggers",
        "icon": "File",
        "color": "bg-green-500",
        "label": {
            "en": "Google Calendar Trigger",
            "es": "Google Calendar Trigger"
        },
        "description": {
            "en": "Starts the workflow when Google Calendar events occur",
            "es": "Starts the workflow when Google Calendar events occur"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.googleChat",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Google Chat",
            "es": "Google Chat"
        },
        "description": {
            "en": "Consume Google Chat API",
            "es": "Consume Google Chat API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.googleCloudNaturalLanguage",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Google Cloud Natural Language",
            "es": "Google Cloud Natural Language"
        },
        "description": {
            "en": "Consume Google Cloud Natural Language API",
            "es": "Consume Google Cloud Natural Language API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.googleCloudStorage",
        "category": "core",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Google Cloud Storage",
            "es": "Google Cloud Storage"
        },
        "description": {
            "en": "Use the Google Cloud Storage API",
            "es": "Use the Google Cloud Storage API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.googleContacts",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Google Contacts",
            "es": "Google Contacts"
        },
        "description": {
            "en": "Consume Google Contacts API",
            "es": "Consume Google Contacts API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.googleDocs",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Google Docs",
            "es": "Google Docs"
        },
        "description": {
            "en": "Consume Google Docs API.",
            "es": "Consume Google Docs API."
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.googleDrive",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Google Drive",
            "es": "Google Drive"
        },
        "description": {
            "en": "Access data on Google Drive",
            "es": "Access data on Google Drive"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.googleDriveTrigger",
        "category": "triggers",
        "icon": "File",
        "color": "bg-green-500",
        "label": {
            "en": "Google Drive Trigger",
            "es": "Google Drive Trigger"
        },
        "description": {
            "en": "Starts the workflow when Google Drive events occur",
            "es": "Starts the workflow when Google Drive events occur"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.googleFirebaseCloudFirestore",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Google Cloud Firestore",
            "es": "Google Cloud Firestore"
        },
        "description": {
            "en": "Interact with Google Firebase - Cloud Firestore API",
            "es": "Interact with Google Firebase - Cloud Firestore API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.googleFirebaseRealtimeDatabase",
        "category": "utility",
        "icon": "Clock",
        "color": "bg-blue-500",
        "label": {
            "en": "Google Cloud Realtime Database",
            "es": "Google Cloud Realtime Database"
        },
        "description": {
            "en": "Interact with Google Firebase - Realtime Database API",
            "es": "Interact with Google Firebase - Realtime Database API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.gSuiteAdmin",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Google Workspace Admin",
            "es": "Google Workspace Admin"
        },
        "description": {
            "en": "Consume Google Workspace Admin API",
            "es": "Consume Google Workspace Admin API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.gmail",
        "category": "communication",
        "icon": "Mail",
        "color": "bg-blue-500",
        "label": {
            "en": "Gmail",
            "es": "Gmail"
        },
        "description": {
            "en": "Consume the Gmail API",
            "es": "Consume the Gmail API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.gmailTrigger",
        "category": "triggers",
        "icon": "Mail",
        "color": "bg-green-500",
        "label": {
            "en": "Gmail Trigger",
            "es": "Gmail Trigger"
        },
        "description": {
            "en": "Fetches emails from Gmail and starts the workflow on specified polling intervals.",
            "es": "Fetches emails from Gmail and starts the workflow on specified polling intervals."
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.googlePerspective",
        "category": "core",
        "icon": "Box",
        "color": "bg-blue-500",
        "label": {
            "en": "Google Perspective",
            "es": "Google Perspective"
        },
        "description": {
            "en": "Consume Google Perspective API",
            "es": "Consume Google Perspective API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.googleSheets",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Google Sheets",
            "es": "Google Sheets"
        },
        "description": {
            "en": "Read, update and write data to Google Sheets",
            "es": "Read, update and write data to Google Sheets"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.documentId",
        "category": "triggers",
        "icon": "File",
        "color": "bg-green-500",
        "label": {
            "en": "Document",
            "es": "Document"
        },
        "description": {
            "en": "Starts the workflow when Google Sheets events occur",
            "es": "Starts the workflow when Google Sheets events occur"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.googleSlides",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Google Slides",
            "es": "Google Slides"
        },
        "description": {
            "en": "Consume the Google Slides API",
            "es": "Consume the Google Slides API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.googleTasks",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Google Tasks",
            "es": "Google Tasks"
        },
        "description": {
            "en": "Consume Google Tasks API",
            "es": "Consume Google Tasks API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.googleTranslate",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Google Translate",
            "es": "Google Translate"
        },
        "description": {
            "en": "Translate data using Google Translate",
            "es": "Translate data using Google Translate"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.youTube",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "YouTube",
            "es": "YouTube"
        },
        "description": {
            "en": "Consume YouTube API",
            "es": "Consume YouTube API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.gotify",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Gotify",
            "es": "Gotify"
        },
        "description": {
            "en": "Consume Gotify API",
            "es": "Consume Gotify API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.grafana",
        "category": "core",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Grafana",
            "es": "Grafana"
        },
        "description": {
            "en": "Consume the Grafana API",
            "es": "Consume the Grafana API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.graphql",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "GraphQL",
            "es": "GraphQL"
        },
        "description": {
            "en": "Makes a GraphQL request and returns the received data",
            "es": "Makes a GraphQL request and returns the received data"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.grist",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Grist",
            "es": "Grist"
        },
        "description": {
            "en": "Consume the Grist API",
            "es": "Consume the Grist API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.gumroadTrigger",
        "category": "triggers",
        "icon": "File",
        "color": "bg-green-500",
        "label": {
            "en": "Gumroad Trigger",
            "es": "Gumroad Trigger"
        },
        "description": {
            "en": "Handle Gumroad events via webhooks",
            "es": "Handle Gumroad events via webhooks"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.hackerNews",
        "category": "core",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Hacker News",
            "es": "Hacker News"
        },
        "description": {
            "en": "Consume Hacker News API",
            "es": "Consume Hacker News API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.haloPSA",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "HaloPSA",
            "es": "HaloPSA"
        },
        "description": {
            "en": "Consume HaloPSA API",
            "es": "Consume HaloPSA API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.harvest",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Harvest",
            "es": "Harvest"
        },
        "description": {
            "en": "Access data on Harvest",
            "es": "Access data on Harvest"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.helpScout",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Help Scout",
            "es": "Help Scout"
        },
        "description": {
            "en": "Consume Help Scout API",
            "es": "Consume Help Scout API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.helpScoutTrigger",
        "category": "triggers",
        "icon": "File",
        "color": "bg-green-500",
        "label": {
            "en": "Help Scout Trigger",
            "es": "Help Scout Trigger"
        },
        "description": {
            "en": "Starts the workflow when Help Scout events occur",
            "es": "Starts the workflow when Help Scout events occur"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.highLevel",
        "category": "core",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "HighLevel",
            "es": "HighLevel"
        },
        "description": {
            "en": "Consume HighLevel API",
            "es": "Consume HighLevel API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.resource",
        "category": "core",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Resource",
            "es": "Resource"
        },
        "description": {
            "en": "Consume HighLevel API v1",
            "es": "Consume HighLevel API v1"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.homeAssistant",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Home Assistant",
            "es": "Home Assistant"
        },
        "description": {
            "en": "Consume Home Assistant API",
            "es": "Consume Home Assistant API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.extractionValues",
        "category": "core",
        "icon": "Box",
        "color": "bg-blue-500",
        "label": {
            "en": "Extraction Values",
            "es": "Extraction Values"
        },
        "description": {
            "en": "The key under which the extracted value should be saved",
            "es": "The key under which the extracted value should be saved"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.htmlExtract",
        "category": "core",
        "icon": "Box",
        "color": "bg-blue-500",
        "label": {
            "en": "HTML Extract",
            "es": "HTML Extract"
        },
        "description": {
            "en": "Extracts data from HTML",
            "es": "Extracts data from HTML"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.httpRequest",
        "category": "utility",
        "icon": "Box",
        "color": "bg-blue-500",
        "label": {
            "en": "HTTP Request",
            "es": "HTTP Request"
        },
        "description": {
            "en": "Makes an HTTP request and returns the response data",
            "es": "Makes an HTTP request and returns the response data"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.HTTP Request",
        "category": "utility",
        "icon": "Box",
        "color": "bg-blue-500",
        "label": {
            "en": "Authentication",
            "es": "Authentication"
        },
        "description": {
            "en": "The way to authenticate",
            "es": "The way to authenticate"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.hubspot",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "HubSpot",
            "es": "HubSpot"
        },
        "description": {
            "en": "Consume HubSpot API",
            "es": "Consume HubSpot API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.hubspotTrigger",
        "category": "triggers",
        "icon": "File",
        "color": "bg-green-500",
        "label": {
            "en": "HubSpot Trigger",
            "es": "HubSpot Trigger"
        },
        "description": {
            "en": "Starts the workflow when HubSpot events occur",
            "es": "Starts the workflow when HubSpot events occur"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.HubSpot",
        "category": "utility",
        "icon": "Box",
        "color": "bg-blue-500",
        "label": {
            "en": "Authentication",
            "es": "Authentication"
        },
        "description": {
            "en": "",
            "es": ""
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.humanticAi",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Humantic AI",
            "es": "Humantic AI"
        },
        "description": {
            "en": "Consume Humantic AI API",
            "es": "Consume Humantic AI API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.hunter",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Hunter",
            "es": "Hunter"
        },
        "description": {
            "en": "Consume Hunter API",
            "es": "Consume Hunter API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.iCal",
        "category": "utility",
        "icon": "Calendar",
        "color": "bg-blue-500",
        "label": {
            "en": "iCalendar",
            "es": "iCalendar"
        },
        "description": {
            "en": "Create iCalendar file",
            "es": "Create iCalendar file"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.if",
        "category": "core",
        "icon": "Box",
        "color": "bg-blue-500",
        "label": {
            "en": "If",
            "es": "If"
        },
        "description": {
            "en": "Route items to different branches (true/false)",
            "es": "Route items to different branches (true/false)"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.If",
        "category": "utility",
        "icon": "Box",
        "color": "bg-blue-500",
        "label": {
            "en": "Conditions",
            "es": "Conditions"
        },
        "description": {
            "en": "The type of values to compare",
            "es": "The type of values to compare"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.intercom",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Intercom",
            "es": "Intercom"
        },
        "description": {
            "en": "Consume Intercom API",
            "es": "Consume Intercom API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.interval",
        "category": "triggers",
        "icon": "Box",
        "color": "bg-green-500",
        "label": {
            "en": "Interval",
            "es": "Interval"
        },
        "description": {
            "en": "Triggers the workflow in a given interval",
            "es": "Triggers the workflow in a given interval"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.invoiceNinja",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Invoice Ninja",
            "es": "Invoice Ninja"
        },
        "description": {
            "en": "Consume Invoice Ninja API",
            "es": "Consume Invoice Ninja API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.invoiceNinjaTrigger",
        "category": "triggers",
        "icon": "File",
        "color": "bg-green-500",
        "label": {
            "en": "Invoice Ninja Trigger",
            "es": "Invoice Ninja Trigger"
        },
        "description": {
            "en": "Starts the workflow when Invoice Ninja events occur",
            "es": "Starts the workflow when Invoice Ninja events occur"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.itemLists",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Item Lists",
            "es": "Item Lists"
        },
        "description": {
            "en": "Helper for working with lists of items and transforming arrays",
            "es": "Helper for working with lists of items and transforming arrays"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.Item Lists",
        "category": "utility",
        "icon": "Box",
        "color": "bg-blue-500",
        "label": {
            "en": "Resource",
            "es": "Resource"
        },
        "description": {
            "en": "Combine fields into a list in a single new item",
            "es": "Combine fields into a list in a single new item"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.iterable",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Iterable",
            "es": "Iterable"
        },
        "description": {
            "en": "Consume Iterable API",
            "es": "Consume Iterable API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.jenkins",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Jenkins",
            "es": "Jenkins"
        },
        "description": {
            "en": "Consume Jenkins API",
            "es": "Consume Jenkins API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.jinaAi",
        "category": "core",
        "icon": "Box",
        "color": "bg-blue-500",
        "label": {
            "en": "Jina AI",
            "es": "Jina AI"
        },
        "description": {
            "en": "Interact with Jina AI API",
            "es": "Interact with Jina AI API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.jira",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Jira Software",
            "es": "Jira Software"
        },
        "description": {
            "en": "Consume Jira Software API",
            "es": "Consume Jira Software API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.jiraTrigger",
        "category": "triggers",
        "icon": "File",
        "color": "bg-green-500",
        "label": {
            "en": "Jira Trigger",
            "es": "Jira Trigger"
        },
        "description": {
            "en": "Starts the workflow when Jira events occur",
            "es": "Starts the workflow when Jira events occur"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.jotFormTrigger",
        "category": "triggers",
        "icon": "Box",
        "color": "bg-green-500",
        "label": {
            "en": "Jotform Trigger",
            "es": "Jotform Trigger"
        },
        "description": {
            "en": "Handle Jotform events via webhooks",
            "es": "Handle Jotform events via webhooks"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.jwt",
        "category": "core",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "JWT",
            "es": "JWT"
        },
        "description": {
            "en": "JWT",
            "es": "JWT"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.kafka",
        "category": "core",
        "icon": "Box",
        "color": "bg-blue-500",
        "label": {
            "en": "Kafka",
            "es": "Kafka"
        },
        "description": {
            "en": "Sends messages to a Kafka topic",
            "es": "Sends messages to a Kafka topic"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.kafkaTrigger",
        "category": "triggers",
        "icon": "Box",
        "color": "bg-green-500",
        "label": {
            "en": "Kafka Trigger",
            "es": "Kafka Trigger"
        },
        "description": {
            "en": "Consume messages from a Kafka topic",
            "es": "Consume messages from a Kafka topic"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.keap",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Keap",
            "es": "Keap"
        },
        "description": {
            "en": "Consume Keap API",
            "es": "Consume Keap API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.keapTrigger",
        "category": "triggers",
        "icon": "File",
        "color": "bg-green-500",
        "label": {
            "en": "Keap Trigger",
            "es": "Keap Trigger"
        },
        "description": {
            "en": "Starts the workflow when Infusionsoft events occur",
            "es": "Starts the workflow when Infusionsoft events occur"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.koBoToolbox",
        "category": "core",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "KoBoToolbox",
            "es": "KoBoToolbox"
        },
        "description": {
            "en": "Work with KoBoToolbox forms and submissions",
            "es": "Work with KoBoToolbox forms and submissions"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.koBoToolboxTrigger",
        "category": "triggers",
        "icon": "File",
        "color": "bg-green-500",
        "label": {
            "en": "KoBoToolbox Trigger",
            "es": "KoBoToolbox Trigger"
        },
        "description": {
            "en": "Process KoBoToolbox submissions",
            "es": "Process KoBoToolbox submissions"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.ldap",
        "category": "core",
        "icon": "Box",
        "color": "bg-blue-500",
        "label": {
            "en": "Ldap",
            "es": "Ldap"
        },
        "description": {
            "en": "Interact with LDAP servers",
            "es": "Interact with LDAP servers"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.lemlist",
        "category": "core",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Lemlist",
            "es": "Lemlist"
        },
        "description": {
            "en": "Consume the Lemlist API",
            "es": "Consume the Lemlist API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.lemlistTrigger",
        "category": "triggers",
        "icon": "File",
        "color": "bg-green-500",
        "label": {
            "en": "Lemlist Trigger",
            "es": "Lemlist Trigger"
        },
        "description": {
            "en": "Handle Lemlist events via webhooks",
            "es": "Handle Lemlist events via webhooks"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.line",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Line",
            "es": "Line"
        },
        "description": {
            "en": "Consume Line API",
            "es": "Consume Line API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.linear",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Linear",
            "es": "Linear"
        },
        "description": {
            "en": "Consume Linear API",
            "es": "Consume Linear API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.linearTrigger",
        "category": "triggers",
        "icon": "File",
        "color": "bg-green-500",
        "label": {
            "en": "Linear Trigger",
            "es": "Linear Trigger"
        },
        "description": {
            "en": "Starts the workflow when Linear events occur",
            "es": "Starts the workflow when Linear events occur"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.lingvaNex",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "LingvaNex",
            "es": "LingvaNex"
        },
        "description": {
            "en": "Consume LingvaNex API",
            "es": "Consume LingvaNex API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.linkedIn",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "LinkedIn",
            "es": "LinkedIn"
        },
        "description": {
            "en": "Consume LinkedIn API",
            "es": "Consume LinkedIn API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.localFileTrigger",
        "category": "triggers",
        "icon": "Box",
        "color": "bg-green-500",
        "label": {
            "en": "Local File Trigger",
            "es": "Local File Trigger"
        },
        "description": {
            "en": "Triggers a workflow on file system changes",
            "es": "Triggers a workflow on file system changes"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.loneScale",
        "category": "core",
        "icon": "Box",
        "color": "bg-blue-500",
        "label": {
            "en": "LoneScale",
            "es": "LoneScale"
        },
        "description": {
            "en": "Create List, add / delete items",
            "es": "Create List, add / delete items"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.loneScaleTrigger",
        "category": "triggers",
        "icon": "Box",
        "color": "bg-green-500",
        "label": {
            "en": "LoneScale Trigger",
            "es": "LoneScale Trigger"
        },
        "description": {
            "en": "Trigger LoneScale Workflow",
            "es": "Trigger LoneScale Workflow"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.mqtt",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "MQTT",
            "es": "MQTT"
        },
        "description": {
            "en": "Push messages to MQTT",
            "es": "Push messages to MQTT"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.mqttTrigger",
        "category": "triggers",
        "icon": "File",
        "color": "bg-green-500",
        "label": {
            "en": "MQTT Trigger",
            "es": "MQTT Trigger"
        },
        "description": {
            "en": "Listens to MQTT events",
            "es": "Listens to MQTT events"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.magento2",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Magento 2",
            "es": "Magento 2"
        },
        "description": {
            "en": "Consume Magento API",
            "es": "Consume Magento API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.mailcheck",
        "category": "communication",
        "icon": "Mail",
        "color": "bg-blue-500",
        "label": {
            "en": "Mailcheck",
            "es": "Mailcheck"
        },
        "description": {
            "en": "Consume Mailcheck API",
            "es": "Consume Mailcheck API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.mailchimp",
        "category": "communication",
        "icon": "Box",
        "color": "bg-blue-500",
        "label": {
            "en": "Mailchimp",
            "es": "Mailchimp"
        },
        "description": {
            "en": "Consume Mailchimp API",
            "es": "Consume Mailchimp API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.mailchimpTrigger",
        "category": "triggers",
        "icon": "Box",
        "color": "bg-green-500",
        "label": {
            "en": "Mailchimp Trigger",
            "es": "Mailchimp Trigger"
        },
        "description": {
            "en": "Handle Mailchimp events via webhooks",
            "es": "Handle Mailchimp events via webhooks"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.mailerLite",
        "category": "communication",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "MailerLite",
            "es": "MailerLite"
        },
        "description": {
            "en": "Consume MailerLite API",
            "es": "Consume MailerLite API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.mailerLiteTrigger",
        "category": "triggers",
        "icon": "File",
        "color": "bg-green-500",
        "label": {
            "en": "MailerLite Trigger",
            "es": "MailerLite Trigger"
        },
        "description": {
            "en": "Starts the workflow when MailerLite events occur",
            "es": "Starts the workflow when MailerLite events occur"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.mailgun",
        "category": "communication",
        "icon": "Mail",
        "color": "bg-blue-500",
        "label": {
            "en": "Mailgun",
            "es": "Mailgun"
        },
        "description": {
            "en": "Sends an email via Mailgun",
            "es": "Sends an email via Mailgun"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.mailjet",
        "category": "communication",
        "icon": "Mail",
        "color": "bg-blue-500",
        "label": {
            "en": "Mailjet",
            "es": "Mailjet"
        },
        "description": {
            "en": "Consume Mailjet API",
            "es": "Consume Mailjet API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.mailjetTrigger",
        "category": "triggers",
        "icon": "Mail",
        "color": "bg-green-500",
        "label": {
            "en": "Mailjet Trigger",
            "es": "Mailjet Trigger"
        },
        "description": {
            "en": "Handle Mailjet events via webhooks",
            "es": "Handle Mailjet events via webhooks"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.mandrill",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Mandrill",
            "es": "Mandrill"
        },
        "description": {
            "en": "Consume Mandrill API",
            "es": "Consume Mandrill API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.manualTrigger",
        "category": "triggers",
        "icon": "Box",
        "color": "bg-green-500",
        "label": {
            "en": "Manual Trigger",
            "es": "Manual Trigger"
        },
        "description": {
            "en": "Runs the flow on clicking a button in n8n",
            "es": "Runs the flow on clicking a button in n8n"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.markdown",
        "category": "utility",
        "icon": "Box",
        "color": "bg-blue-500",
        "label": {
            "en": "Markdown",
            "es": "Markdown"
        },
        "description": {
            "en": "Convert data between Markdown and HTML",
            "es": "Convert data between Markdown and HTML"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.marketstack",
        "category": "core",
        "icon": "Box",
        "color": "bg-blue-500",
        "label": {
            "en": "Marketstack",
            "es": "Marketstack"
        },
        "description": {
            "en": "Consume Marketstack API",
            "es": "Consume Marketstack API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.matrix",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Matrix",
            "es": "Matrix"
        },
        "description": {
            "en": "Consume Matrix API",
            "es": "Consume Matrix API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.mattermost",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Mattermost",
            "es": "Mattermost"
        },
        "description": {
            "en": "Sends data to Mattermost",
            "es": "Sends data to Mattermost"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.mautic",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Mautic",
            "es": "Mautic"
        },
        "description": {
            "en": "Consume Mautic API",
            "es": "Consume Mautic API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.mauticTrigger",
        "category": "triggers",
        "icon": "File",
        "color": "bg-green-500",
        "label": {
            "en": "Mautic Trigger",
            "es": "Mautic Trigger"
        },
        "description": {
            "en": "Handle Mautic events via webhooks",
            "es": "Handle Mautic events via webhooks"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.medium",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Medium",
            "es": "Medium"
        },
        "description": {
            "en": "Consume Medium API",
            "es": "Consume Medium API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.merge",
        "category": "core",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Merge",
            "es": "Merge"
        },
        "description": {
            "en": "Merges data of multiple streams once data from both is available",
            "es": "Merges data of multiple streams once data from both is available"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.Merge",
        "category": "utility",
        "icon": "Box",
        "color": "bg-blue-500",
        "label": {
            "en": "Mode",
            "es": "Mode"
        },
        "description": {
            "en": "Combines data of both inputs. The output will contain items of input 1 and input 2.",
            "es": "Combines data of both inputs. The output will contain items of input 1 and input 2."
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.messageBird",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "MessageBird",
            "es": "MessageBird"
        },
        "description": {
            "en": "Sends SMS via MessageBird",
            "es": "Sends SMS via MessageBird"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.metabase",
        "category": "core",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Metabase",
            "es": "Metabase"
        },
        "description": {
            "en": "Use the Metabase API",
            "es": "Use the Metabase API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.azureCosmosDb",
        "category": "core",
        "icon": "Box",
        "color": "bg-blue-500",
        "label": {
            "en": "Azure Cosmos DB",
            "es": "Azure Cosmos DB"
        },
        "description": {
            "en": "Interact with Azure Cosmos DB API",
            "es": "Interact with Azure Cosmos DB API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.microsoftDynamicsCrm",
        "category": "utility",
        "icon": "Box",
        "color": "bg-blue-500",
        "label": {
            "en": "Microsoft Dynamics CRM",
            "es": "Microsoft Dynamics CRM"
        },
        "description": {
            "en": "Consume Microsoft Dynamics CRM API",
            "es": "Consume Microsoft Dynamics CRM API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.microsoftEntra",
        "category": "core",
        "icon": "Box",
        "color": "bg-blue-500",
        "label": {
            "en": "Microsoft Entra ID",
            "es": "Microsoft Entra ID"
        },
        "description": {
            "en": "Interact with Microsoft Entra ID API",
            "es": "Interact with Microsoft Entra ID API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.microsoftExcel",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Microsoft Excel 365",
            "es": "Microsoft Excel 365"
        },
        "description": {
            "en": "Consume Microsoft Excel API",
            "es": "Consume Microsoft Excel API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.microsoftGraphSecurity",
        "category": "core",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Microsoft Graph Security",
            "es": "Microsoft Graph Security"
        },
        "description": {
            "en": "Consume the Microsoft Graph Security API",
            "es": "Consume the Microsoft Graph Security API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.microsoftOneDrive",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Microsoft OneDrive",
            "es": "Microsoft OneDrive"
        },
        "description": {
            "en": "Consume Microsoft OneDrive API",
            "es": "Consume Microsoft OneDrive API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.microsoftOneDriveTrigger",
        "category": "triggers",
        "icon": "File",
        "color": "bg-green-500",
        "label": {
            "en": "Microsoft OneDrive Trigger",
            "es": "Microsoft OneDrive Trigger"
        },
        "description": {
            "en": "Trigger for Microsoft OneDrive API.",
            "es": "Trigger for Microsoft OneDrive API."
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.microsoftOutlook",
        "category": "core",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Microsoft Outlook",
            "es": "Microsoft Outlook"
        },
        "description": {
            "en": "Consume Microsoft Outlook API",
            "es": "Consume Microsoft Outlook API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.microsoftOutlookTrigger",
        "category": "triggers",
        "icon": "File",
        "color": "bg-green-500",
        "label": {
            "en": "Microsoft Outlook Trigger",
            "es": "Microsoft Outlook Trigger"
        },
        "description": {
            "en": "Fetches emails from Microsoft Outlook and starts the workflow on specified polling intervals.",
            "es": "Fetches emails from Microsoft Outlook and starts the workflow on specified polling intervals."
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.microsoftSharePoint",
        "category": "core",
        "icon": "Box",
        "color": "bg-blue-500",
        "label": {
            "en": "Microsoft SharePoint",
            "es": "Microsoft SharePoint"
        },
        "description": {
            "en": "Interact with Microsoft SharePoint API",
            "es": "Interact with Microsoft SharePoint API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.microsoftSql",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Microsoft SQL",
            "es": "Microsoft SQL"
        },
        "description": {
            "en": "Get, add and update data in Microsoft SQL",
            "es": "Get, add and update data in Microsoft SQL"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.azureStorage",
        "category": "core",
        "icon": "Box",
        "color": "bg-blue-500",
        "label": {
            "en": "Azure Storage",
            "es": "Azure Storage"
        },
        "description": {
            "en": "Interact with Azure Storage API",
            "es": "Interact with Azure Storage API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.microsoftTeams",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Microsoft Teams",
            "es": "Microsoft Teams"
        },
        "description": {
            "en": "Consume Microsoft Teams API",
            "es": "Consume Microsoft Teams API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.microsoftTeamsTrigger",
        "category": "triggers",
        "icon": "File",
        "color": "bg-green-500",
        "label": {
            "en": "Microsoft Teams Trigger",
            "es": "Microsoft Teams Trigger"
        },
        "description": {
            "en": "Triggers workflows in n8n based on events from Microsoft Teams, such as new messages or team updates, using specified configurations.",
            "es": "Triggers workflows in n8n based on events from Microsoft Teams, such as new messages or team updates, using specified configurations."
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.microsoftToDo",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Microsoft To Do",
            "es": "Microsoft To Do"
        },
        "description": {
            "en": "Consume Microsoft To Do API.",
            "es": "Consume Microsoft To Do API."
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.mindee",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Mindee",
            "es": "Mindee"
        },
        "description": {
            "en": "Consume Mindee API",
            "es": "Consume Mindee API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.misp",
        "category": "core",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "MISP",
            "es": "MISP"
        },
        "description": {
            "en": "Consume the MISP API",
            "es": "Consume the MISP API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.mistralAi",
        "category": "core",
        "icon": "Box",
        "color": "bg-blue-500",
        "label": {
            "en": "Mistral AI",
            "es": "Mistral AI"
        },
        "description": {
            "en": "Consume Mistral AI API",
            "es": "Consume Mistral AI API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.mocean",
        "category": "core",
        "icon": "Box",
        "color": "bg-blue-500",
        "label": {
            "en": "Mocean",
            "es": "Mocean"
        },
        "description": {
            "en": "Send SMS and voice messages via Mocean",
            "es": "Send SMS and voice messages via Mocean"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.mondayCom",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Monday.com",
            "es": "Monday.com"
        },
        "description": {
            "en": "Consume Monday.com API",
            "es": "Consume Monday.com API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.mongoDb",
        "category": "storage",
        "icon": "Database",
        "color": "bg-blue-500",
        "label": {
            "en": "MongoDB",
            "es": "MongoDB"
        },
        "description": {
            "en": "Find, insert and update documents in MongoDB",
            "es": "Find, insert and update documents in MongoDB"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.monicaCrm",
        "category": "core",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Monica CRM",
            "es": "Monica CRM"
        },
        "description": {
            "en": "Consume the Monica CRM API",
            "es": "Consume the Monica CRM API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.moveBinaryData",
        "category": "core",
        "icon": "Box",
        "color": "bg-blue-500",
        "label": {
            "en": "Convert to/from binary data",
            "es": "Convert to/from binary data"
        },
        "description": {
            "en": "Move data between binary and JSON properties",
            "es": "Move data between binary and JSON properties"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.msg91",
        "category": "core",
        "icon": "Box",
        "color": "bg-blue-500",
        "label": {
            "en": "MSG91",
            "es": "MSG91"
        },
        "description": {
            "en": "Sends transactional SMS via MSG91",
            "es": "Sends transactional SMS via MSG91"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.mySql",
        "category": "utility",
        "icon": "Box",
        "color": "bg-blue-500",
        "label": {
            "en": "MySQL",
            "es": "MySQL"
        },
        "description": {
            "en": "Get, add and update data in MySQL",
            "es": "Get, add and update data in MySQL"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.n8n",
        "category": "core",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "n8n",
            "es": "n8n"
        },
        "description": {
            "en": "Handle events and perform actions on your n8n instance",
            "es": "Handle events and perform actions on your n8n instance"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.Jay Gatsby",
        "category": "core",
        "icon": "Box",
        "color": "bg-blue-500",
        "label": {
            "en": "Customer Datastore (n8n training)",
            "es": "Customer Datastore (n8n training)"
        },
        "description": {
            "en": "Dummy node used for n8n training",
            "es": "Dummy node used for n8n training"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.n8nTrainingCustomerMessenger",
        "category": "core",
        "icon": "Box",
        "color": "bg-blue-500",
        "label": {
            "en": "Customer Messenger (n8n training)",
            "es": "Customer Messenger (n8n training)"
        },
        "description": {
            "en": "Dummy node used for n8n training",
            "es": "Dummy node used for n8n training"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.n8nTrigger",
        "category": "triggers",
        "icon": "File",
        "color": "bg-green-500",
        "label": {
            "en": "n8n Trigger",
            "es": "n8n Trigger"
        },
        "description": {
            "en": "Handle events and perform actions on your n8n instance",
            "es": "Handle events and perform actions on your n8n instance"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.nasa",
        "category": "core",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "NASA",
            "es": "NASA"
        },
        "description": {
            "en": "Retrieve data from the NASA API",
            "es": "Retrieve data from the NASA API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.netlify",
        "category": "core",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Netlify",
            "es": "Netlify"
        },
        "description": {
            "en": "Consume Netlify API",
            "es": "Consume Netlify API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.netlifyTrigger",
        "category": "triggers",
        "icon": "File",
        "color": "bg-green-500",
        "label": {
            "en": "Netlify Trigger",
            "es": "Netlify Trigger"
        },
        "description": {
            "en": "Handle netlify events via webhooks",
            "es": "Handle netlify events via webhooks"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.citrixAdc",
        "category": "utility",
        "icon": "Box",
        "color": "bg-blue-500",
        "label": {
            "en": "Netscaler ADC",
            "es": "Netscaler ADC"
        },
        "description": {
            "en": "Consume Netscaler ADC API",
            "es": "Consume Netscaler ADC API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.nextCloud",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Nextcloud",
            "es": "Nextcloud"
        },
        "description": {
            "en": "Access data on Nextcloud",
            "es": "Access data on Nextcloud"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.noOp",
        "category": "utility",
        "icon": "Box",
        "color": "bg-blue-500",
        "label": {
            "en": "No Operation, do nothing",
            "es": "No Operation, do nothing"
        },
        "description": {
            "en": "No Operation",
            "es": "No Operation"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.nocoDb",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "NocoDB",
            "es": "NocoDB"
        },
        "description": {
            "en": "Read, update, write and delete data from NocoDB",
            "es": "Read, update, write and delete data from NocoDB"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.notion",
        "category": "utility",
        "icon": "Box",
        "color": "bg-blue-500",
        "label": {
            "en": "Notion",
            "es": "Notion"
        },
        "description": {
            "en": "Consume Notion API",
            "es": "Consume Notion API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.notionTrigger",
        "category": "triggers",
        "icon": "Box",
        "color": "bg-green-500",
        "label": {
            "en": "Notion Trigger",
            "es": "Notion Trigger"
        },
        "description": {
            "en": "Starts the workflow when Notion events occur",
            "es": "Starts the workflow when Notion events occur"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.npm",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Npm",
            "es": "Npm"
        },
        "description": {
            "en": "Consume NPM registry API",
            "es": "Consume NPM registry API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.odoo",
        "category": "core",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Odoo",
            "es": "Odoo"
        },
        "description": {
            "en": "Consume Odoo API",
            "es": "Consume Odoo API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.okta",
        "category": "core",
        "icon": "Box",
        "color": "bg-blue-500",
        "label": {
            "en": "Okta",
            "es": "Okta"
        },
        "description": {
            "en": "Use the Okta API",
            "es": "Use the Okta API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.oneSimpleApi",
        "category": "core",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "One Simple API",
            "es": "One Simple API"
        },
        "description": {
            "en": "A toolbox of no-code utilities",
            "es": "A toolbox of no-code utilities"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.onfleet",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Onfleet",
            "es": "Onfleet"
        },
        "description": {
            "en": "Consume Onfleet API",
            "es": "Consume Onfleet API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.onfleetTrigger",
        "category": "triggers",
        "icon": "File",
        "color": "bg-green-500",
        "label": {
            "en": "Onfleet Trigger",
            "es": "Onfleet Trigger"
        },
        "description": {
            "en": "Starts the workflow when Onfleet events occur",
            "es": "Starts the workflow when Onfleet events occur"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.openAi",
        "category": "core",
        "icon": "Box",
        "color": "bg-blue-500",
        "label": {
            "en": "OpenAI",
            "es": "OpenAI"
        },
        "description": {
            "en": "Consume Open AI",
            "es": "Consume Open AI"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.openThesaurus",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "OpenThesaurus",
            "es": "OpenThesaurus"
        },
        "description": {
            "en": "Get synonmns for German words using the OpenThesaurus API",
            "es": "Get synonmns for German words using the OpenThesaurus API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.openWeatherMap",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "OpenWeatherMap",
            "es": "OpenWeatherMap"
        },
        "description": {
            "en": "Gets current and future weather information",
            "es": "Gets current and future weather information"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.orbit",
        "category": "utility",
        "icon": "Box",
        "color": "bg-blue-500",
        "label": {
            "en": "Orbit",
            "es": "Orbit"
        },
        "description": {
            "en": "Consume Orbit API",
            "es": "Consume Orbit API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.oura",
        "category": "utility",
        "icon": "Box",
        "color": "bg-blue-500",
        "label": {
            "en": "Oura",
            "es": "Oura"
        },
        "description": {
            "en": "Consume Oura API",
            "es": "Consume Oura API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.paddle",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Paddle",
            "es": "Paddle"
        },
        "description": {
            "en": "Consume Paddle API",
            "es": "Consume Paddle API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.pagerDuty",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "PagerDuty",
            "es": "PagerDuty"
        },
        "description": {
            "en": "Consume PagerDuty API",
            "es": "Consume PagerDuty API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.payPal",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "PayPal",
            "es": "PayPal"
        },
        "description": {
            "en": "Consume PayPal API",
            "es": "Consume PayPal API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.payPalTrigger",
        "category": "triggers",
        "icon": "File",
        "color": "bg-green-500",
        "label": {
            "en": "PayPal Trigger",
            "es": "PayPal Trigger"
        },
        "description": {
            "en": "Handle PayPal events via webhooks",
            "es": "Handle PayPal events via webhooks"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.peekalink",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Peekalink",
            "es": "Peekalink"
        },
        "description": {
            "en": "Consume the Peekalink API",
            "es": "Consume the Peekalink API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.perplexity",
        "category": "core",
        "icon": "Box",
        "color": "bg-blue-500",
        "label": {
            "en": "Perplexity",
            "es": "Perplexity"
        },
        "description": {
            "en": "Interact with the Perplexity API to generate AI responses with citations",
            "es": "Interact with the Perplexity API to generate AI responses with citations"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.phantombuster",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Phantombuster",
            "es": "Phantombuster"
        },
        "description": {
            "en": "Consume Phantombuster API",
            "es": "Consume Phantombuster API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.philipsHue",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Philips Hue",
            "es": "Philips Hue"
        },
        "description": {
            "en": "Consume Philips Hue API",
            "es": "Consume Philips Hue API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.pipedrive",
        "category": "core",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Pipedrive",
            "es": "Pipedrive"
        },
        "description": {
            "en": "Create and edit data in Pipedrive",
            "es": "Create and edit data in Pipedrive"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.Activity",
        "category": "triggers",
        "icon": "File",
        "color": "bg-green-500",
        "label": {
            "en": "Pipedrive Trigger",
            "es": "Pipedrive Trigger"
        },
        "description": {
            "en": "Starts the workflow when Pipedrive events occur",
            "es": "Starts the workflow when Pipedrive events occur"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.plivo",
        "category": "core",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Plivo",
            "es": "Plivo"
        },
        "description": {
            "en": "Send SMS/MMS messages or make phone calls",
            "es": "Send SMS/MMS messages or make phone calls"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.postBin",
        "category": "core",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "PostBin",
            "es": "PostBin"
        },
        "description": {
            "en": "Consume PostBin API",
            "es": "Consume PostBin API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.postHog",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "PostHog",
            "es": "PostHog"
        },
        "description": {
            "en": "Consume PostHog API",
            "es": "Consume PostHog API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.postgres",
        "category": "storage",
        "icon": "Database",
        "color": "bg-blue-500",
        "label": {
            "en": "Postgres",
            "es": "Postgres"
        },
        "description": {
            "en": "Get, add and update data in Postgres",
            "es": "Get, add and update data in Postgres"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.postgresTrigger",
        "category": "triggers",
        "icon": "Database",
        "color": "bg-green-500",
        "label": {
            "en": "Postgres Trigger",
            "es": "Postgres Trigger"
        },
        "description": {
            "en": "Listens to Postgres messages",
            "es": "Listens to Postgres messages"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.postmarkTrigger",
        "category": "triggers",
        "icon": "File",
        "color": "bg-green-500",
        "label": {
            "en": "Postmark Trigger",
            "es": "Postmark Trigger"
        },
        "description": {
            "en": "Starts the workflow when Postmark events occur",
            "es": "Starts the workflow when Postmark events occur"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.profitWell",
        "category": "utility",
        "icon": "Box",
        "color": "bg-blue-500",
        "label": {
            "en": "ProfitWell",
            "es": "ProfitWell"
        },
        "description": {
            "en": "Consume ProfitWell API",
            "es": "Consume ProfitWell API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.pushbullet",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Pushbullet",
            "es": "Pushbullet"
        },
        "description": {
            "en": "Consume Pushbullet API",
            "es": "Consume Pushbullet API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.pushcut",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Pushcut",
            "es": "Pushcut"
        },
        "description": {
            "en": "Consume Pushcut API",
            "es": "Consume Pushcut API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.pushcutTrigger",
        "category": "triggers",
        "icon": "File",
        "color": "bg-green-500",
        "label": {
            "en": "Pushcut Trigger",
            "es": "Pushcut Trigger"
        },
        "description": {
            "en": "Starts the workflow when Pushcut events occur",
            "es": "Starts the workflow when Pushcut events occur"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.pushover",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Pushover",
            "es": "Pushover"
        },
        "description": {
            "en": "Consume Pushover API",
            "es": "Consume Pushover API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.questDb",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "QuestDB",
            "es": "QuestDB"
        },
        "description": {
            "en": "Get, add and update data in QuestDB",
            "es": "Get, add and update data in QuestDB"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.quickbase",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Quick Base",
            "es": "Quick Base"
        },
        "description": {
            "en": "Integrate with the Quick Base RESTful API",
            "es": "Integrate with the Quick Base RESTful API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.quickbooks",
        "category": "core",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "QuickBooks Online",
            "es": "QuickBooks Online"
        },
        "description": {
            "en": "Consume the QuickBooks Online API",
            "es": "Consume the QuickBooks Online API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.quickChart",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "QuickChart",
            "es": "QuickChart"
        },
        "description": {
            "en": "Create a chart via QuickChart",
            "es": "Create a chart via QuickChart"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.rabbitmq",
        "category": "core",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "RabbitMQ",
            "es": "RabbitMQ"
        },
        "description": {
            "en": "Sends messages to a RabbitMQ topic",
            "es": "Sends messages to a RabbitMQ topic"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.rabbitmqTrigger",
        "category": "triggers",
        "icon": "File",
        "color": "bg-green-500",
        "label": {
            "en": "RabbitMQ Trigger",
            "es": "RabbitMQ Trigger"
        },
        "description": {
            "en": "Listens to RabbitMQ messages",
            "es": "Listens to RabbitMQ messages"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.raindrop",
        "category": "core",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Raindrop",
            "es": "Raindrop"
        },
        "description": {
            "en": "Consume the Raindrop API",
            "es": "Consume the Raindrop API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.readBinaryFile",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Read Binary File",
            "es": "Read Binary File"
        },
        "description": {
            "en": "Reads a binary file from disk",
            "es": "Reads a binary file from disk"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.readBinaryFiles",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Read Binary Files",
            "es": "Read Binary Files"
        },
        "description": {
            "en": "Reads binary files from disk",
            "es": "Reads binary files from disk"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.readPDF",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Read PDF",
            "es": "Read PDF"
        },
        "description": {
            "en": "Reads a PDF and extracts its content",
            "es": "Reads a PDF and extracts its content"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.reddit",
        "category": "core",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Reddit",
            "es": "Reddit"
        },
        "description": {
            "en": "Consume the Reddit API",
            "es": "Consume the Reddit API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.redis",
        "category": "storage",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Redis",
            "es": "Redis"
        },
        "description": {
            "en": "Get, send and update data in Redis",
            "es": "Get, send and update data in Redis"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.redisTrigger",
        "category": "triggers",
        "icon": "File",
        "color": "bg-green-500",
        "label": {
            "en": "Redis Trigger",
            "es": "Redis Trigger"
        },
        "description": {
            "en": "Subscribe to redis channel",
            "es": "Subscribe to redis channel"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.renameKeys",
        "category": "core",
        "icon": "Box",
        "color": "bg-blue-500",
        "label": {
            "en": "Rename Keys",
            "es": "Rename Keys"
        },
        "description": {
            "en": "Update item field names",
            "es": "Update item field names"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.respondWith",
        "category": "core",
        "icon": "Box",
        "color": "bg-blue-500",
        "label": {
            "en": "Respond With",
            "es": "Respond With"
        },
        "description": {
            "en": "Respond with all input JSON items",
            "es": "Respond with all input JSON items"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.rocketchat",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "RocketChat",
            "es": "RocketChat"
        },
        "description": {
            "en": "Consume RocketChat API",
            "es": "Consume RocketChat API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.rssFeedRead",
        "category": "utility",
        "icon": "Box",
        "color": "bg-blue-500",
        "label": {
            "en": "RSS Read",
            "es": "RSS Read"
        },
        "description": {
            "en": "Reads data from an RSS Feed",
            "es": "Reads data from an RSS Feed"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.rssFeedReadTrigger",
        "category": "triggers",
        "icon": "Box",
        "color": "bg-green-500",
        "label": {
            "en": "RSS Feed Trigger",
            "es": "RSS Feed Trigger"
        },
        "description": {
            "en": "Starts a workflow when an RSS feed is updated",
            "es": "Starts a workflow when an RSS feed is updated"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.rundeck",
        "category": "core",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Rundeck",
            "es": "Rundeck"
        },
        "description": {
            "en": "Manage Rundeck API",
            "es": "Manage Rundeck API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.s3",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "S3",
            "es": "S3"
        },
        "description": {
            "en": "Sends data to any S3-compatible service",
            "es": "Sends data to any S3-compatible service"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.salesforce",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Salesforce",
            "es": "Salesforce"
        },
        "description": {
            "en": "Consume Salesforce API",
            "es": "Consume Salesforce API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.salesforceTrigger",
        "category": "triggers",
        "icon": "File",
        "color": "bg-green-500",
        "label": {
            "en": "Salesforce Trigger",
            "es": "Salesforce Trigger"
        },
        "description": {
            "en": "Fetches data from Salesforce and starts the workflow on specified polling intervals.",
            "es": "Fetches data from Salesforce and starts the workflow on specified polling intervals."
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.salesmate",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Salesmate",
            "es": "Salesmate"
        },
        "description": {
            "en": "Consume Salesmate API",
            "es": "Consume Salesmate API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.scheduleTrigger",
        "category": "triggers",
        "icon": "Clock",
        "color": "bg-green-500",
        "label": {
            "en": "Schedule Trigger",
            "es": "Schedule Trigger"
        },
        "description": {
            "en": "Triggers the workflow on a given schedule",
            "es": "Triggers the workflow on a given schedule"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.seaTable",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "SeaTable",
            "es": "SeaTable"
        },
        "description": {
            "en": "Read, update, write and delete data from SeaTable",
            "es": "Read, update, write and delete data from SeaTable"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.seaTableTrigger",
        "category": "triggers",
        "icon": "File",
        "color": "bg-green-500",
        "label": {
            "en": "SeaTable Trigger",
            "es": "SeaTable Trigger"
        },
        "description": {
            "en": "Starts the workflow when SeaTable events occur",
            "es": "Starts the workflow when SeaTable events occur"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.SeaTable Trigger",
        "category": "utility",
        "icon": "Box",
        "color": "bg-blue-500",
        "label": {
            "en": "Table Name or ID",
            "es": "Table Name or ID"
        },
        "description": {
            "en": "The name of SeaTable table to access. Choose from the list, or specify an ID using an <a href=\"https://docs.n8n.io/code/expressions/\">expression</a>.",
            "es": "The name of SeaTable table to access. Choose from the list, or specify an ID using an <a href=\"https://docs.n8n.io/code/expressions/\">expression</a>."
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.securityScorecard",
        "category": "core",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "SecurityScorecard",
            "es": "SecurityScorecard"
        },
        "description": {
            "en": "Consume SecurityScorecard API",
            "es": "Consume SecurityScorecard API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.segment",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Segment",
            "es": "Segment"
        },
        "description": {
            "en": "Consume Segment API",
            "es": "Consume Segment API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.sendGrid",
        "category": "core",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "SendGrid",
            "es": "SendGrid"
        },
        "description": {
            "en": "Consume SendGrid API",
            "es": "Consume SendGrid API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.sendy",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Sendy",
            "es": "Sendy"
        },
        "description": {
            "en": "Consume Sendy API",
            "es": "Consume Sendy API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.sentryIo",
        "category": "utility",
        "icon": "Box",
        "color": "bg-blue-500",
        "label": {
            "en": "Sentry.io",
            "es": "Sentry.io"
        },
        "description": {
            "en": "Consume Sentry.io API",
            "es": "Consume Sentry.io API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.serviceNow",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "ServiceNow",
            "es": "ServiceNow"
        },
        "description": {
            "en": "Consume ServiceNow API",
            "es": "Consume ServiceNow API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.set",
        "category": "utility",
        "icon": "Box",
        "color": "bg-blue-500",
        "label": {
            "en": "Set",
            "es": "Set"
        },
        "description": {
            "en": "Add or edit fields on an input item and optionally remove other fields",
            "es": "Add or edit fields on an input item and optionally remove other fields"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.shopify",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Shopify",
            "es": "Shopify"
        },
        "description": {
            "en": "Consume Shopify API",
            "es": "Consume Shopify API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.shopifyTrigger",
        "category": "triggers",
        "icon": "File",
        "color": "bg-green-500",
        "label": {
            "en": "Shopify Trigger",
            "es": "Shopify Trigger"
        },
        "description": {
            "en": "Handle Shopify events via webhooks",
            "es": "Handle Shopify events via webhooks"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.signl4",
        "category": "core",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "SIGNL4",
            "es": "SIGNL4"
        },
        "description": {
            "en": "Consume SIGNL4 API",
            "es": "Consume SIGNL4 API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.simulate",
        "category": "utility",
        "icon": "Box",
        "color": "bg-blue-500",
        "label": {
            "en": "Simulate",
            "es": "Simulate"
        },
        "description": {
            "en": "Simulate a node",
            "es": "Simulate a node"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.simulateTrigger",
        "category": "triggers",
        "icon": "Box",
        "color": "bg-green-500",
        "label": {
            "en": "Simulate Trigger",
            "es": "Simulate Trigger"
        },
        "description": {
            "en": "Simulate a trigger node",
            "es": "Simulate a trigger node"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.slack",
        "category": "communication",
        "icon": "Hash",
        "color": "bg-blue-500",
        "label": {
            "en": "Slack",
            "es": "Slack"
        },
        "description": {
            "en": "Consume Slack API",
            "es": "Consume Slack API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.slackTrigger",
        "category": "triggers",
        "icon": "Hash",
        "color": "bg-green-500",
        "label": {
            "en": "Slack Trigger",
            "es": "Slack Trigger"
        },
        "description": {
            "en": "Handle Slack events via webhooks",
            "es": "Handle Slack events via webhooks"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.Slack",
        "category": "utility",
        "icon": "Box",
        "color": "bg-blue-500",
        "label": {
            "en": "Authentication",
            "es": "Authentication"
        },
        "description": {
            "en": "",
            "es": ""
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.sms77",
        "category": "core",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "seven",
            "es": "seven"
        },
        "description": {
            "en": "Send SMS and make text-to-speech calls",
            "es": "Send SMS and make text-to-speech calls"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.snowflake",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Snowflake",
            "es": "Snowflake"
        },
        "description": {
            "en": "Get, add and update data in Snowflake",
            "es": "Get, add and update data in Snowflake"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.splitInBatches",
        "category": "utility",
        "icon": "Box",
        "color": "bg-blue-500",
        "label": {
            "en": "Split In Batches",
            "es": "Split In Batches"
        },
        "description": {
            "en": "Split data into batches and iterate over each batch",
            "es": "Split data into batches and iterate over each batch"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.splunk",
        "category": "core",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Splunk",
            "es": "Splunk"
        },
        "description": {
            "en": "Consume the Splunk Enterprise API",
            "es": "Consume the Splunk Enterprise API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.spotify",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Spotify",
            "es": "Spotify"
        },
        "description": {
            "en": "Access public song data via the Spotify API",
            "es": "Access public song data via the Spotify API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.spreadsheetFile",
        "category": "productivity",
        "icon": "Box",
        "color": "bg-blue-500",
        "label": {
            "en": "Spreadsheet File",
            "es": "Spreadsheet File"
        },
        "description": {
            "en": "Reads and writes data from a spreadsheet file like CSV, XLS, ODS, etc",
            "es": "Reads and writes data from a spreadsheet file like CSV, XLS, ODS, etc"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.sseTrigger",
        "category": "triggers",
        "icon": "Box",
        "color": "bg-green-500",
        "label": {
            "en": "SSE Trigger",
            "es": "SSE Trigger"
        },
        "description": {
            "en": "Triggers the workflow when Server-Sent Events occur",
            "es": "Triggers the workflow when Server-Sent Events occur"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.ssh",
        "category": "utility",
        "icon": "Box",
        "color": "bg-blue-500",
        "label": {
            "en": "SSH",
            "es": "SSH"
        },
        "description": {
            "en": "Execute commands via SSH",
            "es": "Execute commands via SSH"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.stackby",
        "category": "core",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Stackby",
            "es": "Stackby"
        },
        "description": {
            "en": "Read, write, and delete data in Stackby",
            "es": "Read, write, and delete data in Stackby"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.stickyNote",
        "category": "utility",
        "icon": "Box",
        "color": "bg-blue-500",
        "label": {
            "en": "Sticky Note",
            "es": "Sticky Note"
        },
        "description": {
            "en": "Make your workflow easier to understand",
            "es": "Make your workflow easier to understand"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.stopAndError",
        "category": "utility",
        "icon": "Box",
        "color": "bg-blue-500",
        "label": {
            "en": "Stop and Error",
            "es": "Stop and Error"
        },
        "description": {
            "en": "Throw an error in the workflow",
            "es": "Throw an error in the workflow"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.storyblok",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Storyblok",
            "es": "Storyblok"
        },
        "description": {
            "en": "Consume Storyblok API",
            "es": "Consume Storyblok API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.strapi",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Strapi",
            "es": "Strapi"
        },
        "description": {
            "en": "Consume Strapi API",
            "es": "Consume Strapi API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.strava",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Strava",
            "es": "Strava"
        },
        "description": {
            "en": "Consume Strava API",
            "es": "Consume Strava API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.stravaTrigger",
        "category": "triggers",
        "icon": "File",
        "color": "bg-green-500",
        "label": {
            "en": "Strava Trigger",
            "es": "Strava Trigger"
        },
        "description": {
            "en": "Starts the workflow when Strava events occur",
            "es": "Starts the workflow when Strava events occur"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.stripe",
        "category": "core",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Stripe",
            "es": "Stripe"
        },
        "description": {
            "en": "Consume the Stripe API",
            "es": "Consume the Stripe API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.stripeTrigger",
        "category": "triggers",
        "icon": "File",
        "color": "bg-green-500",
        "label": {
            "en": "Stripe Trigger",
            "es": "Stripe Trigger"
        },
        "description": {
            "en": "Handle Stripe events via webhooks",
            "es": "Handle Stripe events via webhooks"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.supabase",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Supabase",
            "es": "Supabase"
        },
        "description": {
            "en": "Add, get, delete and update data in a table",
            "es": "Add, get, delete and update data in a table"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.surveyMonkeyTrigger",
        "category": "triggers",
        "icon": "File",
        "color": "bg-green-500",
        "label": {
            "en": "SurveyMonkey Trigger",
            "es": "SurveyMonkey Trigger"
        },
        "description": {
            "en": "Starts the workflow when Survey Monkey events occur",
            "es": "Starts the workflow when Survey Monkey events occur"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.switch",
        "category": "core",
        "icon": "Box",
        "color": "bg-blue-500",
        "label": {
            "en": "Switch",
            "es": "Switch"
        },
        "description": {
            "en": "Route items depending on defined expression or rules",
            "es": "Route items depending on defined expression or rules"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.Switch",
        "category": "utility",
        "icon": "Box",
        "color": "bg-blue-500",
        "label": {
            "en": "Mode",
            "es": "Mode"
        },
        "description": {
            "en": "Expression decides how to route data",
            "es": "Expression decides how to route data"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.syncroMsp",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "SyncroMSP",
            "es": "SyncroMSP"
        },
        "description": {
            "en": "Manage contacts, tickets and more from Syncro MSP",
            "es": "Manage contacts, tickets and more from Syncro MSP"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.taiga",
        "category": "core",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Taiga",
            "es": "Taiga"
        },
        "description": {
            "en": "Consume Taiga API",
            "es": "Consume Taiga API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.taigaTrigger",
        "category": "triggers",
        "icon": "File",
        "color": "bg-green-500",
        "label": {
            "en": "Taiga Trigger",
            "es": "Taiga Trigger"
        },
        "description": {
            "en": "Handle Taiga events via webhook",
            "es": "Handle Taiga events via webhook"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.tapfiliate",
        "category": "core",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Tapfiliate",
            "es": "Tapfiliate"
        },
        "description": {
            "en": "Consume Tapfiliate API",
            "es": "Consume Tapfiliate API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.telegram",
        "category": "communication",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Telegram",
            "es": "Telegram"
        },
        "description": {
            "en": "Sends data to Telegram",
            "es": "Sends data to Telegram"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.telegramTrigger",
        "category": "triggers",
        "icon": "File",
        "color": "bg-green-500",
        "label": {
            "en": "Telegram Trigger",
            "es": "Telegram Trigger"
        },
        "description": {
            "en": "Starts the workflow on a Telegram update",
            "es": "Starts the workflow on a Telegram update"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.theHive",
        "category": "core",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "TheHive",
            "es": "TheHive"
        },
        "description": {
            "en": "Consume TheHive API",
            "es": "Consume TheHive API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.theHiveTrigger",
        "category": "triggers",
        "icon": "File",
        "color": "bg-green-500",
        "label": {
            "en": "TheHive Trigger",
            "es": "TheHive Trigger"
        },
        "description": {
            "en": "Starts the workflow when TheHive events occur",
            "es": "Starts the workflow when TheHive events occur"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.theHiveProjectTrigger",
        "category": "triggers",
        "icon": "File",
        "color": "bg-green-500",
        "label": {
            "en": "TheHive 5 Trigger",
            "es": "TheHive 5 Trigger"
        },
        "description": {
            "en": "Starts the workflow when TheHive events occur",
            "es": "Starts the workflow when TheHive events occur"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.timeSaved",
        "category": "utility",
        "icon": "Clock",
        "color": "bg-blue-500",
        "label": {
            "en": "Track Time Saved",
            "es": "Track Time Saved"
        },
        "description": {
            "en": "Dynamically track time saved based on the workflow’s execution path and the number of items processed",
            "es": "Dynamically track time saved based on the workflow’s execution path and the number of items processed"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.timescaleDb",
        "category": "utility",
        "icon": "Box",
        "color": "bg-blue-500",
        "label": {
            "en": "TimescaleDB",
            "es": "TimescaleDB"
        },
        "description": {
            "en": "Add and update data in TimescaleDB",
            "es": "Add and update data in TimescaleDB"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.todoist",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Todoist",
            "es": "Todoist"
        },
        "description": {
            "en": "Consume Todoist API",
            "es": "Consume Todoist API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.Berry Red",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Todoist",
            "es": "Todoist"
        },
        "description": {
            "en": "Consume Todoist API",
            "es": "Consume Todoist API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.togglTrigger",
        "category": "triggers",
        "icon": "File",
        "color": "bg-green-500",
        "label": {
            "en": "Toggl Trigger",
            "es": "Toggl Trigger"
        },
        "description": {
            "en": "Starts the workflow when Toggl events occur",
            "es": "Starts the workflow when Toggl events occur"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.totp",
        "category": "core",
        "icon": "Box",
        "color": "bg-blue-500",
        "label": {
            "en": "TOTP",
            "es": "TOTP"
        },
        "description": {
            "en": "Generate a time-based one-time password",
            "es": "Generate a time-based one-time password"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.aggregate",
        "category": "core",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Aggregate",
            "es": "Aggregate"
        },
        "description": {
            "en": "Combine a field from many items into a list in a single item",
            "es": "Combine a field from many items into a list in a single item"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.limit",
        "category": "core",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Limit",
            "es": "Limit"
        },
        "description": {
            "en": "Restrict the number of items",
            "es": "Restrict the number of items"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.removeDuplicates",
        "category": "core",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Remove Duplicates",
            "es": "Remove Duplicates"
        },
        "description": {
            "en": "Delete items with matching field values",
            "es": "Delete items with matching field values"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.sort",
        "category": "core",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Sort",
            "es": "Sort"
        },
        "description": {
            "en": "Change items order",
            "es": "Change items order"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.splitOut",
        "category": "core",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Split Out",
            "es": "Split Out"
        },
        "description": {
            "en": "Turn a list inside item(s) into separate items",
            "es": "Turn a list inside item(s) into separate items"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.summarize",
        "category": "core",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Summarize",
            "es": "Summarize"
        },
        "description": {
            "en": "Sum, count, max, etc. across items",
            "es": "Sum, count, max, etc. across items"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.travisCi",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "TravisCI",
            "es": "TravisCI"
        },
        "description": {
            "en": "Consume TravisCI API",
            "es": "Consume TravisCI API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.trello",
        "category": "core",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Trello",
            "es": "Trello"
        },
        "description": {
            "en": "Create, change and delete boards and cards",
            "es": "Create, change and delete boards and cards"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.trelloTrigger",
        "category": "triggers",
        "icon": "File",
        "color": "bg-green-500",
        "label": {
            "en": "Trello Trigger",
            "es": "Trello Trigger"
        },
        "description": {
            "en": "Starts the workflow when Trello events occur",
            "es": "Starts the workflow when Trello events occur"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.twake",
        "category": "core",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Twake",
            "es": "Twake"
        },
        "description": {
            "en": "Consume Twake API",
            "es": "Consume Twake API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.twilio",
        "category": "core",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Twilio",
            "es": "Twilio"
        },
        "description": {
            "en": "Send SMS and WhatsApp messages or make phone calls",
            "es": "Send SMS and WhatsApp messages or make phone calls"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.twilioTrigger",
        "category": "triggers",
        "icon": "File",
        "color": "bg-green-500",
        "label": {
            "en": "Twilio Trigger",
            "es": "Twilio Trigger"
        },
        "description": {
            "en": "Starts the workflow on a Twilio update",
            "es": "Starts the workflow on a Twilio update"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.twist",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Twist",
            "es": "Twist"
        },
        "description": {
            "en": "Consume Twist API",
            "es": "Consume Twist API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.twitter",
        "category": "utility",
        "icon": "Box",
        "color": "bg-blue-500",
        "label": {
            "en": "X (Formerly Twitter)",
            "es": "X (Formerly Twitter)"
        },
        "description": {
            "en": "Consume the X API",
            "es": "Consume the X API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.Twitter",
        "category": "utility",
        "icon": "Box",
        "color": "bg-blue-500",
        "label": {
            "en": "Resource",
            "es": "Resource"
        },
        "description": {
            "en": "Consume Twitter API",
            "es": "Consume Twitter API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.X",
        "category": "utility",
        "icon": "Box",
        "color": "bg-blue-500",
        "label": {
            "en": "Resource",
            "es": "Resource"
        },
        "description": {
            "en": "Post, like, and search tweets, send messages, search users, and add users to lists",
            "es": "Post, like, and search tweets, send messages, search users, and add users to lists"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.typeformTrigger",
        "category": "triggers",
        "icon": "Box",
        "color": "bg-green-500",
        "label": {
            "en": "Typeform Trigger",
            "es": "Typeform Trigger"
        },
        "description": {
            "en": "Starts the workflow on a Typeform form submission",
            "es": "Starts the workflow on a Typeform form submission"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.uproc",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "uProc",
            "es": "uProc"
        },
        "description": {
            "en": "Consume uProc API",
            "es": "Consume uProc API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.unleashedSoftware",
        "category": "core",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Unleashed Software",
            "es": "Unleashed Software"
        },
        "description": {
            "en": "Consume Unleashed Software API",
            "es": "Consume Unleashed Software API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.uplead",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Uplead",
            "es": "Uplead"
        },
        "description": {
            "en": "Consume Uplead API",
            "es": "Consume Uplead API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.uptimeRobot",
        "category": "utility",
        "icon": "Clock",
        "color": "bg-blue-500",
        "label": {
            "en": "UptimeRobot",
            "es": "UptimeRobot"
        },
        "description": {
            "en": "Consume UptimeRobot API",
            "es": "Consume UptimeRobot API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.urlScanIo",
        "category": "core",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "urlscan.io",
            "es": "urlscan.io"
        },
        "description": {
            "en": "Provides various utilities for monitoring websites like health checks or screenshots",
            "es": "Provides various utilities for monitoring websites like health checks or screenshots"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.venafiTlsProtectDatacenter",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Venafi TLS Protect Datacenter",
            "es": "Venafi TLS Protect Datacenter"
        },
        "description": {
            "en": "Consume Venafi TLS Protect Datacenter",
            "es": "Consume Venafi TLS Protect Datacenter"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.venafiTlsProtectDatacenterTrigger",
        "category": "triggers",
        "icon": "File",
        "color": "bg-green-500",
        "label": {
            "en": "Venafi TLS Protect Datacenter Trigger",
            "es": "Venafi TLS Protect Datacenter Trigger"
        },
        "description": {
            "en": "Starts the workflow when Venafi events occur",
            "es": "Starts the workflow when Venafi events occur"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.venafiTlsProtectCloud",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Venafi TLS Protect Cloud",
            "es": "Venafi TLS Protect Cloud"
        },
        "description": {
            "en": "Consume Venafi TLS Protect Cloud API",
            "es": "Consume Venafi TLS Protect Cloud API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.venafiTlsProtectCloudTrigger",
        "category": "triggers",
        "icon": "File",
        "color": "bg-green-500",
        "label": {
            "en": "Venafi TLS Protect Cloud Trigger",
            "es": "Venafi TLS Protect Cloud Trigger"
        },
        "description": {
            "en": "Starts the workflow when Venafi events occur",
            "es": "Starts the workflow when Venafi events occur"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.vero",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Vero",
            "es": "Vero"
        },
        "description": {
            "en": "Consume Vero API",
            "es": "Consume Vero API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.vonage",
        "category": "utility",
        "icon": "Box",
        "color": "bg-blue-500",
        "label": {
            "en": "Vonage",
            "es": "Vonage"
        },
        "description": {
            "en": "Consume Vonage API",
            "es": "Consume Vonage API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.amount",
        "category": "utility",
        "icon": "Box",
        "color": "bg-blue-500",
        "label": {
            "en": "Wait Amount",
            "es": "Wait Amount"
        },
        "description": {
            "en": "The time to wait",
            "es": "The time to wait"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.webflowTrigger",
        "category": "triggers",
        "icon": "File",
        "color": "bg-green-500",
        "label": {
            "en": "Webflow Trigger",
            "es": "Webflow Trigger"
        },
        "description": {
            "en": "Handle Webflow events via webhooks",
            "es": "Handle Webflow events via webhooks"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.Webflow",
        "category": "utility",
        "icon": "Box",
        "color": "bg-blue-500",
        "label": {
            "en": "Authentication",
            "es": "Authentication"
        },
        "description": {
            "en": "Consume the Webflow API",
            "es": "Consume the Webflow API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.webflow",
        "category": "core",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Webflow",
            "es": "Webflow"
        },
        "description": {
            "en": "Consume the Webflow API",
            "es": "Consume the Webflow API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.webhook",
        "category": "triggers",
        "icon": "Box",
        "color": "bg-green-500",
        "label": {
            "en": "Webhook",
            "es": "Webhook"
        },
        "description": {
            "en": "Starts the workflow when a webhook is called",
            "es": "Starts the workflow when a webhook is called"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.wekan",
        "category": "core",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Wekan",
            "es": "Wekan"
        },
        "description": {
            "en": "Consume Wekan API",
            "es": "Consume Wekan API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.whatsApp",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "WhatsApp Business Cloud",
            "es": "WhatsApp Business Cloud"
        },
        "description": {
            "en": "Access WhatsApp API",
            "es": "Access WhatsApp API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.whatsAppTrigger",
        "category": "triggers",
        "icon": "File",
        "color": "bg-green-500",
        "label": {
            "en": "WhatsApp Trigger",
            "es": "WhatsApp Trigger"
        },
        "description": {
            "en": "Handle WhatsApp events via webhooks",
            "es": "Handle WhatsApp events via webhooks"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.wise",
        "category": "core",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Wise",
            "es": "Wise"
        },
        "description": {
            "en": "Consume the Wise API",
            "es": "Consume the Wise API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.wiseTrigger",
        "category": "triggers",
        "icon": "File",
        "color": "bg-green-500",
        "label": {
            "en": "Wise Trigger",
            "es": "Wise Trigger"
        },
        "description": {
            "en": "Handle Wise events via webhooks",
            "es": "Handle Wise events via webhooks"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.wooCommerce",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "WooCommerce",
            "es": "WooCommerce"
        },
        "description": {
            "en": "Consume WooCommerce API",
            "es": "Consume WooCommerce API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.wooCommerceTrigger",
        "category": "triggers",
        "icon": "File",
        "color": "bg-green-500",
        "label": {
            "en": "WooCommerce Trigger",
            "es": "WooCommerce Trigger"
        },
        "description": {
            "en": "Handle WooCommerce events via webhooks",
            "es": "Handle WooCommerce events via webhooks"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.wordpress",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Wordpress",
            "es": "Wordpress"
        },
        "description": {
            "en": "Consume Wordpress API",
            "es": "Consume Wordpress API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.workableTrigger",
        "category": "triggers",
        "icon": "File",
        "color": "bg-green-500",
        "label": {
            "en": "Workable Trigger",
            "es": "Workable Trigger"
        },
        "description": {
            "en": "Starts the workflow when Workable events occur",
            "es": "Starts the workflow when Workable events occur"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.workflowTrigger",
        "category": "triggers",
        "icon": "Box",
        "color": "bg-green-500",
        "label": {
            "en": "Workflow Trigger",
            "es": "Workflow Trigger"
        },
        "description": {
            "en": "Triggers based on various lifecycle events, like when a workflow is activated",
            "es": "Triggers based on various lifecycle events, like when a workflow is activated"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.writeBinaryFile",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Write Binary File",
            "es": "Write Binary File"
        },
        "description": {
            "en": "Writes a binary file to disk",
            "es": "Writes a binary file to disk"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.wufooTrigger",
        "category": "triggers",
        "icon": "File",
        "color": "bg-green-500",
        "label": {
            "en": "Wufoo Trigger",
            "es": "Wufoo Trigger"
        },
        "description": {
            "en": "Handle Wufoo events via webhooks",
            "es": "Handle Wufoo events via webhooks"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.xero",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Xero",
            "es": "Xero"
        },
        "description": {
            "en": "Consume Xero API",
            "es": "Consume Xero API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.xml",
        "category": "core",
        "icon": "Code",
        "color": "bg-blue-500",
        "label": {
            "en": "XML",
            "es": "XML"
        },
        "description": {
            "en": "Convert data from and to XML",
            "es": "Convert data from and to XML"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.yourls",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Yourls",
            "es": "Yourls"
        },
        "description": {
            "en": "Consume Yourls API",
            "es": "Consume Yourls API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.zammad",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Zammad",
            "es": "Zammad"
        },
        "description": {
            "en": "Consume the Zammad API",
            "es": "Consume the Zammad API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.zendesk",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Zendesk",
            "es": "Zendesk"
        },
        "description": {
            "en": "Consume Zendesk API",
            "es": "Consume Zendesk API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.zendeskTrigger",
        "category": "triggers",
        "icon": "File",
        "color": "bg-green-500",
        "label": {
            "en": "Zendesk Trigger",
            "es": "Zendesk Trigger"
        },
        "description": {
            "en": "Handle Zendesk events via webhooks",
            "es": "Handle Zendesk events via webhooks"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.zohoCrm",
        "category": "core",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Zoho CRM",
            "es": "Zoho CRM"
        },
        "description": {
            "en": "Consume Zoho CRM API",
            "es": "Consume Zoho CRM API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.zoom",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Zoom",
            "es": "Zoom"
        },
        "description": {
            "en": "Consume Zoom API",
            "es": "Consume Zoom API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    },
    {
        "type": "n8n-nodes-base.zulip",
        "category": "utility",
        "icon": "File",
        "color": "bg-blue-500",
        "label": {
            "en": "Zulip",
            "es": "Zulip"
        },
        "description": {
            "en": "Consume Zulip API",
            "es": "Consume Zulip API"
        },
        "inputs": [
            {
                "name": "main",
                "type": "main"
            }
        ],
        "outputs": [
            {
                "name": "main",
                "type": "main"
            }
        ]
    }
];

async function main() {
    console.log('Seeding 447 Node Types from Scan...');
    for (const node of NODES) {
        await prisma.nodeType.upsert({
            where: { type: node.type },
            update: {
                category: node.category,
                icon: node.icon,
                color: node.color,
                label: node.label,
                description: node.description,
                inputs: node.inputs,
                outputs: node.outputs,
            },
            create: {
                type: node.type,
                category: node.category,
                icon: node.icon,
                color: node.color,
                label: node.label,
                description: node.description,
                inputs: node.inputs,
                outputs: node.outputs,
            },
        });
    }
    console.log('Node Types seeded successfully!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
