/// <reference path="./.sst/platform/config.d.ts" />
export default $config({
  app(input) {
    return {
      name: "ivokun",
      removal: input?.stage === "production" ? "retain" : "remove",
      protect: ["production"].includes(input?.stage),
      home: "aws",
      providers: {
        docker: "4.8.0",
        cloudflare: "6.3.1",
        aws: "6.83.0",
      },
    };
  },
  async run() {
    if (!$dev) {
      // Image repository
      const repo = new aws.ecr.Repository("strapi", {
        forceDelete: true,
      });
      const ecrCreds = aws.ecr.getAuthorizationTokenOutput({});
      const ecrRegistry = ecrCreds.proxyEndpoint.apply((endpoint) =>
        endpoint.replace("https://", ""),
      );
      // Build and push the Strapi image to ECR
      const strapiImage = new docker.Image("Strapi", {
        imageName: $interpolate`${repo.repositoryUrl}:latest`,
        build: {
          context: "../../",
          platform: "linux/amd64",
          cacheFrom: {
            images: [
              $interpolate`${repo.repositoryUrl}:latest`,
            ],
          }
        },
        registry: {
          server: ecrRegistry,
          username: ecrCreds.userName,
          password: ecrCreds.password,
        },
      });

      const strapiLambdaRole = new aws.iam.Role("StrapiLambdaRole", {
        assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({ Service: "lambda.amazonaws.com" }),
      });
      new aws.iam.RolePolicyAttachment("lambdaRoleAttachment", {
        role: strapiLambdaRole,
        policyArn: aws.iam.ManagedPolicies.AWSLambdaBasicExecutionRole,
      });
      const strapiFunction = new aws.lambda.Function("Strapi", {
        name: `${$app.stage}-${$app.name}-strapi`,
        description: "Strapi CMS",
        timeout: 90,
        memorySize: 1024,
        imageUri: strapiImage.repoDigest,
        role: strapiLambdaRole.arn,
        packageType: "Image",
        environment: {
          variables: {
            STRAPI_URL: process.env.STRAPI_URL!,
            APP_KEYS: process.env.APP_KEYS!,
            API_TOKEN_SALT: process.env.API_TOKEN_SALT!,
            ADMIN_JWT_SECRET: process.env.ADMIN_JWT_SECRET!,
            JWT_SECRET: process.env.JWT_SECRET!,
            DATABASE_URL: process.env.DATABASE_URL!,
            R2_PUBLIC_URL: process.env.R2_PUBLIC_URL!,
            R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID!,
            R2_BUCKET: process.env.R2_BUCKET!,
            R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID!,
            R2_ACCESS_SECRET: process.env.R2_ACCESS_SECRET!,
            HOME: "/tmp",

          }
        },
      });
      // TODO: add API gateway domain
      const strapiAPI = new sst.aws.ApiGatewayV2("api", {
        // domain:
        //   $app.stage === "production"
        //     ? {
        //         name: "cms.ivokun.com",
        //         dns: sst.cloudflare.dns({
        //           zone: "222b459f2d9654d0eeb8038097b8134c",
        //         }),
        //       }
        //     : undefined,
      });
      strapiAPI.route("ANY /{proxy+}", strapiFunction.arn)
    }


    // API-HONO Section
    const apiHonoTable = new sst.aws.Dynamo("apiHonoTable", {
      fields: {
        pk: "string",
        sk: "string",
        gsi1pk: "string",
        gsi1sk: "string",
      },
      primaryIndex: { hashKey: "pk", rangeKey: "sk" },
      globalIndexes: {
        "gsi1pk-gsi1sk-index": { hashKey: "gsi1pk", rangeKey: "gsi1sk", projection: "all" },
      }
    })

    const apiHonoFunction = new sst.aws.Function("apiHono", {
      url: true,
      handler: "api-hono/src/app.handler",
      runtime: "nodejs22.x",
      link: [apiHonoTable],
    });


  },
});
