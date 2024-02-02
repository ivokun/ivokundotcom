import { StackContext, Api, Function } from "sst/constructs";
import { Certificate } from "aws-cdk-lib/aws-certificatemanager";

export function CMS({ app, stack }: StackContext) {
  const strapiFunction = new Function(stack, "Strapi", {
    timeout: 90,
    memorySize: 1024,
    handler: "./",
    environment: {
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
    },
    runtime: "container",
  });

  const existingCertificate = Certificate.fromCertificateArn(
    stack,
    "BlogCert",
    process.env.ACM_CERTIFICATE_ARN!
  );

  const apiCustomDomain =
    app.stage === "prod"
      ? {
          customDomain: {
            domainName: "cms.ivokun.com",
            isExternalDomain: true,
            cdk: {
              certificate: existingCertificate,
            },
          },
        }
      : {};

  const api = new Api(stack, "api", {
    routes: {
      "ANY /{proxy+}": strapiFunction,
    },
    ...apiCustomDomain,
  });
  stack.addOutputs({
    ApiEndpoint: api.url,
  });
}
