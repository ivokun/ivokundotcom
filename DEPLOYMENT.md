# AWS Deployment Documentation

This document provides comprehensive instructions for deploying the Ivokun blog application to AWS using SST (Serverless Stack) v2. The application consists of a Strapi 5 API backend and an Astro 5 frontend.

## Architecture Overview

The deployment uses a serverless architecture on AWS with the following components:

```mermaid
graph TB
    subgraph "AWS Cloud"
        subgraph "API Gateway"
            A[API Gateway]
            B[Custom Domain cms.ivokun.com]
        end
        
        subgraph "Compute"
            C[Lambda Function Container]
            D[Strapi 5 API]
        end
        
        subgraph "Storage & Database"
            E[External PostgreSQL]
            F[Cloudflare R2]
        end
        
        subgraph "Frontend Hosting"
            G[S3 Static Hosting]
            H[CloudFront CDN]
            I[Custom Domain ivokun.com]
        end
        
        subgraph "Security & Networking"
            J[ACM Certificate]
            K[Route 53 DNS]
            L[Lambda Adapter]
        end
    end
    
    subgraph "External Services"
        M[External PostgreSQL Database]
        N[Cloudflare R2 Storage]
        O[Domain Registrar]
    end
    
    A --> C
    B --> A
    C --> D
    D --> M
    D --> N
    
    G --> H
    H --> I
    
    J --> B
    J --> I
    K --> B
    K --> I
    
    L --> C
    
    subgraph "SST v2 Components"
        P[Function Construct]
        Q[Api Construct]
        R[Certificate Import]
        S[Custom Domain Config]
    end
    
    P --> C
    Q --> A
    R --> J
    S --> B
```

## Prerequisites

### AWS Account Setup

1. **AWS Account**: Active AWS account with appropriate permissions
2. **AWS CLI**: Installed and configured with your credentials
3. **IAM Permissions**: Your AWS user/role needs permissions for:
   - Lambda functions
   - API Gateway
   - CloudFormation
   - S3 buckets
   - CloudFront distributions
   - Certificate Manager
   - Route 53 (if managing DNS)

### Required Tools

- **Node.js**: >= 22.17.0
- **pnpm**: >= 9.5.0
- **SST CLI**: v2.39.13 (installed as dev dependency)
- **AWS CLI**: v2.x recommended
- **Docker**: For container builds (Lambda runtime)

### External Services Setup

1. **PostgreSQL Database**
   - Set up a PostgreSQL database (AWS RDS, PlanetScale, or other provider)
   - Note the connection string for `DATABASE_URL`

2. **Cloudflare R2**
   - Create Cloudflare R2 bucket for media storage
   - Generate API tokens and note bucket details

3. **Domain & SSL Certificate**
   - Domain registered and managed (Route 53 or external)
   - SSL certificate in AWS Certificate Manager
   - Note the certificate ARN

## Environment Configuration

### Root Environment Variables

Create a `.env` file in the project root:

```bash
# AWS Configuration
AWS_REGION=ap-southeast-1
AWS_PROFILE=your-aws-profile

# SSL Certificate
ACM_CERTIFICATE_ARN=arn:aws:acm:us-east-1:123456789:certificate/your-cert-id

# Strapi Configuration
STRAPI_URL=https://cms.ivokun.com
APP_KEYS=your-app-keys-comma-separated
API_TOKEN_SALT=your-api-token-salt
ADMIN_JWT_SECRET=your-admin-jwt-secret
JWT_SECRET=your-jwt-secret
TRANSFER_TOKEN_SALT=your-transfer-token-salt

# Database
DATABASE_URL=postgresql://user:password@host:port/database

# Cloudflare R2 Storage
R2_PUBLIC_URL=https://your-r2-public-url.com
R2_ACCOUNT_ID=your-cloudflare-account-id
R2_BUCKET=your-bucket-name
R2_ACCESS_KEY_ID=your-r2-access-key
R2_ACCESS_SECRET=your-r2-secret-key
R2_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com
```

### Generating Strapi Secrets

Generate secure secrets for Strapi:

```bash
# Generate random secrets (32+ characters each)
openssl rand -base64 32  # For APP_KEYS (generate 4, comma-separate)
openssl rand -base64 32  # For API_TOKEN_SALT
openssl rand -base64 32  # For ADMIN_JWT_SECRET
openssl rand -base64 32  # For JWT_SECRET
openssl rand -base64 32  # For TRANSFER_TOKEN_SALT
```

