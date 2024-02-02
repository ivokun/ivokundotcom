export default ({ env }) => ({
  upload: {
    config: {
      provider: "strapi-provider-upload-cloudflare-r2",
      providerOptions: {
        accessKeyId: env("R2_ACCESS_KEY_ID"),
        secretAccessKey: env("R2_ACCESS_SECRET"),
        region: "us-east-1",
        params: {
          Bucket: "ivokun-prod",
          accountId: env("R2_ACCOUNT_ID"),
          publicUrl: env("R2_PUBLIC_URL"),
        },
      },
      actionOptions: {
        upload: {},
        uploadStream: {},
        delete: {},
      },
    },
  },
});
