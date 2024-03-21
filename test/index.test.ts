import { BrowserStorage } from '../src/index.ts';
import { expect } from '@esm-bundle/chai';

describe('BrowserStorage', () => {
  describe('saveAndReadFile', () => {
    it('should save file to file system if supported', async () => {
      // Mock file system support
      const browserStorage = new BrowserStorage();      

      await writeAndReadFile(browserStorage);
    });

    it('should save file to indexedDB if file system is not supported', async () => {
      const browserStorage = new BrowserStorage({ wantFileSystem: false});      

      await writeAndReadFile(browserStorage);
    });

    it('should save file to local storage if indexedDB is not supported', async () => {
      const browserStorage = new BrowserStorage({ wantFileSystem: false, wantIndexedDB: false });      

      await writeAndReadFile(browserStorage);
    });

    it('should save file to session storage if local storage is not supported', async () => {
      const browserStorage = new BrowserStorage({ wantFileSystem: false, wantIndexedDB: false, wantLocalStorage: false });      

      await writeAndReadFile(browserStorage);
    });

    it('should save file to cookie if session storage is not supported', async () => {
      const browserStorage = new BrowserStorage({ wantFileSystem: false, wantIndexedDB: false, wantLocalStorage: false, wantSessionStorage: false });      

      await writeAndReadFile(browserStorage);
    });
  });
});

async function writeAndReadFile(browserStorage: BrowserStorage) {
  const filename = 'image.jpg';
  const request = await fetch(IMAGE_BASE_64);
  const data = await request.blob();

  const result = await browserStorage.saveFile(filename, data);

  expect(result).to.equal(true);

  const checkBlob = await browserStorage.readFile(filename);
  expect(checkBlob).to.be.not.undefined;
  expect(checkBlob).to.be.instanceOf(Blob);
  var reader = new FileReader();
  reader.readAsDataURL(checkBlob!); 
  reader.onloadend = function() {
    var base64data = reader.result;
    expect(base64data).to.equal(IMAGE_BASE_64);            
  }
}

const IMAGE_BASE_64 = 'data:image/png;base64,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';