interface ExtendedWindow {
  TEMPORARY: string;
  PERSISTENT: string;
  requestFileSystem?: (
    type: string,
    size: number,
    successCallback: (fs: FileSystem) => void,
    errorCallback?: (reason: any) => void
  ) => void;
  webkitRequestFileSystem?: (
    type: string,
    size: number,
    successCallback: (fs: FileSystem) => void,
    errorCallback?: (reason: any) => void
  ) => void;
}

type ErrorCallback = (err: DOMException) => void;
type FileCallback = (file: File) => void;

interface FileSystemFileEntry extends FileSystemEntry {
  createWriter(callback: (writer: FileWriter) => void): void;
  file(successCallback: FileCallback, errorCallback?: ErrorCallback): void;
}

interface FileWriter {
  onwriteend: () => void;
  onerror: (error: any) => void;
  write(data: Blob): void;
}

export class BrowserStorage {
  private fileSystemSupported: boolean;
  private indexedDBSupported: boolean;
  private localStorageSupported: boolean;
  private sessionStorageSupported: boolean;
  private cookieSupported: boolean;

  constructor(
    private readonly options: {
        wantFileSystem?: boolean;
        wantIndexedDB?: boolean;
        wantLocalStorage?: boolean;
        wantSessionStorage?: boolean;
        wantCookie?: boolean;
        logger?: Console;
        } = {}
  ) {
    this.options = {
        wantFileSystem: true,
        wantIndexedDB: true,
        wantLocalStorage: true,
        wantSessionStorage: true,
        wantCookie: true,
        logger: console,
        ...options,
        };
    this.fileSystemSupported =
      ("requestFileSystem" in window || "webkitRequestFileSystem" in window) &&
      "TEMPORARY" in window &&
      "PERMANENT" in window;
    this.indexedDBSupported = "indexedDB" in window;
    this.localStorageSupported = "localStorage" in window;
    this.sessionStorageSupported = "sessionStorage" in window;
    this.cookieSupported = navigator.cookieEnabled;
  }

  async saveFile(filename: string, data: Blob): Promise<boolean> {
    if (this.fileSystemSupported && this.options.wantFileSystem) {
      try {
        const fileSystem = await this.requestFileSystem(data.size);
        const file = await this.createFile(fileSystem, filename);
        if (!("createWriter" in file) || !("file" in file)) {
          throw new Error("File doesn't implement createWriter method");
        }
        await this.writeFile(file as FileSystemFileEntry, data);
        return true;
      } catch (ex) {
        this.options.logger?.warn("Failed to save file to FileSystem", ex);
      }
    }

    if (this.indexedDBSupported && this.options.wantIndexedDB) {
      try {
        await this.saveToIndexedDB(filename, data);
        return true;
      } catch (ex) {
        this.options.logger?.warn("Failed to save file to IndexedDB", ex);
      }
    }

    if (this.localStorageSupported && this.options.wantLocalStorage) {
      try {
        this.saveToStorage(localStorage, filename, data);
        return true;
      } catch (ex) {
        this.options.logger?.warn("Failed to save file to LocalStorage", ex);
      }
    }

    if (this.sessionStorageSupported && this.options.wantSessionStorage) {
      try {
        this.saveToStorage(sessionStorage, filename, data);
        return true;
      } catch (ex) {
        this.options.logger?.warn("Failed to save file to SessionStorage", ex);
      }
    }

    if (this.cookieSupported && this.options.wantCookie) {
      try {
        this.saveToCookie(filename, data);
        return true;
      } catch (ex) {
        this.options.logger?.warn("Failed to save file to Cookie", ex);
      }
    }

    return false; // No supported storage mechanism available
  }

  async saveTextFile(filename: string, text: string): Promise<boolean> {
    const blob = new Blob([text], { type: "text/plain" });
    return this.saveFile(filename, blob);
  }