## SST Configuration

### Project Structure

The SST configuration is located in:

```
/
├── sst.config.ts          # Main SST configuration
├── stacks/
│   └── BlogStack.ts       # Infrastructure stack definition
├── package.json           # Dependencies and scripts
└── .env                   # Environment variables
```

### Stack Configuration (`sst.config.ts`)

```typescript
import { SSTConfig } from "sst";
import { CMS } from "./stacks/BlogStack";

export default {
  config(_input) {
    return {
      name: "ivokun",
      region: "ap-southeast-1",
    };
  },
  stacks(app) {
    app.stack(CMS);
  },
} satisfies SSTConfig;
```

### Infrastructure Stack (`stacks/BlogStack.ts`)

The stack defines:

- **Lambda Function**: Containerized Strapi application
- **API Gateway**: HTTP API with custom domain
- **Certificate**: SSL certificate integration
- **Environment Variables**: Runtime configuration

Key components:

```typescript
// Lambda Function with Container Runtime
const strapiFunction = new Function(stack, "Strapi", {
  timeout: 90,
  memorySize: 1024,
  handler: "./",
  runtime: "container",
  environment: {
    // All environment variables
  },
});

// API Gateway with Custom Domain
const api = new Api(stack, "api", {
  routes: {
    "ANY /{proxy+}": strapiFunction,
  },
  customDomain: {
    domainName: "cms.ivokun.com",
    isExternalDomain: true,
    cdk: {
      certificate: existingCertificate,
    },
  },
});
```

## Deployment Process

### 1. Initial Setup

```bash
# Clone and install dependencies
git clone <repository>
cd ivokun
pnpm install

# Configure AWS credentials
aws configure
# or
export AWS_PROFILE=your-profile
```

### 2. Environment Setup

```bash
# Copy environment template
cp .env.example .env

# Edit environment variables
nano .env

# Ensure all required variables are set
```

### 3. Development Deployment

```bash
# Start SST in development mode
pnpm run dev

# This will:
# - Deploy infrastructure to AWS
# - Set up live Lambda debugging
# - Hot reload on code changes
```

### 4. Production Deployment

```bash
# Build the application
pnpm run build

# Deploy to production
pnpm run deploy --stage prod

# Monitor deployment
pnpm run console
```

### 5. Frontend Deployment

The frontend (Astro) can be deployed separately:

```bash
# Build static site
cd web/
pnpm run build

# Deploy to S3 + CloudFront (manual or CI/CD)
aws s3 sync dist/ s3://your-frontend-bucket
aws cloudfront create-invalidation --distribution-id YOUR_ID --paths "/*"
```

## SST Commands

### Development Commands

```bash
# Start development environment
pnpm run dev

# View SST console (resource management)
pnpm run console

# View logs
sst logs --stage dev

# Remove development stack
pnpm run remove --stage dev
```

### Production Commands

```bash
# Deploy to production
pnpm run deploy --stage prod

# View production logs
sst logs --stage prod

# Update production stack
pnpm run deploy --stage prod

# Remove production stack (careful!)
pnpm run remove --stage prod
```

### Debugging Commands

```bash
# Check stack status
sst list

# View stack outputs
sst info

# Debug function locally
sst start --stage dev
```

## Monitoring & Debugging

### CloudWatch Logs

Monitor application logs in AWS CloudWatch:

```bash
# View real-time logs
sst logs --stage prod --tail

# View specific function logs
aws logs describe-log-groups --log-group-name-prefix /aws/lambda/ivokun
```

### SST Console

Use SST Console for resource management:

```bash
pnpm run console
```

Access at: https://console.sst.dev

### Lambda Insights

Monitor Lambda performance:
- Memory usage
- Cold starts
- Execution duration
- Error rates

## Custom Domain Setup

### Certificate Manager

1. **Request Certificate**:
   ```bash
   aws acm request-certificate \
     --domain-name cms.ivokun.com \
     --domain-name ivokun.com \
     --validation-method DNS \
     --region us-east-1
   ```

2. **Validate Certificate**:
   - Add DNS records provided by ACM
   - Wait for validation (can take up to 30 minutes)

