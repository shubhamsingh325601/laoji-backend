describe('Item-Level Concurrent Loading State Architecture Tests', () => {
  // Generic helper matching the keyed loading-state reducer pattern implemented in the app
  class ItemOperationManager<TKey extends string, TAction extends string = 'default'> {
    private loadingMap: Record<string, boolean> = {};
    private errorMap: Record<string, string | null> = {};

    private getKey(entityId: TKey, action?: TAction): string {
      return action && action !== 'default' ? `${entityId}:${action}` : entityId;
    }

    isLoading(entityId: TKey, action?: TAction): boolean {
      return Boolean(this.loadingMap[this.getKey(entityId, action)]);
    }

    getError(entityId: TKey, action?: TAction): string | null {
      return this.errorMap[this.getKey(entityId, action)] ?? null;
    }

    async runOperation<R>(
      entityId: TKey,
      action: TAction,
      fn: () => Promise<R>,
    ): Promise<R> {
      const key = this.getKey(entityId, action);
      this.loadingMap[key] = true;
      this.errorMap[key] = null;

      try {
        const result = await fn();
        return result;
      } catch (err: any) {
        this.errorMap[key] = err?.message || 'Operation failed';
        throw err;
      } finally {
        delete this.loadingMap[key];
      }
    }
  }

  // Defer helper to simulate asynchronous operations with precise controllable timing
  function createDeferred<T>() {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: any) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  }

  it('Test 1: Two independent deletes -> A starts delete, B starts delete -> A loading = true, B loading = true', async () => {
    const manager = new ItemOperationManager<'doc_aadhaar_front' | 'doc_aadhaar_back'>();
    const defA = createDeferred<string>();
    const defB = createDeferred<string>();

    const opA = manager.runOperation('doc_aadhaar_front', 'default', () => defA.promise);
    expect(manager.isLoading('doc_aadhaar_front')).toBe(true);
    expect(manager.isLoading('doc_aadhaar_back')).toBe(false);

    const opB = manager.runOperation('doc_aadhaar_back', 'default', () => defB.promise);
    expect(manager.isLoading('doc_aadhaar_front')).toBe(true);
    expect(manager.isLoading('doc_aadhaar_back')).toBe(true);

    defA.resolve('done_a');
    defB.resolve('done_b');
    await Promise.all([opA, opB]);
  });

  it('Test 2 & 3: B finishes first -> A remains loading=true, B loading=false; Then A finishes -> A loading=false, B loading=false', async () => {
    const manager = new ItemOperationManager<'doc_aadhaar_front' | 'doc_aadhaar_back'>();
    const defA = createDeferred<string>();
    const defB = createDeferred<string>();

    const opA = manager.runOperation('doc_aadhaar_front', 'default', () => defA.promise);
    const opB = manager.runOperation('doc_aadhaar_back', 'default', () => defB.promise);

    expect(manager.isLoading('doc_aadhaar_front')).toBe(true);
    expect(manager.isLoading('doc_aadhaar_back')).toBe(true);

    // B resolves first
    defB.resolve('done_b');
    await opB;

    expect(manager.isLoading('doc_aadhaar_front')).toBe(true);
    expect(manager.isLoading('doc_aadhaar_back')).toBe(false);

    // A finishes second
    defA.resolve('done_a');
    await opA;

    expect(manager.isLoading('doc_aadhaar_front')).toBe(false);
    expect(manager.isLoading('doc_aadhaar_back')).toBe(false);
  });

  it('Test 4: A fails while B continues -> A loading=false with error, B remains loading=true until completion', async () => {
    const manager = new ItemOperationManager<'doc_aadhaar_front' | 'doc_aadhaar_back'>();
    const defA = createDeferred<string>();
    const defB = createDeferred<string>();

    const opA = manager.runOperation('doc_aadhaar_front', 'default', () => defA.promise).catch((e) => e);
    const opB = manager.runOperation('doc_aadhaar_back', 'default', () => defB.promise);

    expect(manager.isLoading('doc_aadhaar_front')).toBe(true);
    expect(manager.isLoading('doc_aadhaar_back')).toBe(true);

    // A fails with Network error
    defA.reject(new Error('Network error on doc front'));
    await opA;

    // Verify A stopped loading and registered its error, while B is still running unaffected
    expect(manager.isLoading('doc_aadhaar_front')).toBe(false);
    expect(manager.getError('doc_aadhaar_front')).toBe('Network error on doc front');
    expect(manager.isLoading('doc_aadhaar_back')).toBe(true);
    expect(manager.getError('doc_aadhaar_back')).toBeNull();

    // B now succeeds
    defB.resolve('success_b');
    await opB;

    expect(manager.isLoading('doc_aadhaar_back')).toBe(false);
    expect(manager.getError('doc_aadhaar_back')).toBeNull();
  });

  it('Test 5: Reverse completion order: A starts, B starts, A finishes first -> A false, B true', async () => {
    const manager = new ItemOperationManager<'cat_1' | 'cat_2'>();
    const defA = createDeferred<string>();
    const defB = createDeferred<string>();

    const opA = manager.runOperation('cat_1', 'default', () => defA.promise);
    const opB = manager.runOperation('cat_2', 'default', () => defB.promise);

    expect(manager.isLoading('cat_1')).toBe(true);
    expect(manager.isLoading('cat_2')).toBe(true);

    // A finishes first
    defA.resolve('done_cat_1');
    await opA;

    expect(manager.isLoading('cat_1')).toBe(false);
    expect(manager.isLoading('cat_2')).toBe(true);

    // B finishes second
    defB.resolve('done_cat_2');
    await opB;

    expect(manager.isLoading('cat_1')).toBe(false);
    expect(manager.isLoading('cat_2')).toBe(false);
  });

  it('Test 6: Different item-level actions concurrently: A=update, B=delete -> Isolated loading without state overwrite', async () => {
    const manager = new ItemOperationManager<'item_pizza' | 'item_burger', 'update' | 'delete'>();
    const defA = createDeferred<string>();
    const defB = createDeferred<string>();

    const opA = manager.runOperation('item_pizza', 'update', () => defA.promise);
    const opB = manager.runOperation('item_burger', 'delete', () => defB.promise);

    expect(manager.isLoading('item_pizza', 'update')).toBe(true);
    expect(manager.isLoading('item_pizza', 'delete')).toBe(false);
    expect(manager.isLoading('item_burger', 'delete')).toBe(true);
    expect(manager.isLoading('item_burger', 'update')).toBe(false);

    defA.resolve('updated_pizza');
    await opA;

    expect(manager.isLoading('item_pizza', 'update')).toBe(false);
    expect(manager.isLoading('item_burger', 'delete')).toBe(true);

    defB.resolve('deleted_burger');
    await opB;

    expect(manager.isLoading('item_pizza', 'update')).toBe(false);
    expect(manager.isLoading('item_burger', 'delete')).toBe(false);
  });
});