  async readFile(filename: string): Promise<Blob | undefined> {
    if (this.fileSystemSupported && this.options.wantFileSystem) {
      try {
        const fileSystem = await this.requestFileSystem();
        const file = await this.getFile(fileSystem, filename);
        if (!("createWriter" in file) || !("file" in file)) {
          throw new Error("File doesn't implement file method");
        }
        return await this.readFileAsBlob(file as FileSystemFileEntry);
      } catch (ex) {
        this.options.logger?.warn("Failed to read file from FileSystem", ex);
      }
    }

    if (this.indexedDBSupported && this.options.wantIndexedDB) {
      try {
        return await this.readFromIndexedDB(filename);
      } catch (ex) {
        this.options.logger?.warn("Failed to read file from IndexedDB", ex);
      }
    }

    if (this.localStorageSupported && this.options.wantLocalStorage) {
      try {
        return this.readFromStorage(localStorage, filename);
      } catch (ex) {
        this.options.logger?.warn("Failed to read file from LocalStorage", ex);
      }
    }

    if (this.sessionStorageSupported && this.options.wantSessionStorage) {
      try {
        return this.readFromStorage(sessionStorage, filename);
      } catch (ex) {
        this.options.logger?.warn("Failed to read file from SessionStorage", ex);
      }
    }

    if (this.cookieSupported && this.options.wantCookie) {
      try {
        return await this.readFromCookie(filename);
      } catch (ex) {
        this.options.logger?.warn("Failed to read file from Cookie", ex);
      }
    }

    return undefined; // No supported storage mechanism available
  }

  async readTextFile(filename: string): Promise<string | undefined> {
    const blob = await this.readFile(filename);
    if (blob) {
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsText(blob);
      });
    }
  }

  private requestFileSystem(size?: number): Promise<FileSystem> {
    return new Promise((resolve, reject) => {
      const extendedWindow = window as unknown as ExtendedWindow;
      const request = extendedWindow.requestFileSystem || extendedWindow.webkitRequestFileSystem;
      request?.call(
        extendedWindow,
        extendedWindow.PERSISTENT,
        Math.max(size ?? 0, 1024 * 1024), // 1MB
        resolve,
        reject
      );
    });
  }

  private createFile(fileSystem: FileSystem, filename: string): Promise<FileSystemEntry> {
    return new Promise((resolve, reject) => {
      fileSystem.root.getFile(filename, { create: true }, resolve, reject);
    });
  }

  private writeFile(file: FileSystemFileEntry, data: Blob): Promise<void> {
    return new Promise((resolve, reject) => {
      file.createWriter((writer) => {
        writer.onwriteend = () => resolve();
        writer.onerror = reject;
        writer.write(data);
      });
    });
  }

  private getFile(fileSystem: FileSystem, filename: string): Promise<FileSystemEntry> {
    return new Promise((resolve, reject) => {
      fileSystem.root.getFile(filename, {}, resolve, reject);
    });
  }

  private readFileAsBlob(file: FileSystemFileEntry): Promise<Blob> {
    return new Promise((resolve, reject) => {
      file.file(resolve, reject);
    });
  }

  private async saveToIndexedDB(filename: string, data: Blob): Promise<unknown> {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = window.indexedDB.open("fileStorage", 1);
      request.onerror = reject;
      request.onsuccess = () => resolve(request.result);
      request.onupgradeneeded = (event) => {
        const db = request.result;
        db.createObjectStore("files");
      };
    });

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["files"], "readwrite");
      const store = transaction.objectStore("files");
      const request = store.put(data, filename);
      request.onsuccess = resolve;
      request.onerror = reject;
    });
  }

  private async readFromIndexedDB(filename: string): Promise<Blob | undefined> {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = window.indexedDB.open("fileStorage", 1);
      request.onerror = reject;
      request.onsuccess = () => resolve(request.result);
    });

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["files"], "readonly");
      const store = transaction.objectStore("files");
      const request = store.get(filename);
      request.onsuccess = () => resolve(request.result);
      request.onerror = reject;
    });
  }

  private saveToStorage(storage: Storage, filename: string, data: Blob): void {
    storage.setItem(filename, URL.createObjectURL(data));
  }

  private readFromStorage(storage: Storage, filename: string): Promise<Blob> | undefined {
    const url = storage.getItem(filename);
    if (url) {
      return fetch(url).then((response) => response.blob());
    }
  }

  private saveToCookie(filename: string, data: Blob): void {
    const blobUrl = URL.createObjectURL(data);
    document.cookie = `${filename}=${blobUrl};path=/`;
  }

  private readFromCookie(filename: string): Promise<Blob> | undefined {
    const cookies = document.cookie.split(";");
    for (const cookie of cookies) {
      const [key, value] = cookie.split("=");
      if (key.trim() === filename) {
        return fetch(value).then((response) => response.blob());
      }
    }
  }
}
