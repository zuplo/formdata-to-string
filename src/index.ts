


interface Options {
  /**
   * A custom boundary to use in your generated FormData string. Will default to an internal
   * `undici` identifying boundary if not supplied.
   */
  boundary?: string;
}

/**
 * @see {@link https://stackoverflow.com/a/63361543/105698}
 */
async function streamToString(data) {
  const chunks = [];

  for await (const chunk of data) {
    chunks.push(Buffer.from(chunk));
  }

  return Buffer.concat(chunks).toString('utf-8');
}


/**
 * @license https://github.com/nodejs/undici/blob/e39a6324c4474c6614cac98b8668e3d036aa6b18/LICENSE
 * @see {@link https://github.com/nodejs/undici/blob/e39a6324c4474c6614cac98b8668e3d036aa6b18/lib/core/util.js#L279-L282}
 */
function isBuffer(buffer) {
  return buffer instanceof Uint8Array || Buffer.isBuffer(buffer);
}

/**
 * This is a paired down version of the `extractBody` function in `undici` that can convert a
 * `FormData` instance into a stream object that can be easily read out of.
 *
 * @license https://github.com/nodejs/undici/blob/e39a6324c4474c6614cac98b8668e3d036aa6b18/LICENSE
 * @see {@link https://github.com/nodejs/undici/blob/e39a6324c4474c6614cac98b8668e3d036aa6b18/lib/fetch/body.js#L31}
 */
function extractBody(object, opts?: Options) {
  let source = null;
  let length = null;

  const boundary = opts?.boundary
    ? opts.boundary
    : `----formdata-undici-0${`${Math.floor(Math.random() * 1e11)}`.padStart(11, '0')}`;
  const prefix = `--${boundary}\r\nContent-Disposition: form-data`;

  /*! formdata-polyfill. MIT License. Jimmy Wärting <https://jimmy.warting.se/opensource> */
  const escape = (str: string) => str.replace(/\n/g, '%0A').replace(/\r/g, '%0D').replace(/"/g, '%22');
  const normalizeLinefeeds = (value: string) => value.replace(/\r?\n|\r/g, '\r\n');

  const enc = new TextEncoder();
  const blobParts = [];
  const rn = new Uint8Array([13, 10]); // '\r\n'
  length = 0;
  let hasUnknownSizeValue = false;

  for (const [name, value] of object) {
    if (typeof value === 'string') {
      const chunk = enc.encode(
        `${prefix}; name="${escape(normalizeLinefeeds(name))}"\r\n\r\n${normalizeLinefeeds(value)}\r\n`,
      );
      blobParts.push(chunk);
      length += chunk.byteLength;
    } else {
      const chunk = enc.encode(
        `${prefix}; name="${escape(normalizeLinefeeds(name))}"${
          value.name ? `; filename="${escape(value.name)}"` : ''
        }\r\nContent-Type: ${value.type || 'application/octet-stream'}\r\n\r\n`,
      );
      blobParts.push(chunk, value, rn);
      if (typeof value.size === 'number') {
        length += chunk.byteLength + value.size + rn.byteLength;
      } else {
        hasUnknownSizeValue = true;
      }
    }
  }

  const chunk = enc.encode(`--${boundary}--`);
  blobParts.push(chunk);
  length += chunk.byteLength;
  if (hasUnknownSizeValue) {
    length = null;
  }

  source = object;

  // eslint-disable-next-line func-names
  const action = async function* () {
    for (const part of blobParts) {
      if (part.stream) {
        yield* part.stream();
      } else {
        yield part;
      }
    }
  };

  const type = `multipart/form-data; boundary=${boundary}`;

  if (typeof source === 'string' || isBuffer(source)) {
    length = Buffer.byteLength(source);
  }

  let iterator;
  const stream = new ReadableStream({
    async start() {
      iterator = action()[Symbol.asyncIterator]();
    },
    // @ts-expect-error Typings are off but this works.
    async pull(controller) {
      const { value, done } = await iterator.next();
      if (done) {
        queueMicrotask(() => {
          controller.close();
        });
      } else {
        controller.enqueue(new Uint8Array(value));
      }
      return controller.desiredSize > 0;
    },
    async cancel() {
      await iterator.return();
    },
    type: undefined,
  });

  return {
    body: {
      stream,
      source,
      length,
    },
    type,
  };
}

/**
 * Convert an instance of the `FormData` API into a raw string.
 *
 */
export default async function formDataToString(form: FormData, opts: Options = {}) {
  const {
    body: { stream },
  } = await extractBody(form, opts);

  return streamToString(stream);
}
