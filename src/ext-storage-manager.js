/*!
 * ExtStorageManager
 * Part of the ExtHelpers project
 * @version  v1.7.1
 * @author   Gerrproger
 * @license  MIT License
 * Repo:     http://github.com/gerrproger/ext-helpers
 * Issues:   http://github.com/gerrproger/ext-helpers/issues
 */
(function (root, factory) {
  /*eslint-disable */
  'use strict';
  if (typeof module === 'object' && typeof module.exports === 'object') {
    module.exports = factory(root, document);
  } else if (typeof define === 'function' && define.amd) {
    define(null, function () {
      factory(root, document);
    });
  } else {
    root.ExtStorageManager = factory(root, document);
  }
})(typeof window !== 'undefined' ? window : this, function (window, document) {
  /*eslint-enable */
  'use strict';

  const ExtStorageManager = function (defData, callback, name) {
    class Storage {
      constructor(name = 'sync', defData = {}, callback = () => {}) {
        const checkInit = function () {
          if (!this.initialized) {
            throw new StorageError('Storage is not initialized yet!');
          }
          return arguments[0].apply(this, Array.prototype.slice.call(arguments, 1));
        };
        this.name = name;
        this.callback = callback;
        this.onUpdateCalls = [];
        this.data = {};
        this.defData = defData || {};
        this.skip = false;
        this.initialized = false;
        this.nativeStorage = chrome.storage[name];
        this.api = {
          get: checkInit.bind(this, this.get),
          set: checkInit.bind(this, this.set),
          remove: checkInit.bind(this, this.remove),
          reset: checkInit.bind(this, this.reset),
          clear: checkInit.bind(this, this.clear),
          onUpdate: this.onUpdate.bind(this),
          offUpdate: this.offUpdate.bind(this),
          getBytesInUse: this.getBytesInUse.bind(this),
          limits: this.limits,
        };
        this.nativeStorage.get(this._checkStorage.bind(this));
        this.nativeStorage.onChanged.addListener(this._updateStorage.bind(this));
      }

      _checkStorage(opts) {
        const merge = this._extend(opts, this.defData);
        const errorMessage = chrome.runtime.lastError && chrome.runtime.lastError.message;
        this.data = merge.object;
        if (merge.changed.length) {
          const changed = {};
          merge.changed.forEach((key) => {
            changed[key] = this.data[key];
          });
          this.nativeStorage.set(changed);
        }
        this.initialized = true;
        this.callback.call(window, this.get(), errorMessage);
        if (errorMessage) {
          throw new StorageError(errorMessage);
        }
      }

      _isObject(v) {
        const type = typeof v;
        return v !== null && type === 'object' && !Array.isArray(v);
      }

      _copyObject(o) {
        return JSON.parse(JSON.stringify(o));
      }

      _extend(obj1, obj2) {
        const changed = [];
        const addChanged = (v) => {
          !changed.includes(v) && changed.push(v);
        };
        const iter = (o1, o2, parentKey) => {
          Object.keys(o2).forEach((key) => {
            if (o1[key] === undefined) {
              o1[key] = o2[key];
              addChanged(parentKey || key);
            } else if (this._isObject(o2[key])) {
              iter(o1[key], o2[key], parentKey || key);
            }
          });
        };
        obj1 = this._copyObject(obj1 || {});
        obj2 = this._copyObject(obj2 || {});
        iter(obj1, obj2);
        return {
          object: obj1,
          changed,
        };
      }

      _updateStorage(opts) {
        if (this.skip) {
          return;
        }
        const changed = [];
        const iter = (o1, o2, allKey) => {
          const keys = Object.keys(o1);
          if (!keys.length) {
            changed.push(allKey);
            return;
          }
          keys.forEach((key) => {
            if (this._isObject(o1[key]) && this._isObject(o2[key])) {
              iter(o1[key], o2[key], `${allKey}.${key}`);
            } else if (o1[key] !== o2[key]) {
              changed.push(`${allKey}.${key}`);
            }
          });
        };
        Object.keys(opts).forEach((key) => {
          if (!opts[key].hasOwnProperty('newValue')) {
            delete this.data[key];
            changed.push(key);
            return;
          }
          if (this._isObject(opts[key].newValue) && this._isObject(this.data[key])) {
            iter(opts[key].newValue, this.data[key], key);
          } else if (opts[key].newValue !== this.data[key]) {
            changed.push(key);
          }
          this.data[key] = opts[key].newValue;
        });
        changed.forEach((path) => {
          this.onUpdateCalls.forEach((caller) => {
            if (new RegExp(`^${caller[0].replace(/\./g, '\\.')}`).test(path) || new RegExp(`^${path.replace(/\./g, '\\.')}`).test(caller[0])) {
              caller[1].call(window, this.get(caller[0]));
            }
          });
        });
      }

      _replaceStorage(newData, callback) {
        newData = this._copyObject(newData);
        const toRemove = Object.keys(this.data).filter((key) => !newData.hasOwnProperty(key));
        this.data = newData;
        this.skip = true;
        toRemove.length && this.nativeStorage.remove(toRemove, this._callback.bind(this, callback));
        this.nativeStorage.set(this.data, () => {
          this.skip = false;
          this._callback(callback, chrome.runtime.lastError);
        });
      }

      _callback(func, error) {
        error = error || chrome.runtime.lastError;
        const errorMessage = error && error.message;
        typeof func === 'function' && func.call(window, errorMessage);
        if (errorMessage) {
          throw new StorageError(errorMessage);
        }
      }

      get(path) {
        if (!path) {
          return this._copyObject(this.data);
        }
        let temp = this.data;
        const notFound = path.split(/\./g).some((key) => {
          if (temp && temp[key] !== undefined) {
            temp = temp[key];
          } else {
            return true;
          }
        });
        return notFound ? undefined : this._isObject(temp) ? this._copyObject(temp) : temp;
      }

      set(path, value, callback) {
        if (path && typeof path !== 'string') {
          throw new StorageError('Path should be a string!');
        }
        if (callback && typeof callback !== 'function') {
          throw new StorageError('Callback should be a function!');
        }
        this._isObject(value) && (value = this._copyObject(value));
        if (!path) {
          if (!this._isObject(value)) {
            throw new StorageError('Could not store a non-object in the storage root!');
          }
          this._replaceStorage(value, callback);
          return this.api;
        }
        let temp = this.data;
        const pathArray = path.split(/\./g);
        const pathLength = pathArray.length - 1;
        const error = pathArray.some((key, i) => {
          if (i === pathLength) {
            temp[key] = value;
          } else if (temp[key] === undefined) {
            temp = temp[key] = {};
          } else if (this._isObject(temp[key])) {
            temp = temp[key];
          } else {
            return true;
          }
        });
        if (error) {
          throw new StorageError('One of the path nestings is not an object!');
        }
        this.nativeStorage.set({ [pathArray[0]]: this.data[pathArray[0]] }, this._callback.bind(this, callback));
        return this.api;
      }

      remove(path, skipNonexistent, callback) {
        if (typeof skipNonexistent === 'function' && callback === undefined) {
          callback = skipNonexistent;
          skipNonexistent = false;
        }
        if (!path) {
          throw new StorageError('Path is not passed!');
        }
        if (skipNonexistent !== undefined && typeof skipNonexistent !== 'boolean') {
          throw new StorageError('SkipNonexistent should be a boolean!');
        }
        if (callback !== undefined && typeof callback !== 'function') {
          throw new StorageError('Callback should be a function!');
        }
        const pathArray = path.split(/\./g);
        const pathLength = pathArray.length - 1;
        if (!pathLength) {
          if (!this.data.hasOwnProperty(pathArray[0])) {
            if (skipNonexistent) {
              this._callback(callback);
              return this.api;
            }
            throw new StorageError('Passed path does not exists!');
          }
          delete this.data[pathArray[0]];
          this.nativeStorage.remove(pathArray[0], this._callback.bind(this, callback));
          return this.api;
        }
        let temp = this.data;
        const error = pathArray.some((key, i) => {
          if (i === pathLength) {
            if (temp[key] === undefined) {
              return true;
            } else {
              delete temp[key];
              this.nativeStorage.set({ [pathArray[0]]: this.data[pathArray[0]] }, this._callback.bind(this, callback));
            }
          } else if (this._isObject(temp[key])) {
            temp = temp[key];
          } else {
            throw new StorageError('One of the path nestings is not an object!');
          }
        });
        if (error) {
          if (!skipNonexistent) {
            throw new StorageError('Passed path does not exists!');
          }
          this._callback(callback);
        }
        return this.api;
      }

      onUpdate(path, callback, namespace) {
        if (typeof path === 'function') {
          callback = path;
          namespace = callback;
          path = null;
        }
        if (typeof callback !== 'function') {
          throw new StorageError('Callback function is not passed!');
        }
        if (namespace && typeof namespace !== 'string') {
          throw new StorageError('Namespace should be a string or undefined!');
        }
        this.onUpdateCalls.push([path || '', callback, namespace || '']);
        return this.api;
      }

      offUpdate(namespace) {
        if (namespace && typeof namespace !== 'string') {
          throw new StorageError('Namespace should be a string or undefined!');
        }
        this.onUpdateCalls = namespace ? this.onUpdateCalls.filter((caller) => caller[2] !== namespace) : [];
        return this.api;
      }

      reset(callback) {
        if (callback && typeof callback !== 'function') {
          throw new StorageError('Callback should be a function!');
        }
        this._replaceStorage(this.defData, callback);
        return this.api;
      }

      clear(callback) {
        if (callback && typeof callback !== 'function') {
          throw new StorageError('Callback should be a function!');
        }
        this._replaceStorage({}, callback);
        return this.api;
      }

      getBytesInUse(key, callback) {
        if (typeof key === 'function') {
          callback = key;
          key = null;
        } else if (typeof callback !== 'function') {
          throw new StorageError('Callback function is not passed!');
        }
        this.nativeStorage.getBytesInUse(key || null, (bytes) => {
          const limit = this.nativeStorage[`QUOTA_BYTES${key ? '_PER_ITEM' : ''}`];
          callback.call(window, bytes, limit);
        });
        return this.api;
      }

      get limits() {
        return {
          maxItems: this.nativeStorage.MAX_ITEMS,
          maxSustainedWriteOperationsPerMinute: this.nativeStorage.MAX_SUSTAINED_WRITE_OPERATIONS_PER_MINUTE,
          maxWriteOperationsPerHour: this.nativeStorage.MAX_WRITE_OPERATIONS_PER_HOUR,
          maxWriteOperationsPerMinute: this.nativeStorage.MAX_WRITE_OPERATIONS_PER_MINUTE,
          quotaBytes: this.nativeStorage.QUOTA_BYTES,
          quotaBytesPerItem: this.nativeStorage.QUOTA_BYTES_PER_ITEM,
        };
      }
    }

    class StorageError extends Error {
      constructor(message) {
        super(message);
        this.name = 'ExtStorageManagerError';
        this.stack = this.stack.replace(/\s\s\s\sat Storage.+(\n|$)/g, '');
      }
    }

    return new Storage(name, defData, callback).api;
  };

  return ExtStorageManager;
});
