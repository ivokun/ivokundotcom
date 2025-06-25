export default ({ env }) => ({
  upload: {
    config: {
      provider: "strapi-provider-cloudflare-r2",
      providerOptions: {
        accessKeyId: env("R2_ACCESS_KEY_ID"),
        secretAccessKey: env("R2_ACCESS_SECRET"),
        endpoint: env("R2_ENDPOINT"),
        params: {
          Bucket: "ivokun-prod",
        },
        cloudflarePublicAccessUrl: env("R2_PUBLIC_URL"),
      },
      actionOptions: {
        upload: {},
        uploadStream: {},
        delete: {},
      },
    },
  },
});
