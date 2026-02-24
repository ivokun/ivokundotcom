/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly CMS_API_URL: string;
  readonly CMS_API_TOKEN: string;
  readonly PUBLIC_GOOGLE_SITE_VERIFICATION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
