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
