export { default as GIFDecoder } from './gif-decoder';

export { default as GIFEncoder } from './gif-encoder';

// @ts-ignore
import GifWorker from './gif-worker?worker&inline';

import workPool from './work-pool';
workPool.registerWork('gif', GifWorker);
