import { StackContext, Api, Function } from "sst/constructs";

export function CMS({ stack }: StackContext) {
  const strapiFunction = new Function(stack, "Strapi", {
    handler: "api",
    environment: {
      STRAPI_URL: process.env.STRAPI_URL!,
    },
    runtime: "container",
  });

  const api = new Api(stack, "api", {
    routes: {
      "ANY /{proxy+}": strapiFunction,
    },
  });
  stack.addOutputs({
    ApiEndpoint: api.url,
  });
}
