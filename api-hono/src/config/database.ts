import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { Service } from 'electrodb';

import { CategoryModel } from '@/models/category.model';
import { GalleryModel } from '@/models/gallery.model';
import { HomeModel } from '@/models/home.model';
import { MediaModel } from '@/models/media.model';
import { PostModel } from '@/models/post.model';
import { TokenModel } from '@/models/token.model';
import { UserModel } from '@/models/user.model';
import { WebhookModel } from '@/models/webhook.model';

import { config } from './environment';

const dynamoClient = new DynamoDBClient();

const documentClient = DynamoDBDocumentClient.from(dynamoClient, {
  marshallOptions: {
    removeUndefinedValues: true,
    convertEmptyValues: false,
  },
  unmarshallOptions: {
    wrapNumbers: false,
  },
});

export const DatabaseService = new Service({
  posts: PostModel,
  categories: CategoryModel,
  galleries: GalleryModel,
  home: HomeModel,
  media: MediaModel,
  users: UserModel,
  tokens: TokenModel,
  webhooks: WebhookModel,
}, {
  client: documentClient,
  table: config.database.tableName,
});

export { dynamoClient, documentClient };
