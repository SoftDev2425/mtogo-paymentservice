import createServer from '../../utils/server';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export let app: any;

global.beforeAll(async () => {
  app = createServer();
});

global.beforeEach(async () => {});

global.afterAll(async () => {});
