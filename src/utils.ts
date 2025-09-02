export async function* toAsyncIterable<T>(items: T[]): AsyncIterable<T> {
  for (const item of items) {
    yield item;
  }
}
