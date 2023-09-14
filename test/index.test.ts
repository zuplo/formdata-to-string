import { File } from 'undici';
import { describe, it, expect } from 'vitest';

import formDataToString from '../src';

import owlbertShrubDataURL from './fixtures/owlbert-shrub.dataurl.json';
import owlbert from './fixtures/owlbert.dataurl.json';

function prepareOutputForSnapshot(output: string) {
  return output.replace(/------formdata-undici-(\d+)/g, '------formdata-undici-TIMESTAMP');
}

describe('#formdata-to-string', () => {
  it('should convert a basic instance into a string', async () => {
    const form = new FormData();
    form.append('dog', 'buster');

    const output = await formDataToString(form).then(prepareOutputForSnapshot);
    expect(output).toMatchSnapshot();
  });

  it('should support File objects', async () => {
    const form = new FormData();

    form.append(
      'image',
      new File([owlbertShrubDataURL], 'owlbert.png', { type: 'image/png' }) as unknown as Blob,
      'owlbert.png',
    );

    const output = await formDataToString(form).then(prepareOutputForSnapshot);
    expect(output).toMatchSnapshot();
  });

  it('should support Blob objects', async () => {
    const form = new FormData();

    form.append('image', new Blob([owlbert], { type: 'image/png' }), 'owlbert.png');

    const output = await formDataToString(form).then(prepareOutputForSnapshot);
    expect(output).toMatchSnapshot();
  });

  describe('options', () => {
    describe('#boundary', () => {
      it('should support supplying a custom boundary', async () => {
        const form = new FormData();
        form.append('dog', 'buster');

        const output = await formDataToString(form, { boundary: 'CUSTOM-BOUNDARY' }).then(prepareOutputForSnapshot);
        expect(output).toMatchSnapshot();
      });
    });
  });
});
