// const { AsyncLocalStorage, AsyncResource } = require('async_hooks');
import { AsyncLocalStorage, AsyncResource } from 'async_hooks';

const asyncLocalStorage = new AsyncLocalStorage();

class TestFile extends AsyncResource {

  testId: string;

  constructor(testId) {
    super('Test');
    this.testId = testId;
  }

  run(task) {
    const context = { testId: this.testId };
    asyncLocalStorage.run(context, () => {
      this.runInAsyncScope(task);
    });
  }
}