3. **Note Certificate ARN**:
   ```bash
   aws acm list-certificates --region us-east-1
   ```

### Route 53 Setup (Optional)

If using Route 53 for DNS:

```bash
# Create hosted zone
aws route53 create-hosted-zone --name ivokun.com --caller-reference $(date +%s)

# Update nameservers at domain registrar
# Add A/ALIAS records for your domains
```

## Troubleshooting

### Common Issues

1. **Lambda Timeout**:
   - Increase timeout in `BlogStack.ts`
   - Optimize Strapi startup time
   - Consider keeping Lambda warm

2. **Memory Issues**:
   - Increase `memorySize` in function config
   - Monitor CloudWatch metrics
   - Optimize Strapi memory usage

3. **Container Build Failures**:
   - Check Docker configuration
   - Verify Node.js version compatibility
   - Review Lambda runtime logs

4. **Database Connection**:
   - Verify `DATABASE_URL` format
   - Check database accessibility
   - Review VPC configuration if needed

5. **Custom Domain Issues**:
   - Verify certificate ARN
   - Check DNS configuration
   - Ensure certificate is in us-east-1 region

### Debugging Steps

1. **Check Stack Status**:
   ```bash
   sst list --stage prod
   ```

2. **View CloudFormation**:
   - Go to AWS CloudFormation console
   - Check stack events and resources

3. **Lambda Function Logs**:
   ```bash
   aws logs tail /aws/lambda/ivokun-prod-Strapi --follow
   ```

4. **API Gateway Logs**:
   - Enable logging in API Gateway
   - Check access logs and execution logs

## Performance Optimization

### Lambda Optimization

1. **Provisioned Concurrency**:
   ```typescript
   const strapiFunction = new Function(stack, "Strapi", {
     // ... other config
     reservedConcurrency: 5,
   });
   ```

2. **Container Optimization**:
   - Use multi-stage Docker builds
   - Minimize container size
   - Cache dependencies

3. **Environment Variables**:
   - Store large configs in S3
   - Use SSM Parameter Store for secrets

### Database Optimization

1. **Connection Pooling**:
   - Configure proper pool sizes
   - Use connection limits

2. **Read Replicas**:
   - Separate read/write operations
   - Use read replicas for better performance

## Security Best Practices

### Environment Variables

- Never commit secrets to version control
- Use AWS SSM Parameter Store for sensitive data
- Rotate secrets regularly

### IAM Permissions

- Follow least privilege principle
- Use specific resource ARNs
- Regular permission audits

### Network Security

- Consider VPC deployment for sensitive data
- Use WAF for API protection
- Enable CloudTrail for audit logs

## Cost Optimization

### Lambda Costs

- Monitor execution time and memory usage
- Use ARM64 architecture for cost savings
- Implement proper caching strategies

### API Gateway Costs

- Use HTTP API instead of REST API when possible
- Implement request caching
- Monitor request patterns

### CloudWatch Costs

- Set appropriate log retention periods
- Use log groups filtering
- Monitor metrics usage

## Backup & Recovery

### Database Backups

- Configure automated backups
- Test restore procedures
- Document backup retention policies

### Application Backups

- Version control for all infrastructure code
- Export Strapi content regularly
- Document recovery procedures

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Deploy to AWS
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '22.17.0'
      
      - name: Install dependencies
        run: pnpm install
      
      - name: Deploy to AWS
        run: pnpm run deploy --stage prod
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
```

### Environment Management

- Use different stages for dev/staging/prod
- Implement proper secret management
- Automate testing before deployment

## Support & Resources

### SST Resources

- [SST Documentation](https://docs.sst.dev/)
- [SST Discord Community](https://discord.gg/sst)
- [SST Examples](https://github.com/serverless-stack/sst/tree/master/examples)

### AWS Resources

- [AWS Lambda Documentation](https://docs.aws.amazon.com/lambda/)
- [API Gateway Documentation](https://docs.aws.amazon.com/apigateway/)
- [CloudFormation Documentation](https://docs.aws.amazon.com/cloudformation/)

### Strapi Resources

- [Strapi Deployment Guide](https://docs.strapi.io/developer-docs/latest/setup-deployment-guides/deployment.html)
- [Strapi Docker Guide](https://docs.strapi.io/developer-docs/latest/setup-deployment-guides/installation/docker.html)